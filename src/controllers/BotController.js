import Bot from '../models/Bot.js';
import { handleError } from '../utils/handleError.js';

const BOT_ATTRIBUTES = [
  'id',
  'user_id',
  'name',
  'phone_number',
  'system_prompt',
  'active',
  'created_at',
  'updated_at',
];

class BotController {
  async index(req, res) {
    try {
      const bots = await Bot.findAll({
        where: { active: true, user_id: req.userId },
        attributes: BOT_ATTRIBUTES,
      });
      return res.status(200).json(bots);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async store(req, res) {
    try {
      const { name, phone_number, system_prompt } = req.body;

      const bot = await Bot.create({
        user_id: req.userId,
        name,
        phone_number,
        system_prompt,
      });

      return res.status(201).json({ message: 'Bot created sucessfully', bot });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async show(req, res) {
    try {
      const bot = await Bot.findOne({
        where: {
          id: req.params.id,
          user_id: req.userId,
        },
        attributes: BOT_ATTRIBUTES,
      });

      if (!bot) {
        return res.status(404).json({ message: 'Bot not found' });
      }
      return res.status(200).json(bot);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async update(req, res) {
    try {
      const { name, phone_number, system_prompt } = req.body;
      const bot = await Bot.findOne({
        where: {
          id: req.params.id,
          user_id: req.userId,
        },
      });

      if (!bot) {
        return res.status(404).json({ message: 'Bot not found' });
      }

      await bot.update({ name, phone_number, system_prompt });
      return res.status(200).json({ message: 'Bot updated successfully', bot });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async destroy(req, res) {
    try {
      const bot = await Bot.findOne({
        where: {
          id: req.params.id,
          user_id: req.userId,
        },
      });

      if (!bot) {
        return res.status(404).json({ message: 'Bot not found' });
      }

      await bot.update({ active: false });
      return res.status(200).json({ message: 'Bot deleted successfully' });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new BotController();
