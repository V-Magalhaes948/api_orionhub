import { Op } from 'sequelize';
import { randomUUID } from 'crypto';

import MessageService from '../../services/messageService.js';
// import WhatsAppService from '../../services/whatsAppService.js';
import GroqService from '../../services/groqService.js';
import SocketService from '../../services/socketService.js';

import FlowSession from '../../models/FlowSession.js';
import FlowStep from '../../models/FlowStep.js';
import Flow from '../../models/Flow.js';
import Message from '../../models/Message.js';

import redis from '../../queues/redis.js';
import { invalidateCache } from '../../middlewares/cacheMiddleware.js';

import { getCatalogText } from '../../services/promptBuilder.js';
import messageDeliveryService from '../../services/messageDeliveryService.js';

const UNLOCK_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

async function getOrCreateSession(conversation, flow) {
  let session = await FlowSession.findOne({
    where: { conversation_id: conversation.id },
    include: [{ model: FlowStep, as: 'currentStep' }],
  });

  if (!session) {
    const firstStep = await FlowStep.findOne({
      where: { flow_id: flow.id },
      order: [['order', 'ASC']],
    });

    session = await FlowSession.create({
      conversation_id: conversation.id,
      flow_id: flow.id,
      current_step_id: firstStep?.id ?? null,
      data: {},
      completed: false,
    });

    session.currentStep = firstStep;
  }

  return session;
}

export async function executeStep(
  bot,
  step,
  nextStep,
  userMessage,
  history = []
) {
  const historyWithoutCurrent = history.slice(0, -1);

  let catalogInstructions = '';
  if (step.include_catalog) {
    const catalogText = await getCatalogText(bot.user_id);
    if (catalogText) {
      catalogInstructions =
        `\n\nCatálogo de produtos disponível para esta etapa:\n${catalogText}\n` +
        `Use essas informações para responder dúvidas sobre produtos, preços ou disponibilidade.`;
    }
  }

  const transitionInstructions =
    !step.closes_conversation && nextStep
      ? `\n\nIMPORTANTE: Se o objetivo desta etapa for atingido com a mensagem do usuário, ` +
        `sua "reply" deve fazer DUAS coisas em uma única mensagem natural: ` +
        `(1) confirmar/agradecer o que foi coletado nesta etapa, e ` +
        `(2) já emendar com a próxima etapa do atendimento, que é:\n"${nextStep.content}"\n` +
        `Não mande isso como duas mensagens separadas — uma única mensagem fluida que faz a transição.`
      : '';

  const systemPrompt =
    `${bot.system_prompt}\n\n---\n` +
    `Você está executando a seguinte etapa do atendimento:\n"${step.content}"\n\n` +
    catalogInstructions +
    `Critério de conclusão desta etapa (quando considerar "step_completed": true):\n"${step.completion_criteria}"\n\n` +
    `Responda APENAS em JSON válido, sem markdown, sem texto fora do JSON.\n` +
    `Formato obrigatório:\n` +
    `{\n` +
    `  "reply": "sua resposta para o usuário aqui",\n` +
    `  "step_completed": true ou false,\n` +
    `  "collected": {}\n` +
    `}\n\n` +
    `Regras:\n` +
    `- "reply": o que o usuário vai receber, no tom definido pelo system_prompt\n` +
    `- "step_completed": true SOMENTE quando o critério de conclusão acima foi atingido\n` +
    `- "collected": objeto com os dados coletados nesta etapa (pode ser vazio {})\n` +
    `- Se o usuário mandar algo fora de contexto, responda brevemente e redirecione para o objetivo da etapa\n` +
    `- REGRA CRÍTICA: "step_completed" reflete SOMENTE se o critério de conclusão foi atingido pela mensagem do usuário — nada mais. ` +
    `Decidir fazer uma pergunta de esclarecimento na sua "reply" NÃO impede marcar "step_completed": true. ` +
    `Aprofundar o assunto é responsabilidade da PRÓXIMA etapa, não um motivo para adiar a conclusão desta.\n` +
    `- Nunca saia do JSON, nunca adicione texto fora dele` +
    transitionInstructions;

  const raw = await GroqService.generateReply(
    systemPrompt,
    userMessage,
    historyWithoutCurrent,
    2,
    true
  );

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    console.warn('[FlowHandler] IA retornou JSON inválido:', raw);
    return {
      reply: raw,
      step_completed: false,
      collected: {},
    };
  }
}

