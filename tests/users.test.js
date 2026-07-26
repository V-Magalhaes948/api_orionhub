import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

vi.mock('../src/utils/logActivity.js', () => ({
  logActivity: vi.fn(async () => {}),
}));

vi.mock('../src/middlewares/cache.js', () => ({
  invalidateCache: vi.fn(async () => {}),
  cacheMiddleware: () => (req, res, next) => next(),
}));

import app from '../src/app.js';
import User from '../src/models/User.js';
import Plan from '../src/models/Plan.js';
import AddonPackage from '../src/models/AddonPackage.js';
import { logActivity } from '../src/utils/logActivity.js';

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
    name: 'Plano Teste',
    max_instances: 1,
    max_products: 3,
    max_messages_per_month: 1000,
    price: 49.9,
    ...overrides,
  });
}

async function createAddon(overrides = {}) {
  return AddonPackage.create({
    name: 'Addon Teste',
    extra_products: 5,
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('User — Show (GET /users/me)', () => {
  it('retorna os dados do usuário autenticado', async () => {
    const { user, token } = await createUserWithToken({
      name: 'Fulano de Tal',
    });

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.name).toBe('Fulano de Tal');
    expect(res.body.email).toBe(user.email);
  });

  it('não expõe password_hash, password (virtual) nem refresh_token na resposta', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.password_hash).toBeUndefined();
    expect(res.body.password).toBeUndefined();
    expect(res.body.refresh_token).toBeUndefined();
  });

  it('inclui plan e addon associados quando existentes', async () => {
    const plan = await createPlan({ name: 'Plano Pro', max_products: 10 });
    const addon = await createAddon({ name: 'Addon Extra' });
    const { token } = await createUserWithToken({
      plan_id: plan.id,
      addon_id: addon.id,
      addon_status: 'active',
    });

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBeTruthy();
    expect(res.body.plan.name).toBe('Plano Pro');
    expect(res.body.addon).toBeTruthy();
    expect(res.body.addon.name).toBe('Addon Extra');
  });

  it('retorna plan e addon nulos quando o usuário não tem nenhum associado', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.plan).toBeNull();
    expect(res.body.addon).toBeNull();
  });

  it(
    'retorna 403 quando o usuário do token não existe mais no banco ' +
      '(authMiddleware barra antes de chegar no controller — o 404 do ' +
      'UserController.show é código morto nesta rota)',
    async () => {
      const token = generateToken(randomUUID());

      const res = await request(app)
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Conta não encontrada');
    }
  );

  it('retorna 403 quando a conta está com account_status suspended', async () => {
    const { token } = await createUserWithToken({
      account_status: 'suspended',
    });

    const res = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Conta não encontrada');
  });

  it('rejeita requisição sem token de autenticação (401)', async () => {
    const res = await request(app).get('/users/me');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('No token provided');
  });

  it('rejeita token inválido/malformado (401)', async () => {
    const res = await request(app)
      .get('/users/me')
      .set('Authorization', 'Bearer token-invalido');

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid token');
  });
});

