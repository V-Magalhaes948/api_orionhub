import axios from 'axios';

import Instance from '../models/Instance.js';
import Product from '../models/Product.js';
import { invalidateCache } from '../middlewares/cache.js';
import { getEffectiveProductLimit } from '../utils/generateProductLimit.js';
import { io } from '../server.js';

function getEvolutionClient() {
  return axios.create({
    baseURL: process.env.EVOLUTION_BASE_URL,
    headers: {
      apikey: process.env.EVOLUTION_API_KEY,
      'Content-Type': 'application/json',
    },
  });
}

async function disconnectUserInstances(userId) {
  const instances = await Instance.findAll({ where: { user_id: userId } });
  if (instances.length === 0) return;

  const evolutionClient = getEvolutionClient();

  await Promise.all(
    instances.map(async (instance) => {
      if (instance.status !== 'connected') {
        return;
      }
      try {
        await evolutionClient.delete(
          `/instance/logout/${instance.instance_id}`
        );
      } catch (err) {
        console.warn(
          `[planExpiration] Falha ao desconectar instância ${instance.instance_id}:`,
          err.response?.data || err.message
        );
      } finally {
        await instance.update({ status: 'disconnected' });
      }
    })
  );

  await invalidateCache(userId, ['/instances']);
}

async function deactivateUserProducts(userId) {
  const [affected] = await Product.update(
    { active: false },
    { where: { user_id: userId, active: true } }
  );

  if (affected > 0) {
    await invalidateCache(userId, ['/products']);
  }
}

export async function expireUserAccess(user) {
  await Promise.all([
    disconnectUserInstances(user.id),
    deactivateUserProducts(user.id),
  ]);

  if (user.plan_status !== 'expired') {
    await user.update({ plan_status: 'expired' });
  }
}

export async function expireUserAddon(user) {
  await user.update({ addon_id: null, addon_status: 'expired' });

  const newLimit = getEffectiveProductLimit({ ...user.toJSON(), addon: null });
  const activeCount = await Product.count({
    where: { user_id: user.id, active: true },
  });

  if (activeCount > newLimit) {
    await user.update({ product_selection_pending: true });

    await SocketService.emitNotification(
      user.id,
      'product_selection_required',
      'Selecione seus produtos ativos',
      `Seu addon expirou. Selecione até ${newLimit} produtos para manter ativos no catálogo.`
    );
  }

  await invalidateCache(user.id, ['/products']);
}
