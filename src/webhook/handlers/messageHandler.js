import Instance from '../../models/Instance.js';
import Bot from '../../models/Bot.js';
import Conversation from '../../models/Conversation.js';
import Message from '../../models/Message.js';
import WhatsAppService from '../../services/WhatsAppService.js';
import aiHandler from './aiHandler.js';

export default async function messageHandler({
  event,
  instance: instanceId,
  data,
}) {
  if (event !== 'messages.upsert') return;
  if (data?.key?.fromMe) return;
  if (data?.messageType === 'protocolMessage') return;

  const messageId = data?.key?.id;
  const phone = data?.key?.remoteJid?.replace('@s.whatsapp.net', '');
  const senderName = data?.pushName ?? null;

  const text =
    data?.message?.conversation ||
    data?.message?.extendedTextMessage?.text ||
    data?.message?.imageMessage?.caption ||
    null;

  if (!text || !phone || !messageId) return;

  const alreadyProcessed = await Message.findOne({
    where: { message_id: messageId },
  });
  if (alreadyProcessed) return;

  const instance = await Instance.findOne({
    where: { instance_id: instanceId },
  });
  if (!instance) return;

  const bot = await Bot.findOne({
    where: { instance_id: instance.id, active: true },
  });
  if (!bot) return;

  const [conversation] = await Conversation.findOrCreate({
    where: {
      bot_id: bot.id,
      contact_phone: phone,
      status: 'open',
    },
    defaults: {
      contact_name: senderName || phone,
    },
  });

  await Message.create({
    conversation_id: conversation.id,
    content: text,
    role: 'user',
    message_id: messageId,
  });

  if (bot.mode === 'ai') {
    const reply = await aiHandler(bot, conversation, text);
    await WhatsAppService.sendText(instance, phone, reply);
  }
}
