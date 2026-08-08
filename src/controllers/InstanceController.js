import axios from 'axios';
import { randomUUID } from 'crypto';
import { Op } from 'sequelize';

import Instance from '../models/Instance.js';
import Bot from '../models/Bot.js';
import Flow from '../models/Flow.js';
import FlowStep from '../models/FlowStep.js';
import FlowSession from '../models/FlowSession.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';

import { handleError } from '../utils/handleError.js';
import { invalidateCache } from '../middlewares/cache.js';
import { slugify } from '../utils/slugify.js';
import { logActivity } from '../utils/logActivity.js';
import { getEffectiveInstanceLimit } from '../utils/generateInstanceLimit.js';

const INSTANCE_ATTRIBUTES = [
  'id',
  'name',
  'instance_id',
  'phone_number',
  'status',
];

class InstanceController {
  #getEvolutionClient() {
    return axios.create({
      baseURL: process.env.EVOLUTION_BASE_URL,
      headers: {
        apikey: process.env.EVOLUTION_API_KEY,
        'Content-Type': 'application/json',
      },
    });
  }

  async index(req, res) {
    try {
      const instances = await Instance.findAll({
        where: { user_id: req.userId },
        attributes: INSTANCE_ATTRIBUTES,
      });

      return res.status(200).json(instances);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async store(req, res) {
    try {
      const { name } = req.body;

      const instance_id = `${slugify(name)}-${randomUUID().slice(0, 8)}`;

      const evolutionClient = this.#getEvolutionClient();

      const { data: evolutionData } = await evolutionClient.post(
        '/instance/create',
        {
          instanceName: instance_id,
          integration: 'WHATSAPP-BAILEYS',
        }
      );

      const instance_token = evolutionData.hash;

      await evolutionClient.post(`/webhook/set/${instance_id}`, {
        webhook: {
          enabled: true,
          url: `${process.env.WEBHOOK_INTERNAL_URL}/webhook`,
          headers: {
            'x-webhook-secret': process.env.WEBHOOK_SECRET,
          },
          webhookByEvents: false,
          webhookBase64: false,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
      });

      const instance = await Instance.create({
        user_id: req.userId,
        name,
        instance_id,
        instance_token,
        status: 'disconnected',
      });

      await logActivity({
        userId: req.userId,
        action: 'instance.created',
        resourceType: 'instance',
        resourceId: instance.id,
        metadata: { name: instance.name },
        ip: req.ip,
      });

      await invalidateCache(req.userId, ['/instances']);

      return res.status(201).json({
        message: 'Instância criada com sucesso.',
        instanceId: instance.id,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async qrcode(req, res) {
    try {
      const evolutionClient = this.#getEvolutionClient();

      const instance = await Instance.findOne({
        where: { id: req.params.id, user_id: req.userId },
      });

      if (!instance) {
        return res.status(404).json({ message: 'Instância não encontrada.' });
      }

      if (instance.status === 'connected') {
        return res
          .status(400)
          .json({ message: 'Instância já está conectada.' });
      }

      const { data } = await evolutionClient.get(
        `/instance/connect/${instance.instance_id}`
      );

      return res.status(200).json({ qrcode: data.base64 });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async status(req, res) {
    try {
      const evolutionClient = this.#getEvolutionClient();

      const instance = await Instance.findOne({
        where: { id: req.params.id, user_id: req.userId },
      });

      if (!instance) {
        return res.status(404).json({ message: 'Instância não encontrada.' });
      }

      const { data } = await evolutionClient.get(
        `/instance/connectionState/${instance.instance_id}`
      );

      const state = data?.instance?.state;
      const newStatus = state === 'open' ? 'connected' : 'disconnected';

      await instance.update({ status: newStatus });

      await invalidateCache(req.userId, ['/instances']);

      return res.status(200).json({
        status: instance.status,
        phone_number: instance.phone_number,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async destroy(req, res) {
    try {
      const evolutionClient = this.#getEvolutionClient();

      const instance = await Instance.findOne({
        where: { id: req.params.id, user_id: req.userId },
      });

      if (!instance) {
        return res.status(404).json({ message: 'Instância não encontrada.' });
      }

      const botExist = await Bot.findOne({
        where: { instance_id: instance.id, user_id: req.userId },
      });

      if (botExist) {
        return res.status(409).json({
          message:
            'Instância tem um bot conectado, não é possível excluir a instância.',
        });
      }

      try {
        await evolutionClient.delete(
          `/instance/delete/${instance.instance_id}`
        );
      } catch (err) {
        console.warn(
          `[InstanceController] Falha ao remover instância ${instance.instance_id} na Evolution API (prosseguindo com a exclusão local):`,
          err.response?.data || err.message
        );
      }

      await instance.destroy();

      await logActivity({
        userId: req.userId,
        action: 'instance.deleted',
        resourceType: 'instance',
        resourceId: instance.id,
        metadata: { name: instance.name },
        ip: req.ip,
      });

      await invalidateCache(req.userId, ['/instances']);

      return res.status(200).json({
        message: 'Instância excluída com sucesso.',
        instanceId: instance.id,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async selectionStatus(req, res) {
    try {
      const user = await User.findByPk(req.userId, {
        attributes: ['id', 'instance_selection_pending', 'plan_id'],
        include: [
          {
            model: Plan,
            as: 'plan',
            attributes: ['id', 'name', 'max_instances'],
          },
        ],
      });

      const limit = getEffectiveInstanceLimit(user);

      const instances = await Instance.findAll({
        where: { user_id: req.userId },
        attributes: ['id', 'name', 'phone_number', 'status', 'created_at'],
        order: [['created_at', 'DESC']],
      });

      return res.status(200).json({
        pending: user.instance_selection_pending,
        limit,
        instances,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async confirmSelection(req, res) {
    const t = await Instance.sequelize.transaction();

    try {
      const { activeInstanceIds } = req.body;

      if (!Array.isArray(activeInstanceIds)) {
        await t.rollback();
        return res
          .status(400)
          .json({ message: 'activeInstanceIds deve ser um array' });
      }

      const uniqueIds = [...new Set(activeInstanceIds)];

      const user = await User.findByPk(req.userId, {
        include: [{ model: Plan, as: 'plan' }],
      });

      const limit = getEffectiveInstanceLimit(user);

      if (uniqueIds.length > limit) {
        await t.rollback();
        return res
          .status(400)
          .json({ message: `Selecione no máximo ${limit} instâncias` });
      }

      const allInstances = await Instance.findAll({
        where: { user_id: user.id },
        transaction: t,
      });

      const owned = allInstances.filter((i) => uniqueIds.includes(i.id));
      if (owned.length !== uniqueIds.length) {
        await t.rollback();
        return res
          .status(400)
          .json({ message: 'IDs inválidos ou não pertencem a este usuário' });
      }

      const toDelete = allInstances.filter((i) => !uniqueIds.includes(i.id));

      for (const instance of toDelete) {
        const bot = await Bot.findOne({
          where: { instance_id: instance.id },
          transaction: t,
        });

        if (bot) {
          const conversations = await Conversation.findAll({
            where: { bot_id: bot.id },
            attributes: ['id'],
            transaction: t,
          });
          const conversationIds = conversations.map((c) => c.id);

          if (conversationIds.length > 0) {
            await Message.destroy({
              where: { conversation_id: { [Op.in]: conversationIds } },
              transaction: t,
            });
            await Conversation.destroy({
              where: { id: { [Op.in]: conversationIds } },
              transaction: t,
            });
          }

          if (bot.flow_id) {
            const flowId = bot.flow_id;
            await FlowSession.destroy({
              where: { flow_id: flowId },
              transaction: t,
            });
            await FlowStep.destroy({
              where: { flow_id: flowId },
              transaction: t,
            });
            await bot.update({ flow_id: null }, { transaction: t });
            await Flow.destroy({ where: { id: flowId }, transaction: t });
          }

          await bot.destroy({ transaction: t });
        }

        await instance.destroy({ transaction: t });
      }

      await user.update(
        { instance_selection_pending: false },
        { transaction: t }
      );

      await logActivity({
        userId: user.id,
        action: 'instance.selection_confirmed',
        resourceType: 'user',
        resourceId: user.id,
        metadata: {
          active_count: uniqueIds.length,
          deleted_count: toDelete.length,
          limit,
        },
        ip: req.ip,
      });

      await t.commit();

      await invalidateCache(user.id, [
        '/instances',
        '/bots',
        '/conversations',
        '/flows',
      ]);

      res.status(200).json({ message: 'Seleção confirmada com sucesso' });

      const evolutionClient = this.#getEvolutionClient();
      for (const instance of toDelete) {
        evolutionClient
          .delete(`/instance/delete/${instance.instance_id}`)
          .catch((err) => {
            console.warn(
              `[InstanceController] Falha ao remover instância ${instance.instance_id} na Evolution API pós-seleção:`,
              err.response?.data || err.message
            );
          });
      }
    } catch (error) {
      await t.rollback();
      return handleError(res, error);
    }
  }
}

export default new InstanceController();
