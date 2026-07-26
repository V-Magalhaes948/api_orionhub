import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

vi.mock('axios', () => ({
  default: { create: vi.fn() },
}));

import axios from 'axios';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Plan from '../src/models/Plan.js';
import Instance from '../src/models/Instance.js';
import Bot from '../src/models/Bot.js';

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.TOKEN_SECRET, {
    expiresIn: '1h',
  });
}

async function createPlan(overrides = {}) {
  return Plan.create({
    name: 'Plano Teste',
    max_instances: 2,
    max_products: 10,
    max_messages_per_month: 1000,
    price: 49.9,
    ...overrides,
  });
}

async function createUserWithPlan(planOverrides = {}, userOverrides = {}) {
  const plan = await createPlan(planOverrides);
  const user = await User.create({
    name: 'Instance Teste',
    email: `instance-teste-${randomUUID()}@orionhub.dev`,
    password: 'senha123',
    plan_id: plan.id,
    plan_status: 'active',
    plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...userOverrides,
  });
  const token = generateToken(user.id);
  return { user, plan, token };
}

function mockEvolutionClient({
  createResponse,
  webhookResponse,
  getResponse,
  deleteResponse,
  deleteRejects,
} = {}) {
  const client = {
    post: vi.fn((path) => {
      if (path === '/instance/create') {
        return Promise.resolve({
          data: createResponse ?? { hash: 'token-fake-evolution' },
        });
      }
      if (path.startsWith('/webhook/set/')) {
        return Promise.resolve({ data: webhookResponse ?? {} });
      }
      return Promise.resolve({ data: {} });
    }),
    get: vi.fn(() => Promise.resolve({ data: getResponse ?? {} })),
    delete: vi.fn(() =>
      deleteRejects
        ? Promise.reject(new Error('Evolution API indisponível'))
        : Promise.resolve({ data: deleteResponse ?? {} })
    ),
  };
  axios.create.mockReturnValue(client);
  return client;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Instances — Store (criação)', () => {
  it('cria uma instância e chama a Evolution API (create + webhook)', async () => {
    const { token } = await createUserWithPlan();
    const client = mockEvolutionClient({
      createResponse: { hash: 'abc123token' },
    });

    const res = await request(app)
      .post('/instances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Minha Instância' });

    expect(res.status).toBe(201);
    expect(res.body.instanceId).toBeDefined();
    expect(client.post).toHaveBeenCalledWith(
      '/instance/create',
      expect.objectContaining({ integration: 'WHATSAPP-BAILEYS' })
    );
    expect(client.post).toHaveBeenCalledWith(
      expect.stringMatching(/^\/webhook\/set\//),
      expect.any(Object)
    );

    const saved = await Instance.findByPk(res.body.instanceId);
    expect(saved.instance_token).toBe('abc123token');
    expect(saved.status).toBe('disconnected');
  });

  it('permite admin criar instância mesmo sem plano atribuído', async () => {
    const user = await User.create({
      name: 'Admin Teste',
      email: `admin-teste-${randomUUID()}@orionhub.dev`,
      password: 'senha123',
      is_admin: true,
    });
    const token = generateToken(user.id);
    const client = mockEvolutionClient({
      createResponse: { hash: 'admin-token' },
    });

    const res = await request(app)
      .post('/instances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Instância Admin' });

    expect(res.status).toBe(201);
    expect(client.post).toHaveBeenCalledWith(
      '/instance/create',
      expect.objectContaining({ integration: 'WHATSAPP-BAILEYS' })
    );
  });

  it('bloqueia criação quando atingiu o limite de instâncias do plano', async () => {
    const { user, token } = await createUserWithPlan({ max_instances: 1 });
    await Instance.create({
      user_id: user.id,
      name: 'Já Existente',
      instance_id: `existente-${randomUUID()}`,
      instance_token: 'token',
      status: 'connected',
    });
    mockEvolutionClient();

    const res = await request(app)
      .post('/instances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Segunda Instância' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/maximum of 1 instance/i);
  });

  it('bloqueia criação quando o usuário não tem plano', async () => {
    const user = await User.create({
      name: 'Sem Plano',
      email: `sem-plano-${randomUUID()}@orionhub.dev`,
      password: 'senha123',
    });
    const token = generateToken(user.id);
    mockEvolutionClient();

    const res = await request(app)
      .post('/instances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Instância Impossível' });

    expect(res.status).toBe(403);
  });

  it('bloqueia criação quando o plano está vencido', async () => {
    const { token } = await createUserWithPlan(
      {},
      { plan_expires_at: new Date(Date.now() - 1000) }
    );
    mockEvolutionClient();

    const res = await request(app)
      .post('/instances')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Instância Vencida' });

    expect(res.status).toBe(403);
  });
});

