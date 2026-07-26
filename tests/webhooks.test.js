import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/queues/webhookQueue.js', () => ({
  webhookQueue: { add: vi.fn(async () => {}) },
}));

vi.mock('../src/utils/logActivity.js', () => ({
  logActivity: vi.fn(async () => {}),
}));

vi.mock('../src/middlewares/cache.js', () => ({
  invalidateCache: vi.fn(async () => {}),
  cacheMiddleware: () => (req, res, next) => next(),
}));

import app from '../src/app.js';
import { webhookQueue } from '../src/queues/webhookQueue.js';

const SECRET = process.env.WEBHOOK_SECRET;

function validPayload(overrides = {}) {
  return {
    event: 'message.received',
    instance: 'instancia-1',
    data: { from: '5511999999999', text: 'Olá' },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Webhook — POST /webhook — autenticação por secret', () => {
  it('rejeita quando o query param secret está ausente', async () => {
    const res = await request(app).post('/webhook').send(validPayload());

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Unauthorized');
    expect(webhookQueue.add).not.toHaveBeenCalled();
  });

  it('rejeita quando o secret está incorreto', async () => {
    const res = await request(app)
      .post('/webhook')
      .query({ secret: 'secret-errado' })
      .send(validPayload());

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Unauthorized');
    expect(webhookQueue.add).not.toHaveBeenCalled();
  });

  it(
    'a verificação de secret roda antes da validação do body — um body ' +
      'inválido com secret errado retorna 401 (auth), não 400 (validação)',
    async () => {
      const res = await request(app)
        .post('/webhook')
        .query({ secret: 'secret-errado' })
        .send({ event: '' });

      expect(res.status).toBe(401);
    }
  );
});

describe('Webhook — POST /webhook — validação do body', () => {
  it('rejeita quando event está ausente ou vazio', async () => {
    const payload = validPayload();
    delete payload.event;

    const res = await request(app)
      .post('/webhook')
      .query({ secret: SECRET })
      .send(payload);

    expect(res.status).toBe(400);
    expect(webhookQueue.add).not.toHaveBeenCalled();
  });

  it('rejeita quando data está ausente (data é obrigatório no schema, sem .optional())', async () => {
    const payload = validPayload();
    delete payload.data;

    const res = await request(app)
      .post('/webhook')
      .query({ secret: SECRET })
      .send(payload);

    expect(res.status).toBe(400);
    expect(webhookQueue.add).not.toHaveBeenCalled();
  });

  it('aceita quando instance está ausente (campo opcional no schema)', async () => {
    const payload = validPayload();
    delete payload.instance;

    const res = await request(app)
      .post('/webhook')
      .query({ secret: SECRET })
      .send(payload);

    expect(res.status).toBe(200);
    expect(webhookQueue.add).toHaveBeenCalledTimes(1);
  });
});

describe('Webhook — POST /webhook — processamento', () => {
  it('responde 200 "EVENT_RECEIVED" e enfileira o job com o evento e o body inteiro', async () => {
    const payload = validPayload({ event: 'message.received' });

    const res = await request(app)
      .post('/webhook')
      .query({ secret: SECRET })
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.text).toBe('EVENT_RECEIVED');

    expect(webhookQueue.add).toHaveBeenCalledTimes(1);
    const [jobName, jobData, jobOptions] = webhookQueue.add.mock.calls[0];
    expect(jobName).toBe('message.received');
    expect(jobData).toEqual(payload);
    expect(jobOptions.jobId).toMatch(/^message\.received-/);
  });

  it('gera um jobId único por requisição, mesmo para o mesmo evento', async () => {
    const payload = validPayload({ event: 'message.received' });

    await request(app).post('/webhook').query({ secret: SECRET }).send(payload);
    await request(app).post('/webhook').query({ secret: SECRET }).send(payload);

    const [, , firstOptions] = webhookQueue.add.mock.calls[0];
    const [, , secondOptions] = webhookQueue.add.mock.calls[1];
    expect(firstOptions.jobId).not.toBe(secondOptions.jobId);
  });

  it(
    'NOTA — quando webhookQueue.add falha, a resposta ainda é 200, porque ' +
      'o send() acontece antes do try/catch que enfileira o job. O erro só ' +
      'vai pro console.error; quem envia o webhook nunca fica sabendo que o ' +
      'evento não foi enfileirado. Documentando o comportamento atual — pode ' +
      'valer a pena um alerta/log estruturado aqui, já que hoje é silencioso.',
    async () => {
      webhookQueue.add.mockRejectedValueOnce(new Error('Redis indisponível'));

      const res = await request(app)
        .post('/webhook')
        .query({ secret: SECRET })
        .send(validPayload());

      expect(res.status).toBe(200);
      expect(res.text).toBe('EVENT_RECEIVED');
    }
  );
});
