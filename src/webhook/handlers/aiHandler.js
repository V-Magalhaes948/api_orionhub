import GeminiService from '../../services/GeminiService.js';
import Message from '../../models/Message.js';

export default async function aiHandler(bot, conversation, userMessage) {
  // busca últimas 10 mensagens pra contexto
  const history = await Message.findAll({
    where: { conversation_id: conversation.id },
    attributes: ['role', 'content'],
    order: [['created_at', 'ASC']],
    limit: 10,
  });

  const reply = await GeminiService.generateReply(
    bot.system_prompt,
    userMessage,
    history
  );

  await Message.create({
    conversation_id: conversation.id,
    content: reply,
    role: 'assistant',
  });

  return reply;
}
