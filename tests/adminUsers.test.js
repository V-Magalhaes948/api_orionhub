import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

import User from '../src/models/User.js';
import Plan from '../src/models/Plan.js';
import Product from '../src/models/Product.js';
import PlanAddon from '../src/models/PlanAddon.js';
import AddonPackage from '../src/models/AddonPackage.js';

vi.mock('../src/services/planExpirationService.js', () => ({
  expireUserAccess: vi.fn(async () => {}),
}));

vi.mock('../src/utils/logActivity.js', () => ({
  logActivity: vi.fn(async () => {}),
}));

vi.mock('../src/middlewares/cache.js', () => ({
  invalidateCache: vi.fn(async () => {}),
  cacheMiddleware: () => (req, res, next) => next(),
}));

import app from '../src/app.js';

import { expireUserAccess } from '../src/services/planExpirationService.js';
import { logActivity } from '../src/utils/logActivity.js';

const ADMIN_BASE = '/admin/users';

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.TOKEN_SECRET, {
    expiresIn: process.env.TOKEN_EXPIRATION,
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

async function createUser(overrides = {}) {
  return User.create({
    name: 'Usuário Teste',
    email: `user-teste-${randomUUID()}@orionhub.dev`,
    password: 'senha123',
    ...overrides,
  });
}

async function createAdmin(overrides = {}) {
  const admin = await createUser({ is_admin: true, ...overrides });
  const token = generateToken(admin.id);
  return { admin, token };
}

async function createUserWithPlan(planOverrides = {}, userOverrides = {}) {
  const plan = await createPlan(planOverrides);
  const user = await createUser({
    plan_id: plan.id,
    plan_status: 'active',
    plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    ...userOverrides,
  });
  const token = generateToken(user.id);
  return { user, plan, token };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Stub do bug de `io` global não importado no controller (ver ASSUNÇÃO 3 no topo).
  globalThis.io = { to: () => ({ emit: vi.fn() }) };
});

