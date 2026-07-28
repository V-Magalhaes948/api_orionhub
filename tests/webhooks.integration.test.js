import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { QueueEvents } from 'bullmq';
import redis from '../src/queues/redis.js';
import request from 'supertest';
import { randomUUID } from 'crypto';

import User from '../src/models/User.js';
import Plan from '../src/models/Plan.js';

vi.mock('../src/webhook/handlers/flowHandler.js', () => ({
  flowHandler: vi.fn(async () => null),
}));
vi.mock('../src/webhook/handlers/aiHandler.js', () => ({
  default: vi.fn(async () => ({ reply: 'ok' })),
}));

vi.mock('../src/middlewares/planLimits.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    checkMessageLimit: vi.fn(async () => true),
  };
});

vi.mock('../src/services/contactIdentityService.js', () => ({
  default: {
    isSamePhoneNumber: vi.fn(() => false),
    findPhoneByLid: vi.fn(async () => null),
    upsertIdentity: vi.fn(async () => {}),
  },
}));
vi.mock('../src/services/messageDeliveryService.js', () => ({
  default: { safeSendText: vi.fn(async () => {}) },
}));
vi.mock('../src/services/socketService.js', () => ({
  default: {
    emitNotification: vi.fn(),
    emitToConversation: vi.fn(),
  },
}));

import app from '../src/app.js';
import { webhookQueue } from '../src/queues/webhookQueue.js';
import '../src/workers/webhookWorker.js'; // ⚠️ confirma esse é o caminho real do worker
import MessageService from '../src/services/messageService.js';
import Instance from '../src/models/Instance.js';
import Bot from '../src/models/Bot.js';
import Message from '../src/models/Message.js';

const SECRET = process.env.WEBHOOK_SECRET;
const queueEvents = new QueueEvents('webhook', { connection: redis });

async function waitForJobCompletion(jobId, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Job ${jobId} não terminou a tempo`));
    }, timeoutMs);

    function onCompleted({ jobId: completedId }) {
      if (completedId === jobId) {
        cleanup();
        resolve({ state: 'completed' });
      }
    }

    function onFailed({ jobId: failedId, failedReason }) {
      if (failedId === jobId) {
        cleanup();
        resolve({ state: 'failed', reason: failedReason });
      }
    }

    function cleanup() {
      clearTimeout(timer);
      queueEvents.off('completed', onCompleted);
      queueEvents.off('failed', onFailed);
    }

    queueEvents.on('completed', onCompleted);
    queueEvents.on('failed', onFailed);
  });
}

async function createInstanceWithBot() {
  const plan = await Plan.create({
    name: 'Plano Teste',
    max_instances: 10,
    max_products: 100,
    max_messages_per_month: 999999,
    price: 0,
  });

  const user = await User.create({
    name: 'Usuário Teste',
    email: `user-teste-${randomUUID()}@orionhub.dev`,
    password: 'senha123',
  });

  const instance = await Instance.create({
    user_id: user.id,
    instance_id: `inst-${randomUUID()}`,
    instance_token: 'token',
    status: 'connected',
    phone_number: '5512999990000',
  });

  const bot = await Bot.create({
    user_id: user.id,
    instance_id: instance.id,
    name: 'Bot Teste',
    mode: 'manual',
    active: true,
  });

  return { user, instance, bot };
}

function upsertPayload(instanceId, messageId, text = 'Oi, tudo bem?') {
  return {
    event: 'messages.upsert',
    instance: instanceId,
    data: {
      key: {
        id: messageId,
        remoteJid: '5512988887777@s.whatsapp.net',
        fromMe: false,
      },
      pushName: 'Contato Teste',
      message: { conversation: text },
    },
  };
}

describe('Webhook — Idempotência ponta a ponta (fila real + worker real)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await webhookQueue.drain(true);
  });

  afterAll(async () => {
    await webhookQueue.close();
    await queueEvents.close();
  });

  it('camada 1 — dois POSTs idênticos geram o mesmo jobId, então só 1 job é processado', async () => {
    const { instance } = await createInstanceWithBot();
    const messageId = `wamid.${randomUUID()}`;
    const payload = upsertPayload(instance.instance_id, messageId);

    await Promise.all([
      request(app).post('/webhook').query({ secret: SECRET }).send(payload),
      request(app).post('/webhook').query({ secret: SECRET }).send(payload),
    ]);

    const jobId = `messages.upsert-${instance.instance_id}-${messageId}`;
    const result = await waitForJobCompletion(jobId);

    // se falhou, mostra a razão real em vez de só "0 mensagens salvas"
    expect(result.state, result.reason).toBe('completed');

    await new Promise((r) => setTimeout(r, 300));

    const saved = await Message.findAll({ where: { message_id: messageId } });
    expect(saved).toHaveLength(1);
  });

  it('camada 2 — retry após o job já ter completado ainda não duplica a mensagem (findByMessageId + unique constraint)', async () => {
    const { instance } = await createInstanceWithBot();
    const messageId = `wamid.${randomUUID()}`;
    const payload = upsertPayload(instance.instance_id, messageId);
    const jobId = `messages.upsert-${instance.instance_id}-${messageId}`; // <-- faltava essa linha

    await request(app).post('/webhook').query({ secret: SECRET }).send(payload);
    await waitForJobCompletion(jobId);
    await new Promise((r) => setTimeout(r, 300));

    await request(app).post('/webhook').query({ secret: SECRET }).send(payload);
    const secondState = await waitForJobCompletion(jobId);
    await new Promise((r) => setTimeout(r, 300));

    expect(secondState.state, secondState.reason).toBe('completed');

    const saved = await Message.findAll({ where: { message_id: messageId } });
    expect(saved).toHaveLength(1);
  });
});
