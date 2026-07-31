import { randomUUID } from 'crypto';

import Instance from '../../models/Instance.js';
import Bot from '../../models/Bot.js';
import Conversation from '../../models/Conversation.js';

import { checkMessageLimit } from '../../middlewares/planLimits.js';

import { flowHandler } from './flowHandler.js';
import aiHandler from './aiHandler.js';

import messageDeliveryService from '../../services/messageDeliveryService.js';
import ContactIdentityService from '../../services/contactIdentityService.js';
import MessageService from '../../services/messageService.js';
import SocketService from '../../services/socketService.js';

import redis from '../../queues/redis.js';

const UNLOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

function extractText(message) {
  const text =
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.imageMessage?.caption ||
    null;

  if (!text) {
    console.warn(
      '[MessageHandler] Tipo de mensagem não suportado:',
      Object.keys(message || {})
    );
  }

  return text;
}

function formatPhoneFallback(identity) {
  const digits = identity.split('@')[0];

  if (identity.endsWith('@lid')) {
    return 'Novo contato (aguardando WhatsApp)';
  }

  const match = digits.match(/^(\d{2})(\d{2})(\d{4,5})(\d{4})$/);
  if (match) {
    const [, country, ddd, part1, part2] = match;
    return `+${country} (${ddd}) ${part1}-${part2}`;
  }
  return `+${digits}`;
}

function resolveContactIdentity(webhookPayload) {
  const data = webhookPayload?.data;
  const remoteJid = data?.key?.remoteJid || '';

  if (remoteJid.includes('@g.us')) return null;

  if (remoteJid.includes('@s.whatsapp.net') || remoteJid.includes('@lid')) {
    return {
      contactIdentity: remoteJid,
      isLid: remoteJid.endsWith('@lid'),
      previousIdentity: data?.key?.previousRemoteJid || null,
    };
  }

  console.warn(
    '[MessageHandler] remoteJid em formato desconhecido, mensagem descartada:',
    remoteJid
  );
  return null;
}

async function resolveOrCreateConversation(
  bot,
  resolvedIdentity,
  previousIdentity,
  senderName
) {
  const lockKey = `convlock:${bot.id}:${resolvedIdentity}`;
  const lockToken = randomUUID();
  const MAX_WAIT_MS = 10000;
  const POLL_INTERVAL_MS = 200;

  let lockAcquired = await redis.set(lockKey, lockToken, 'NX', 'EX', 15);
  let waited = 0;

  while (!lockAcquired && waited < MAX_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    waited += POLL_INTERVAL_MS;
    lockAcquired = await redis.set(lockKey, lockToken, 'NX', 'EX', 15);
  }

  if (!lockAcquired) {
    console.warn(
      `[MessageHandler] Lock de conversa para bot=${bot.id} contato=${resolvedIdentity} não foi adquirido a tempo, seguindo sem lock para não descartar a mensagem.`
    );
  }

  try {
    let conversation = await Conversation.findOne({
      where: {
        bot_id: bot.id,
        contact_phone: resolvedIdentity,
        status: 'open',
      },
    });
    let created = false;

    if (!conversation && previousIdentity) {
      const oldConversation = await Conversation.findOne({
        where: { bot_id: bot.id, contact_phone: previousIdentity },
        order: [['updated_at', 'DESC']],
      });
      if (oldConversation) {
        conversation = await oldConversation.update({
          contact_phone: resolvedIdentity,
          status: 'open',
        });
      }
    }

    if (!conversation) {
      conversation = await Conversation.create({
        bot_id: bot.id,
        contact_phone: resolvedIdentity,
        contact_name: senderName || formatPhoneFallback(resolvedIdentity),
        status: 'open',
      });
      created = true;
    }

    return { conversation, created };
  } finally {
    if (lockAcquired) {
      await redis.eval(UNLOCK_SCRIPT, 1, lockKey, lockToken).catch((err) => {
        console.error(
          '[MessageHandler] Erro ao liberar lock de conversa:',
          err.message
        );
      });
    }
  }
}