describe('AdminUser — Controle de acesso', () => {
  it('bloqueia acesso de usuário não-admin', async () => {
    const { token } = await createUserWithPlan();

    const res = await request(app)
      .get(ADMIN_BASE)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('permite acesso de usuário admin', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .get(ADMIN_BASE)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });
});

describe('AdminUser — Index (listagem)', () => {
  it('lista usuários com paginação', async () => {
    const { token } = await createAdmin();
    await createUserWithPlan();
    await createUserWithPlan();

    const res = await request(app)
      .get(ADMIN_BASE)
      .query({ page: 1, limit: 1 })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.page).toBe(1);
    expect(res.body.pages).toBeGreaterThanOrEqual(2);
  });

  it('filtra por busca de nome/email', async () => {
    const { token } = await createAdmin();
    await createUserWithPlan({}, { name: 'Fulano da Silva' });
    await createUserWithPlan({}, { name: 'Ciclano Souza' });

    const res = await request(app)
      .get(ADMIN_BASE)
      .query({ search: 'Fulano' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.map((u) => u.name)).toEqual(['Fulano da Silva']);
  });

  it('filtra por account_status', async () => {
    const { token } = await createAdmin();
    await createUserWithPlan({}, { account_status: 'suspended' });
    await createUserWithPlan({}, { account_status: 'active' });

    const res = await request(app)
      .get(ADMIN_BASE)
      .query({ account_status: 'suspended' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.users).toHaveLength(1);
    expect(res.body.users[0].account_status).toBe('suspended');
  });

  it('rejeita account_status inválido (validação de schema)', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .get(ADMIN_BASE)
      .query({ account_status: 'invalido' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('AdminUser — Show', () => {
  it('retorna os dados do usuário por id', async () => {
    const { token } = await createAdmin();
    const { user } = await createUserWithPlan();

    const res = await request(app)
      .get(`${ADMIN_BASE}/${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.password_hash).toBeUndefined();
  });

  it('retorna 404 para usuário inexistente', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .get(`${ADMIN_BASE}/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('rejeita id malformado com 400', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .get(`${ADMIN_BASE}/nao-e-um-uuid`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('AdminUser — UpdatePlan', () => {
  it('atribui um novo plano a um usuário sem plano', async () => {
    const { token } = await createAdmin();
    const plan = await createPlan();
    const user = await createUser();

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan_id: plan.id, duration_days: 30 });

    expect(res.status).toBe(200);
    expect(res.body.productSelectionPending).toBe(false);

    const updated = await User.findByPk(user.id);
    expect(updated.plan_id).toBe(plan.id);
    expect(updated.plan_status).toBe('active');
    expect(updated.plan_expires_at).not.toBeNull();
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'user.plan_updated' })
    );
  });

  it('renova plano ativo somando dias à expiração existente (não reseta a partir de agora)', async () => {
    const { token } = await createAdmin();
    const plan = await createPlan();
    const currentExpiry = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const user = await createUser({
      plan_id: plan.id,
      plan_status: 'active',
      plan_expires_at: currentExpiry,
    });

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan_id: plan.id, duration_days: 10 });

    expect(res.status).toBe(200);

    const updated = await User.findByPk(user.id);
    const expectedMinimum = new Date(
      currentExpiry.getTime() + 9 * 24 * 60 * 60 * 1000
    );
    expect(new Date(updated.plan_expires_at).getTime()).toBeGreaterThan(
      expectedMinimum.getTime()
    );
  });

  it('exige duration_days válido ao atribuir um plano novo', async () => {
    const { token } = await createAdmin();
    const plan = await createPlan();
    const user = await createUser();

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan_id: plan.id, duration_days: 0 });

    expect(res.status).toBe(400);
  });

  it('rejeita plan_id inválido', async () => {
    const { token } = await createAdmin();
    const user = await createUser();

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan_id: randomUUID(), duration_days: 30 });

    expect(res.status).toBe(400);
  });

  it('rejeita addon sem plan_id', async () => {
    const { token } = await createAdmin();
    const addon = await AddonPackage.create({
      name: 'Addon Teste',
      extra_products: 5,
    });
    const user = await createUser();

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ addon_id: addon.id, addon_duration_days: 30 });

    expect(res.status).toBe(400);
  });

  it('rejeita addon indisponível para o plano informado', async () => {
    const { token } = await createAdmin();
    const plan = await createPlan();
    const addon = await AddonPackage.create({
      name: 'Addon Teste',
      extra_products: 5,
    });
    const user = await createUser();

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        plan_id: plan.id,
        duration_days: 30,
        addon_id: addon.id,
        addon_duration_days: 30,
      });

    expect(res.status).toBe(400);
  });

  it('atribui plano + addon quando o pricing existe', async () => {
    const { token } = await createAdmin();
    const plan = await createPlan();
    const addon = await AddonPackage.create({
      name: 'Addon Teste',
      extra_products: 5,
    });
    await PlanAddon.create({
      plan_id: plan.id,
      addon_id: addon.id,
      price: 9.9,
    });
    const user = await createUser();

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        plan_id: plan.id,
        duration_days: 30,
        addon_id: addon.id,
        addon_duration_days: 15,
      });

    expect(res.status).toBe(200);

    const updated = await User.findByPk(user.id);
    expect(updated.addon_id).toBe(addon.id);
    expect(updated.addon_status).toBe('active');
    expect(updated.addon_expires_at).not.toBeNull();
  });

  it('bloqueia addon para conta admin', async () => {
    const { token } = await createAdmin();
    const plan = await createPlan();
    const addon = await AddonPackage.create({
      name: 'Addon Teste',
      extra_products: 5,
    });
    const targetAdmin = await createUser({ is_admin: true });

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${targetAdmin.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan_id: plan.id, duration_days: 30, addon_id: addon.id });

    expect(res.status).toBe(400);
  });

  it('remove o plano do usuário e expira o acesso', async () => {
    const { token } = await createAdmin();
    const { user } = await createUserWithPlan();

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan_id: null });

    expect(res.status).toBe(200);
    expect(expireUserAccess).toHaveBeenCalled();

    const updated = await User.findByPk(user.id);
    expect(updated.plan_id).toBeNull();
    expect(updated.plan_status).toBe('pending');
  });

  it('marca product_selection_pending quando o novo limite é menor que os produtos ativos', async () => {
    const { token } = await createAdmin();
    const bigPlan = await createPlan({ max_products: 50 });
    const smallPlan = await createPlan({ max_products: 1 });
    const user = await createUser({
      plan_id: bigPlan.id,
      plan_status: 'active',
      plan_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    await Product.create({ user_id: user.id, name: 'Produto 1', active: true });
    await Product.create({ user_id: user.id, name: 'Produto 2', active: true });

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan_id: smallPlan.id, duration_days: 30 });

    expect(res.status).toBe(200);
    expect(res.body.productSelectionPending).toBe(true);

    const updated = await User.findByPk(user.id);
    expect(updated.product_selection_pending).toBe(true);
  });

  it('retorna 404 para usuário inexistente', async () => {
    const { token } = await createAdmin();
    const plan = await createPlan();

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${randomUUID()}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan_id: plan.id, duration_days: 30 });

    expect(res.status).toBe(404);
  });

  it('usa o bônus extra_products do addon para evitar product_selection_pending', async () => {
    const { token } = await createAdmin();
    const plan = await createPlan({ max_products: 1 });
    const addon = await AddonPackage.create({
      name: 'Addon Teste',
      extra_products: 5,
    });
    await PlanAddon.create({
      plan_id: plan.id,
      addon_id: addon.id,
      price: 9.9,
    });
    const user = await createUser();
    await Product.create({ user_id: user.id, name: 'Produto 1', active: true });
    await Product.create({ user_id: user.id, name: 'Produto 2', active: true });

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/plan`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        plan_id: plan.id,
        duration_days: 30,
        addon_id: addon.id,
        addon_duration_days: 30,
      });

    expect(res.status).toBe(200);
    // limite efetivo = 1 (plano) + 5 (addon) = 6, então 2 produtos ativos não estouram o limite
    expect(res.body.productSelectionPending).toBe(false);
  });
});

describe('AdminUser — UpdateStatus', () => {
  it('suspende um usuário com motivo', async () => {
    const { token } = await createAdmin();
    const { user } = await createUserWithPlan();

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ account_status: 'suspended', reason: 'Pagamento em atraso' });

    expect(res.status).toBe(200);

    const updated = await User.findByPk(user.id);
    expect(updated.account_status).toBe('suspended');
    expect(updated.suspended_reason).toBe('Pagamento em atraso');
  });

  it('reativa um usuário suspenso e limpa o motivo', async () => {
    const { token } = await createAdmin();
    const { user } = await createUserWithPlan(
      {},
      { account_status: 'suspended', suspended_reason: 'Antigo motivo' }
    );

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ account_status: 'active' });

    expect(res.status).toBe(200);

    const updated = await User.findByPk(user.id);
    expect(updated.account_status).toBe('active');
    expect(updated.suspended_reason).toBeNull();
  });

  it('bloqueia suspensão de outro admin', async () => {
    const { token } = await createAdmin();
    const targetAdmin = await createUser({ is_admin: true });

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${targetAdmin.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ account_status: 'suspended' });

    expect(res.status).toBe(400);
  });

  it('bloqueia alteração de status de conta já excluída', async () => {
    const { token } = await createAdmin();
    const { user } = await createUserWithPlan(
      {},
      { account_status: 'deleted' }
    );

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ account_status: 'active' });

    expect(res.status).toBe(400);
  });

  it('rejeita account_status fora do enum permitido (validação de schema)', async () => {
    const { token } = await createAdmin();
    const { user } = await createUserWithPlan();

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${user.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ account_status: 'deleted' });

    expect(res.status).toBe(400);
  });

  it('retorna 404 para usuário inexistente', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .patch(`${ADMIN_BASE}/${randomUUID()}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ account_status: 'suspended' });

    expect(res.status).toBe(404);
  });
});

describe('AdminUser — Destroy', () => {
  it('marca a conta como excluída e expira o acesso', async () => {
    const { token } = await createAdmin();
    const { user } = await createUserWithPlan();

    const res = await request(app)
      .delete(`${ADMIN_BASE}/${user.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(expireUserAccess).toHaveBeenCalled();

    const updated = await User.findByPk(user.id);
    expect(updated.account_status).toBe('deleted');
  });

  it('bloqueia exclusão de conta admin', async () => {
    const { token } = await createAdmin();
    const targetAdmin = await createUser({ is_admin: true });

    const res = await request(app)
      .delete(`${ADMIN_BASE}/${targetAdmin.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('retorna 404 para usuário inexistente', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .delete(`${ADMIN_BASE}/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('rejeita id malformado com 400', async () => {
    const { token } = await createAdmin();

    const res = await request(app)
      .delete(`${ADMIN_BASE}/nao-e-um-uuid`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});