describe('Instances — Index', () => {
  it('lista apenas instâncias do próprio usuário', async () => {
    const { user: userA, token: tokenA } = await createUserWithPlan();
    const { user: userB } = await createUserWithPlan();

    await Instance.create({
      user_id: userA.id,
      name: 'Minha',
      instance_id: `minha-${randomUUID()}`,
      instance_token: 'token-a',
      status: 'connected',
    });
    await Instance.create({
      user_id: userB.id,
      name: 'Do Outro',
      instance_id: `outro-${randomUUID()}`,
      instance_token: 'token-b',
      status: 'connected',
    });

    const res = await request(app)
      .get('/instances')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Minha');
  });
});

describe('Instances — QR Code', () => {
  it('retorna o QR code para instância desconectada', async () => {
    const { user, token } = await createUserWithPlan();
    const instance = await Instance.create({
      user_id: user.id,
      name: 'Aguardando Conexão',
      instance_id: `aguardando-${randomUUID()}`,
      instance_token: 'token',
      status: 'disconnected',
    });
    mockEvolutionClient({
      getResponse: { base64: 'data:image/png;base64,FAKE' },
    });

    const res = await request(app)
      .get(`/instances/${instance.id}/qrcode`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.qrcode).toBe('data:image/png;base64,FAKE');
  });

  it('rejeita QR code de instância já conectada', async () => {
    const { user, token } = await createUserWithPlan();
    const instance = await Instance.create({
      user_id: user.id,
      name: 'Já Conectada',
      instance_id: `conectada-${randomUUID()}`,
      instance_token: 'token',
      status: 'connected',
    });
    mockEvolutionClient();

    const res = await request(app)
      .get(`/instances/${instance.id}/qrcode`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('rejeita instância que não existe (404) antes de chamar a Evolution API', async () => {
    const { token } = await createUserWithPlan();
    const client = mockEvolutionClient();

    const res = await request(app)
      .get(`/instances/${randomUUID()}/qrcode`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(client.get).not.toHaveBeenCalled();
  });

  it('rejeita id malformado com 400 (validação de UUID)', async () => {
    const { token } = await createUserWithPlan();

    const res = await request(app)
      .get('/instances/nao-e-um-uuid/qrcode')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('Instances — Status', () => {
  it('atualiza status para "connected" quando Evolution retorna state "open"', async () => {
    const { user, token } = await createUserWithPlan();
    const instance = await Instance.create({
      user_id: user.id,
      name: 'Verificando',
      instance_id: `verificando-${randomUUID()}`,
      instance_token: 'token',
      status: 'disconnected',
    });
    mockEvolutionClient({ getResponse: { instance: { state: 'open' } } });

    const res = await request(app)
      .get(`/instances/${instance.id}/status`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('connected');

    const updated = await Instance.findByPk(instance.id);
    expect(updated.status).toBe('connected');
  });

  it('mantém "disconnected" para qualquer outro state da Evolution', async () => {
    const { user, token } = await createUserWithPlan();
    const instance = await Instance.create({
      user_id: user.id,
      name: 'Verificando',
      instance_id: `verificando2-${randomUUID()}`,
      instance_token: 'token',
      status: 'connected',
    });
    mockEvolutionClient({ getResponse: { instance: { state: 'close' } } });

    const res = await request(app)
      .get(`/instances/${instance.id}/status`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.body.status).toBe('disconnected');
  });
});

describe('Instances — Destroy', () => {
  it('exclui a instância mesmo se a Evolution API falhar (resiliência)', async () => {
    const { user, token } = await createUserWithPlan();
    const instance = await Instance.create({
      user_id: user.id,
      name: 'Pra Excluir',
      instance_id: `excluir-${randomUUID()}`,
      instance_token: 'token',
      status: 'connected',
    });
    mockEvolutionClient({ deleteRejects: true });

    const res = await request(app)
      .delete(`/instances/${instance.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const deleted = await Instance.findByPk(instance.id);
    expect(deleted).toBeNull();
  });

  it('bloqueia exclusão se houver um bot vinculado', async () => {
    const { user, token } = await createUserWithPlan();
    const instance = await Instance.create({
      user_id: user.id,
      name: 'Com Bot',
      instance_id: `combot-${randomUUID()}`,
      instance_token: 'token',
      status: 'connected',
    });
    await Bot.create({
      user_id: user.id,
      name: 'Bot Vinculado',
      instance_id: instance.id,
      mode: 'manual',
    });
    mockEvolutionClient();

    const res = await request(app)
      .delete(`/instances/${instance.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(409);

    const stillThere = await Instance.findByPk(instance.id);
    expect(stillThere).not.toBeNull();
  });

  it('rejeita excluir instância de outro usuário', async () => {
    const { user: owner } = await createUserWithPlan();
    const { token: otherToken } = await createUserWithPlan();
    const instance = await Instance.create({
      user_id: owner.id,
      name: 'Protegida',
      instance_id: `protegida-${randomUUID()}`,
      instance_token: 'token',
      status: 'connected',
    });
    mockEvolutionClient();

    const res = await request(app)
      .delete(`/instances/${instance.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });

  it('rejeita id malformado no destroy com 400 (validação de UUID)', async () => {
    const { token } = await createUserWithPlan();

    const res = await request(app)
      .delete('/instances/nao-e-um-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});