describe('User — Update (PUT /users/me)', () => {
  it('atualiza name e email com sucesso e não retorna token quando a senha não é enviada', async () => {
    const { user, token } = await createUserWithToken();

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Atualizado', email: 'novo-email@orionhub.dev' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User updated successfully');
    expect(res.body.userId).toBe(user.id);
    expect(res.body.token).toBeUndefined();

    const refreshed = await User.findByPk(user.id);
    expect(refreshed.name).toBe('Nome Atualizado');
    expect(refreshed.email).toBe('novo-email@orionhub.dev');
  });

  it('retorna um novo token JWT quando a senha é atualizada, e o hash muda de fato', async () => {
    const { user, token } = await createUserWithToken();
    const oldHash = user.password_hash;

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'novaSenha123' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User updated successfully');
    expect(typeof res.body.token).toBe('string');

    const decoded = jwt.verify(res.body.token, process.env.TOKEN_SECRET);
    expect(decoded.id).toBe(user.id);

    const refreshed = await User.findByPk(user.id);
    expect(refreshed.password_hash).not.toBe(oldHash);
    await expect(refreshed.checkPassword('novaSenha123')).resolves.toBe(true);
  });

  it('loga a atividade user.updated', async () => {
    const { user, token } = await createUserWithToken();

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Logado' });

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        action: 'user.updated',
        resourceType: 'user',
        resourceId: user.id,
        metadata: expect.objectContaining({ name: 'Nome Logado' }),
      })
    );
  });

  it('PUT parcial só com name preserva email e password_hash existentes (Sequelize ignora undefined em .update())', async () => {
    const { user, token } = await createUserWithToken({
      email: 'preservar@orionhub.dev',
    });
    const originalHash = user.password_hash;

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Só o nome mudou' });

    expect(res.status).toBe(200);

    const refreshed = await User.findByPk(user.id);
    expect(refreshed.name).toBe('Só o nome mudou');
    expect(refreshed.email).toBe('preservar@orionhub.dev');
    expect(refreshed.password_hash).toBe(originalHash);
  });

  it('rejeita email duplicado de outro usuário com 400 (SequelizeUniqueConstraintError)', async () => {
    const existing = await createUser({ email: 'ja-existe@orionhub.dev' });
    const { token } = await createUserWithToken();

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: existing.email });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('E-mail já existe')])
    );
  });

  it(
    'e-mail em formato inválido é barrado pela validação do model (isEmail), ' +
      'não pelo Zod — updateUserSchema não está aplicado nesta rota (ver nota geral) — ' +
      'e handleError() converte o SequelizeValidationError em 400',
    async () => {
      const { token } = await createUserWithToken();

      const res = await request(app)
        .put('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'isso-nao-e-um-email' });

      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([expect.stringContaining('E-mail inválido')])
      );
    }
  );

  it('senha abaixo de 6 caracteres é barrada pela validação passwordLength do model (campo virtual)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .put('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('A senha precisa ter entre 6 a 50 caracteres'),
      ])
    );
  });

  it(
    'retorna 403 quando o usuário do token não existe mais no banco ' +
      '(authMiddleware barra antes do controller)',
    async () => {
      const token = generateToken(randomUUID());

      const res = await request(app)
        .put('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Não importa' });

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Conta não encontrada');
    }
  );
});

describe('User — Destroy (DELETE /users/me)', () => {
  it('faz soft delete: marca account_status como deleted em vez de remover o registro', async () => {
    const { user, token } = await createUserWithToken();

    const res = await request(app)
      .delete('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('User deleted successfully');
    expect(res.body.userId).toBe(user.id);

    const stillExists = await User.findByPk(user.id);
    expect(stillExists).not.toBeNull();
    expect(stillExists.account_status).toBe('deleted');
  });

  it('loga a atividade user.deleted', async () => {
    const { user, token } = await createUserWithToken({
      name: 'Conta a remover',
    });

    const res = await request(app)
      .delete('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        action: 'user.deleted',
        resourceType: 'user',
        resourceId: user.id,
        metadata: expect.objectContaining({ name: 'Conta a remover' }),
      })
    );
  });

  it(
    'retorna 403 quando o usuário do token não existe mais no banco ' +
      '(authMiddleware barra antes do controller)',
    async () => {
      const token = generateToken(randomUUID());

      const res = await request(app)
        .delete('/users/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe('Conta não encontrada');
    }
  );

  it('após o soft delete, o mesmo token JWT é bloqueado pelo authMiddleware em requisições seguintes', async () => {
    const { token } = await createUserWithToken();

    const first = await request(app)
      .delete('/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(first.status).toBe(200);

    const second = await request(app)
      .get('/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(second.status).toBe(403);
    expect(second.body.message).toBe('Conta não encontrada');
  });
});