export default async function messageHandler(webhookPayload) {
  const { event, instance: instanceId, data } = webhookPayload;

  if (event !== 'messages.upsert') return;
  if (data?.key?.fromMe) return;
  if (data?.messageType === 'protocolMessage') return;

  const identity = resolveContactIdentity(webhookPayload);
  if (!identity) return;
  const { contactIdentity, isLid, previousIdentity } = identity;

  const messageId = data?.key?.id;
  const senderName = data?.pushName ?? null;
  const text = extractText(data?.message);

  if (!text || !messageId) return;

  const alreadyProcessed = await MessageService.findByMessageId(messageId);
  if (alreadyProcessed) return;

  const instance = await Instance.findOne({
    where: { instance_id: instanceId },
  });
  if (!instance) return;
  if (
    !isLid &&
    ContactIdentityService.isSamePhoneNumber(
      contactIdentity,
      instance.phone_number
    )
  ) {
    console.warn(
      `[MessageHandler] Mensagem descartada: remetente (${contactIdentity}) é a própria instância (${instance.phone_number}). Self-message ignorada.`
    );
    return;
  }

  const bot = await Bot.findOne({
    where: { instance_id: instance.id, active: true },
  });
  if (!bot) return;

  const canProcess = await checkMessageLimit(instance.user_id);
  if (!canProcess) {
    console.warn(
      `[MessageHandler] Limite do plano atingido para user_id=${instance.user_id}`
    );
    return;
  }

  let resolvedIdentity = contactIdentity;
  let stillPending = isLid;

  if (isLid) {
    const knownPhone = await ContactIdentityService.findPhoneByLid(
      bot.id,
      contactIdentity
    );
    if (knownPhone) {
      resolvedIdentity = knownPhone;
      stillPending = false;
    }
  }

  if (!isLid && previousIdentity) {
    await ContactIdentityService.upsertIdentity(
      bot.id,
      previousIdentity,
      resolvedIdentity
    );
  }

  const { conversation, created } = await resolveOrCreateConversation(
    bot,
    resolvedIdentity,
    previousIdentity,
    senderName
  );

  if (created) {
    SocketService.emitNotification(
      instance.user_id,
      'new_conversation',
      'Nova conversa',
      `Novo contato: ${senderName || formatPhoneFallback(resolvedIdentity)}`
    );
  }

  if (!created && senderName && conversation.contact_name !== senderName) {
    await conversation.update({ contact_name: senderName });
  }

  // console.log('[DEBUG] chegou no saveAndEmit', {
  //   conversationId: conversation.id,
  //   messageId,
  // });

  await MessageService.saveAndEmit({
    conversationId: conversation.id,
    content: text,
    role: 'user',
    messageId,
  });

  if (conversation.status === 'waiting') {
    console.warn(
      `[MessageHandler] Conversa ${conversation.id} está aguardando atendimento humano. Mensagem salva, bot em silêncio.`
    );
    return;
  }

  if (stillPending) {
    console.warn(
      `[MessageHandler] Contato ${contactIdentity} ainda não resolvido pelo WhatsApp (sem número real disponível). ` +
        `Mensagem salva, resposta automática NÃO enviada até a identidade ser resolvida.`
    );

    SocketService.emitNotification(
      instance.user_id,
      'conversation_pending_resolution',
      'Contato aguardando resolução',
      `Nova mensagem de um contato ainda não identificado pelo WhatsApp. Conversa: ${conversation.id}`
    );

    return;
  }

  let flowReply = null;
  try {
    flowReply = await flowHandler(
      bot,
      conversation,
      instance,
      text,
      resolvedIdentity
    );
  } catch (err) {
    console.error(
      `[MessageHandler] Erro ao executar flowHandler para conversa ${conversation.id}:`,
      err.message
    );
  }

  if (flowReply) return;

  if (bot.mode === 'ai') {
    const { reply } = await aiHandler(bot, conversation, text);
    try {
      await messageDeliveryService.safeSendText(
        instance,
        resolvedIdentity,
        reply
      );
    } catch (err) {
      console.error(
        '[MessageHandler] IA: Erro ao enviar WhatsApp:',
        err.message
      );
    }
  }
}
