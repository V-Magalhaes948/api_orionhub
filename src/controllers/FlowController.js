import Flow from '../models/Flow.js';
import FlowStep from '../models/FlowStep.js';
import Bot from '../models/Bot.js';

import { handleError } from '../utils/handleError.js';
import { logActivity } from '../utils/logActivity.js';

class FlowController {
  async show(req, res) {
    try {
      const bot = await Bot.findOne({
        where: { id: req.params.botId, user_id: req.userId },
      });

      if (!bot) return res.status(404).json({ message: 'Bot não encontrado.' });
      if (!bot.flow_id) return res.status(200).json(null);

      const flow = await Flow.findOne({
        where: { id: bot.flow_id },
        include: [{ model: FlowStep, as: 'steps' }],
        order: [[{ model: FlowStep, as: 'steps' }, 'order', 'ASC']],
      });

      return res.status(200).json(flow);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async store(req, res) {
    try {
      const { steps, include_catalog } = req.body;

      const bot = await Bot.findOne({
        where: { id: req.params.botId, user_id: req.userId },
      });

      if (!bot) return res.status(404).json({ message: 'Bot não encontrado.' });
      if (bot.flow_id)
        return res.status(409).json({ message: 'Bot já tem um fluxo.' });

      const flow = await Flow.create({ include_catalog: !!include_catalog });

      await FlowStep.bulkCreate(
        steps.map((step, index) => ({
          flow_id: flow.id,
          order: index + 1,
          content: step.content,
          completion_criteria: step.completion_criteria,
          closes_conversation: step.closes_conversation,
          hands_off_to_human: step.hands_off_to_human,
        }))
      );

      await bot.update({ flow_id: flow.id });

      await logActivity({
        userId: req.userId,
        action: 'flow.created',
        resourceType: 'flow',
        resourceId: flow.id,
        metadata: { bot_id: bot.id },
        ip: req.ip,
      });

      return res
        .status(201)
        .json({ message: 'Flow criado com sucesso.', flow: flow.id });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async update(req, res) {
    try {
      const { steps, include_catalog } = req.body;

      const bot = await Bot.findOne({
        where: { id: req.params.botId, user_id: req.userId },
      });

      if (!bot) return res.status(404).json({ message: 'Bot não encontrado.' });
      if (!bot.flow_id)
        return res.status(404).json({ message: 'Flow não encontrado.' });

      await Flow.update(
        { include_catalog: !!include_catalog },
        { where: { id: bot.flow_id } }
      );

      await FlowStep.destroy({ where: { flow_id: bot.flow_id } });

      await FlowStep.bulkCreate(
        steps.map((step, index) => ({
          flow_id: bot.flow_id,
          order: index + 1,
          content: step.content,
          completion_criteria: step.completion_criteria,
          closes_conversation: step.closes_conversation,
          hands_off_to_human: step.hands_off_to_human,
        }))
      );

      await logActivity({
        userId: req.userId,
        action: 'flow.updated',
        resourceType: 'flow',
        resourceId: bot.flow_id,
        metadata: { bot_id: bot.id },
        ip: req.ip,
      });

      return res
        .status(200)
        .json({ message: 'Flow atualizado com sucesso.', flowId: bot.flow_id });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async destroy(req, res) {
    try {
      const bot = await Bot.findOne({
        where: { id: req.params.botId, user_id: req.userId },
      });

      if (!bot) return res.status(404).json({ message: 'Bot não encontrado.' });
      if (!bot.flow_id)
        return res.status(404).json({ message: 'Flow não encontrado.' });

      const flowId = bot.flow_id;

      await bot.update({ flow_id: null });
      await Flow.destroy({ where: { id: flowId } });

      await logActivity({
        userId: req.userId,
        action: 'flow.deleted',
        resourceType: 'flow',
        resourceId: flowId,
        metadata: { bot_id: bot.id },
        ip: req.ip,
      });

      return res
        .status(200)
        .json({ message: 'Flow excluído com sucesso.', flowId: flowId });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new FlowController();
