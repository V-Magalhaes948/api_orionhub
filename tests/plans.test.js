import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

vi.mock('../src/middlewares/cache.js', () => ({
  invalidateCache: vi.fn(async () => {}),
  cacheMiddleware: () => (req, res, next) => next(),
}));

import app from '../src/app.js';
import User from '../src/models/User.js';
import Plan from '../src/models/Plan.js';
import PlanAddon from '../src/models/PlanAddon.js';
import AddonPackage from '../src/models/AddonPackage.js';

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.TOKEN_SECRET, {
    expiresIn: '1h',
  });
}

async function createUser(overrides = {}) {
  return User.create({
    name: 'Usuário Teste',
    email: `user-teste-${randomUUID()}@orionhub.dev`,
    password: 'senha123',
    ...overrides,
  });
}

async function createUserWithToken(overrides = {}) {
  const user = await createUser(overrides);
  const token = generateToken(user.id);
  return { user, token };
}

async function createPlan(overrides = {}) {
  return Plan.create({
    name: `Plano ${randomUUID().slice(0, 8)}`,
    is_default: false,
    max_instances: 1,
    max_products: 10,
    max_messages_per_month: 1000,
    price: 49.9,
    ...overrides,
  });
}

async function createAddonPackage(overrides = {}) {
  return AddonPackage.create({
    name: `Addon ${randomUUID().slice(0, 8)}`,
    extra_products: 50,
    ...overrides,
  });
}

async function createPlanAddon(plan, addon, overrides = {}) {
  return PlanAddon.create({
    plan_id: plan.id,
    addon_id: addon.id,
    price: 19.9,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Plans — Index', () => {
  it('lista os planos ordenados por preço crescente', async () => {
    const { token } = await createUserWithToken();
    await createPlan({ name: 'Premium', price: 199.9 });
    await createPlan({ name: 'Básico', price: 49.9 });
    await createPlan({ name: 'Intermediário', price: 99.9 });

    const res = await request(app)
      .get('/plans')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((p) => p.name)).toEqual([
      'Básico',
      'Intermediário',
      'Premium',
    ]);
  });

  it('retorna array vazio quando não há planos cadastrados', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get('/plans')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('retorna 401 sem token de autenticação', async () => {
    await createPlan();

    const res = await request(app).get('/plans');

    expect(res.status).toBe(401);
  });
});

describe('Plans — Addons', () => {
  it('lista os addons de um plano, incluindo os dados do addon', async () => {
    const { token } = await createUserWithToken();
    const plan = await createPlan();
    const addon = await createAddonPackage({
      name: 'Pacote Extra',
      extra_products: 100,
    });
    await createPlanAddon(plan, addon, { price: 29.9 });

    const res = await request(app)
      .get(`/plans/${plan.id}/addons`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].plan_id).toBe(plan.id);
    expect(res.body[0].addon_id).toBe(addon.id);
    expect(res.body[0].addon).toMatchObject({
      id: addon.id,
      name: 'Pacote Extra',
      extra_products: 100,
    });
  });

  it('retorna array vazio quando o plano não tem addons', async () => {
    const { token } = await createUserWithToken();
    const plan = await createPlan();

    const res = await request(app)
      .get(`/plans/${plan.id}/addons`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('não retorna addons de outros planos', async () => {
    const { token } = await createUserWithToken();
    const planA = await createPlan();
    const planB = await createPlan();
    const addon = await createAddonPackage();
    await createPlanAddon(planA, addon);
    await createPlanAddon(planB, addon);

    const res = await request(app)
      .get(`/plans/${planA.id}/addons`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].plan_id).toBe(planA.id);
  });

  it('retorna 404 quando o plano não existe', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get(`/plans/${randomUUID()}/addons`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('retorna 404 quando o id do plano não é um uuid válido (não validado na rota — ver NOTA)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get('/plans/nao-e-um-uuid/addons')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('retorna 401 sem token de autenticação', async () => {
    const plan = await createPlan();

    const res = await request(app).get(`/plans/${plan.id}/addons`);

    expect(res.status).toBe(401);
  });
});