async function fetchStepHistory(conversationId) {
  return Message.findAll({
    where: { conversation_id: conversationId },
    attributes: ['role', 'content'],
    order: [['created_at', 'ASC']],
    limit: 11,
  });
}

async function closeFlowAndConversation(session, conversation, userId) {
  await session.update({ completed: true, current_step_id: null });

  try {
    await conversation.update({ status: 'closed' });

    await invalidateCache(userId, ['/conversations']);

    SocketService.emitToConversation(conversation.id, 'conversation:closed', {
      id: conversation.id,
      status: 'closed',
    });
  } catch (err) {
    console.error(
      '[FlowHandler] Erro ao encerrar conversa automaticamente:',
      err.message
    );
  }
}

export async function flowHandler(
  bot,
  conversation,
  instance,
  userMessage,
  phone
) {
  if (!bot.flow_id) return null;

  const lockKey = `flowlock:${conversation.id}`;
  const lockToken = randomUUID();
  const MAX_WAIT_MS = 15000;
  const POLL_INTERVAL_MS = 300;

  let lockAcquired = await redis.set(lockKey, lockToken, 'NX', 'EX', 30);
  let waited = 0;

  while (!lockAcquired && waited < MAX_WAIT_MS) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    waited += POLL_INTERVAL_MS;
    lockAcquired = await redis.set(lockKey, lockToken, 'NX', 'EX', 30);
  }

  if (!lockAcquired) {
    console.warn(
      `[FlowHandler] Conversa ${conversation.id} permaneceu travada por mais de ${MAX_WAIT_MS}ms, descartando mensagem para evitar travar o worker indefinidamente.`
    );
    return null;
  }

  try {
    const flow = await Flow.findOne({ where: { id: bot.flow_id } });
    if (!flow) return null;

    const session = await getOrCreateSession(conversation, flow);

    if (session.completed) return null;

    const step = session.currentStep;
    if (!step) return null;

    const nextStep = await FlowStep.findOne({
      where: {
        flow_id: flow.id,
        order: { [Op.gt]: step.order },
      },
      order: [['order', 'ASC']],
    });

    const history = await fetchStepHistory(conversation.id);

    const { reply, step_completed, collected } = await executeStep(
      bot,
      step,
      nextStep,
      userMessage,
      history
    );

    if (collected && Object.keys(collected).length > 0) {
      await session.update({ data: { ...session.data, ...collected } });
    }

    await MessageService.saveAndEmit({
      conversationId: conversation.id,
      content: reply,
      role: 'assistant',
    });

    try {
      await invalidateCache(bot.user_id, [
        '/conversations',
        `/conversations/${conversation.id}/messages`,
      ]);
    } catch (err) {
      console.error('[FlowHandler] Erro ao invalidar cache:', err.message);
    }

    try {
      await messageDeliveryService.safeSendText(instance, phone, reply);
    } catch (err) {
      console.error('[FlowHandler] Erro ao enviar WhatsApp:', err.message);
    }

    if (step_completed) {
      if (step.closes_conversation) {
        await closeFlowAndConversation(session, conversation, bot.user_id);
      } else if (nextStep) {
        await session.update({ current_step_id: nextStep.id });
      } else {
        console.warn(
          `[FlowHandler] Etapa "${step.content.substring(0, 50)}..." concluída sem closes_conversation marcado e sem próxima etapa cadastrada — encerrando por padrão.`
        );
        await closeFlowAndConversation(session, conversation, bot.user_id);
      }
    }

    return reply;
  } finally {
    await redis.eval(UNLOCK_SCRIPT, 1, lockKey, lockToken).catch((err) => {
      console.error('[FlowHandler] Erro ao liberar lock:', err.message);
    });
  }
}
