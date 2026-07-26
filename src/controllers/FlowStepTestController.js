import Bot from '../models/Bot.js';
import Flow from '../models/Flow.js';

import { handleError } from '../utils/handleError.js';
import { executeStep } from '../webhook/handlers/flowHandler.js';

class FlowStepTestController {
  async store(req, res) {
    try {
      const {
        content,
        completion_criteria,
        closes_conversation,
        next_step_content,
        user_message,
        history,
      } = req.body;

      const { botId } = req.params;

      const bot = await Bot.findOne({
        where: { id: botId, user_id: req.userId },
      });

      if (!bot) {
        return res.status(404).json({ message: 'Bot not found' });
      }

      if (!bot.flow_id) {
        return res.status(404).json({ message: 'Flow not found' });
      }

      const flow = await Flow.findByPk(bot.flow_id);

      if (flow.test_count >= 5) {
        return res.status(429).json({
          message: 'Limite de 5 testes por fluxo atingido',
          test_count: flow.test_count,
        });
      }

      const fakeStep = { content, completion_criteria, closes_conversation };
      const fakeNextStep = next_step_content
        ? { content: next_step_content }
        : null;

      const historyWithCurrentMessage = [
        ...history,
        { role: 'user', content: user_message },
      ];

      const result = await executeStep(
        bot,
        fakeStep,
        fakeNextStep,
        user_message,
        historyWithCurrentMessage
      );

      await flow.increment('test_count');
      await flow.reload();

      return res.status(200).json({ ...result, test_count: flow.test_count });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new FlowStepTestController();
