import GroqService from '../../services/groqService.js';
import Message from '../../models/Message.js';
import MessageService from '../../services/messageService.js';

export default async function aiHandler(bot, conversation, userMessage) {
  const history = await Message.findAll({
    where: { conversation_id: conversation.id },
    attributes: ['role', 'content'],
    order: [['created_at', 'ASC']],
    limit: 10,
  });

  const historyWithoutCurrent = history.slice(0, -1);

  const reply = await GroqService.generateReply(
    bot.system_prompt,
    userMessage,
    historyWithoutCurrent
  );

  const savedMessage = await MessageService.saveAndEmit({
    conversationId: conversation.id,
    content: reply,
    role: 'assistant',
  });

  return { reply, savedMessage };
}
