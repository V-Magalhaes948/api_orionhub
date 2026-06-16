import Instance from '../models/Instance.js';
import { handleError } from '../utils/handleError.js';
import axios from 'axios';

const INSTANCE_ATTRIBUTES = [
  'id',
  'user_id',
  'instance_id',
  'instance_token',
  'phone_number',
  'status',
  'created_at',
  'updated_at',
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
      const { instance_id } = req.body;
      const evolutionClient = this.#getEvolutionClient();

      const existing = await Instance.findOne({ where: { instance_id } });
      if (existing) {
        return res.status(409).json({ message: 'Instance already exists' });
      }

      // 1. Cria a instância na Evolution API
      const { data: evolutionData } = await evolutionClient.post(
        '/instance/create',
        {
          instanceName: instance_id,
          integration: 'WHATSAPP-BAILEYS',
        }
      );

      const instance_token = evolutionData.hash;

      // 2. Registra o webhook na Evolution
      await evolutionClient.post(`/webhook/set/${instance_id}`, {
        webhook: {
          enabled: true,
          url: `${process.env.APP_URL}/webhook`,
          webhookByEvents: false,
          webhookBase64: false,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
      });

      // 3. Salva no banco
      const instance = await Instance.create({
        user_id: req.userId,
        instance_id,
        instance_token,
        status: 'pending',
      });

      return res.status(201).json({
        message: 'Instance created successfully',
        instance,
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
        return res.status(404).json({ message: 'Instance not found' });
      }

      if (instance.status === 'connected') {
        return res.status(400).json({ message: 'Instance already connected' });
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
        return res.status(404).json({ message: 'Instance not found' });
      }

      const { data } = await evolutionClient.get(
        `/instance/connectionState/${instance.instance_id}`
      );

      const state = data?.instance?.state;
      const newStatus = state === 'open' ? 'connected' : 'disconnected';

      await instance.update({ status: newStatus });

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
        return res.status(404).json({ message: 'Instance not found' });
      }

      // Remove da Evolution antes de deletar do banco
      await evolutionClient.delete(`/instance/delete/${instance.instance_id}`);

      await instance.destroy();

      return res.status(200).json({ message: 'Instance deleted successfully' });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new InstanceController();
