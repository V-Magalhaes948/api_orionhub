import Bot from '../models/Bot.js';
import Instance from '../models/Instance.js';
import { handleError } from '../utils/handleError.js';
import { invalidateCache } from '../middlewares/cache.js';
import { logActivity } from '../utils/logActivity.js';

const BOT_ATTRIBUTES = ['id', 'instance_id', 'name', 'mode', 'active'];

const BOT_DETAIL_ATTRIBUTES = [...BOT_ATTRIBUTES, 'user_id', 'system_prompt'];

class BotController {
  async index(req, res) {
    try {
      const bots = await Bot.findAll({
        where: { active: true, user_id: req.userId },
        attributes: BOT_ATTRIBUTES,
        include: [{ model: Instance, as: 'instance' }],
      });
      return res.status(200).json(bots);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async store(req, res) {
    try {
      const { name, system_prompt, instance_id, mode } = req.body;

      const instance = await Instance.findOne({
        where: { id: instance_id, status: 'connected', user_id: req.userId },
      });

      if (!instance) {
        return res
          .status(404)
          .json({ message: 'Instância não encontrada ou não conectada.' });
      }

      const instanceInUse = await Bot.findOne({ where: { instance_id } });
      if (instanceInUse) {
        return res
          .status(409)
          .json({ message: 'Instância já está vinculada a um bot.' });
      }

      const bot = await Bot.create({
        user_id: req.userId,
        name,
        system_prompt,
        instance_id,
        mode,
      });

      await logActivity({
        userId: req.userId,
        action: 'bot.created',
        resourceType: 'bot',
        resourceId: bot.id,
        metadata: { name: bot.name, mode: bot.mode },
        ip: req.ip,
      });

      await invalidateCache(req.userId, ['/bots']);

      return res
        .status(201)
        .json({ message: 'Bot criado com sucesso.', botId: bot.id });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async show(req, res) {
    try {
      const bot = await Bot.findOne({
        where: { id: req.params.id, user_id: req.userId },
        attributes: BOT_DETAIL_ATTRIBUTES,
        include: [{ model: Instance, as: 'instance' }],
      });

      if (!bot) {
        return res.status(404).json({ message: 'Bot não encontrado.' });
      }

      return res.status(200).json(bot);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async update(req, res) {
    try {
      const { name, system_prompt, mode } = req.body;

      const bot = await Bot.findOne({
        where: { id: req.params.id, user_id: req.userId },
      });

      if (!bot) {
        return res.status(404).json({ message: 'Bot não encontrado.' });
      }

      await bot.update({ name, system_prompt, mode });

      await logActivity({
        userId: req.userId,
        action: 'bot.updated',
        resourceType: 'bot',
        resourceId: bot.id,
        metadata: { name: bot.name },
        ip: req.ip,
      });

      await invalidateCache(req.userId, ['/bots']);

      return res
        .status(200)
        .json({ message: 'Bot atualizado com sucesso.', botId: bot.id });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async destroy(req, res) {
    try {
      const bot = await Bot.findOne({
        where: { id: req.params.id, user_id: req.userId },
      });

      if (!bot) {
        return res.status(404).json({ message: 'Bot não encontrado.' });
      }

      await bot.destroy();

      await logActivity({
        userId: req.userId,
        action: 'bot.deleted',
        resourceType: 'bot',
        resourceId: bot.id,
        metadata: { name: bot.name },
        ip: req.ip,
      });

      await invalidateCache(req.userId, ['/bots']);

      return res
        .status(200)
        .json({ message: 'Bot excluído com sucesso.', botId: bot.id });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new BotController();
