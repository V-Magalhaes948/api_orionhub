import { Op } from 'sequelize';

import { Queue, Worker } from 'bullmq';
import redis from '../queues/redis.js';
import Instance from '../models/Instance.js';
import SocketService from '../services/socketService.js';
import { getClient } from '../services/whatsAppService.js'; // ajuste pro seu setup real

const QUEUE_NAME = 'instance-status-sweep';
const SWEEP_INTERVAL_MS = 5 * 60 * 1000; // conexão de WhatsApp cai rápido, 5min é mais seguro que 15min
const CONCURRENCY_LIMIT = 8; // evita bombardear a Evolution API se você tiver muitas instâncias

export const instanceStatusQueue = new Queue(QUEUE_NAME, {
  connection: redis,
});

export function scheduleInstanceStatusSweep() {
  return instanceStatusQueue.add(
    'sweep',
    {},
    {
      repeat: { every: SWEEP_INTERVAL_MS },
      jobId: 'instance-status-sweep',
    }
  );
}

async function checkInstance(instance, evolutionClient) {
  try {
    const { data } = await evolutionClient.get(
      `/instance/connectionState/${instance.instance_id}`
    );

    const state = data?.instance?.state;
    const newStatus = state === 'open' ? 'connected' : 'disconnected';

    if (newStatus !== instance.status) {
      await instance.update({ status: newStatus });

      if (newStatus === 'disconnected') {
        SocketService.emitNotification(
          instance.user_id,
          'instance_disconnected',
          'Instância desconectada',
          `A instância "${instance.name}" caiu e não está mais recebendo/enviando mensagens.`,
          { instanceId: instance.id, instanceName: instance.name }
        );
      } else {
        SocketService.emitNotification(
          instance.user_id,
          'instance_reconnected',
          'Instância reconectada',
          `A instância "${instance.name}" voltou a ficar disponível.`,
          { instanceId: instance.id, instanceName: instance.name }
        );
      }
    }

    return { id: instance.id, status: newStatus };
  } catch (err) {
    console.error(
      `[InstanceStatusSweep] Falha ao checar instância ${instance.id}:`,
      err.message
    );
    return { id: instance.id, status: 'error' };
  }
}

async function runWithConcurrency(items, limit, task) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = items[index++];
      results.push(await task(current));
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

export const instanceStatusWorker = new Worker(
  QUEUE_NAME,
  async () => {
    const evolutionClient = getEvolutionClient();

    const instances = await Instance.findAll({
      where: { status: { [Op.in]: ['connected', 'disconnected'] } },
    });

    const results = await runWithConcurrency(
      instances,
      CONCURRENCY_LIMIT,
      (instance) => checkInstance(instance, evolutionClient)
    );

    return {
      total: instances.length,
      changed: results.filter((r) => r.status !== 'error').length,
    };
  },
  { connection: redis, concurrency: 1 }
);

instanceStatusWorker.on('failed', (job, err) => {
  console.error(`[InstanceStatusSweep] Job ${job.id} falhou:`, err.message);
});
