import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';

import app from '../src/app.js';

import User from '../src/models/User.js';
import Plan from '../src/models/Plan.js';

describe('Auth — Register', () => {
  it('cria um usuário novo com sucesso', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'Vinicius Teste',
      email: 'teste.register@orionhub.dev',
      password: 'senha123',
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('teste.register@orionhub.dev');
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user.refresh_token).toBeUndefined();
  });

  it('rejeita e-mail duplicado', async () => {
    await User.create({
      name: 'Já Existe',
      email: 'duplicado@orionhub.dev',
      password: 'senha123',
    });

    const res = await request(app).post('/auth/register').send({
      name: 'Outro Nome',
      email: 'duplicado@orionhub.dev',
      password: 'outrasenha',
    });

    expect(res.status).toBe(400);
  });

  it('normaliza o e-mail (lowercase + trim) antes de checar duplicidade', async () => {
    await User.create({
      name: 'Original',
      email: 'normalizado@orionhub.dev',
      password: 'senha123',
    });

    const res = await request(app).post('/auth/register').send({
      name: 'Tentativa',
      email: '  Normalizado@OrionHub.dev  ',
      password: 'outrasenha',
    });

    expect(res.status).toBe(400);
  });
});

describe('Auth — Login', () => {
  beforeEach(async () => {
    await User.create({
      name: 'Login Teste',
      email: 'login@orionhub.dev',
      password: 'senhaCorreta123',
    });
  });

  it('autentica com credenciais corretas e retorna token + refreshToken', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'login@orionhub.dev',
      password: 'senhaCorreta123',
    });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
  });

  it('rejeita senha incorreta', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'login@orionhub.dev',
      password: 'senhaErrada',
    });

    expect(res.status).toBe(400);
  });

  it('normaliza e-mail no login (case-insensitive)', async () => {
    const res = await request(app).post('/auth/login').send({
      email: 'LOGIN@OrionHub.dev',
      password: 'senhaCorreta123',
    });

    expect(res.status).toBe(200);
  });
});

describe('Auth — Refresh token', () => {
  it('gera novo par de tokens com refresh token válido', async () => {
    const loginRes = await request(app).post('/auth/register').send({
      name: 'Refresh Teste',
      email: 'refresh@orionhub.dev',
      password: 'senha123',
    });

    const login = await request(app).post('/auth/login').send({
      email: 'refresh@orionhub.dev',
      password: 'senha123',
    });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: login.body.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();

    expect(res.body.refreshToken).not.toBe(login.body.refreshToken);
  });

  it('rejeita refresh token inválido', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: 'token-invalido-qualquer' });

    expect(res.status).toBe(401);
  });

  it('rejeita refresh token que já foi rotacionado (revogado)', async () => {
    await request(app).post('/auth/register').send({
      name: 'Rotacao Teste',
      email: 'rotacao@orionhub.dev',
      password: 'senha123',
    });

    const login = await request(app).post('/auth/login').send({
      email: 'rotacao@orionhub.dev',
      password: 'senha123',
    });

    const oldRefreshToken = login.body.refreshToken;

    await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: oldRefreshToken });

    expect(res.status).toBe(401);
  });
});

describe('Auth — Lockout de conta', () => {
  it('bloqueia a conta após 10 tentativas de senha incorreta', async () => {
    await request(app).post('/auth/register').send({
      name: 'Lockout Teste',
      email: 'lockout@orionhub.dev',
      password: 'senhaCorreta123',
    });

    for (let i = 0; i < 9; i++) {
      const res = await request(app).post('/auth/login').send({
        email: 'lockout@orionhub.dev',
        password: 'senhaErrada',
      });
      expect(res.status).toBe(400);
    }

    const lockRes = await request(app).post('/auth/login').send({
      email: 'lockout@orionhub.dev',
      password: 'senhaErrada',
    });
    expect(lockRes.status).toBe(400);

    const blockedRes = await request(app).post('/auth/login').send({
      email: 'lockout@orionhub.dev',
      password: 'senhaCorreta123',
    });
    expect(blockedRes.status).toBe(423);
    expect(blockedRes.body.message).toMatch(/bloqueada/i);
  });

  it('reseta failed_login_attempts após login bem-sucedido', async () => {
    await request(app).post('/auth/register').send({
      name: 'Reset Attempts Teste',
      email: 'reset-attempts@orionhub.dev',
      password: 'senhaCorreta123',
    });

    for (let i = 0; i < 3; i++) {
      await request(app).post('/auth/login').send({
        email: 'reset-attempts@orionhub.dev',
        password: 'senhaErrada',
      });
    }

    const successRes = await request(app).post('/auth/login').send({
      email: 'reset-attempts@orionhub.dev',
      password: 'senhaCorreta123',
    });
    expect(successRes.status).toBe(200);

    const user = await User.findOne({
      where: { email: 'reset-attempts@orionhub.dev' },
    });
    expect(user.failed_login_attempts).toBe(0);
    expect(user.locked_until).toBeNull();
  });

  it('libera a conta automaticamente depois que locked_until expira', async () => {
    const user = await User.create({
      name: 'Auto Unlock Teste',
      email: 'auto-unlock@orionhub.dev',
      password: 'senhaCorreta123',
    });

    await user.update({
      failed_login_attempts: 10,
      locked_until: new Date(Date.now() - 1000),
    });

    const res = await request(app).post('/auth/login').send({
      email: 'auto-unlock@orionhub.dev',
      password: 'senhaCorreta123',
    });

    expect(res.status).toBe(200);
  });

  it('reset de senha libera a conta bloqueada', async () => {
    const user = await User.create({
      name: 'Reset Unlock Teste',
      email: 'reset-unlock@orionhub.dev',
      password: 'senhaAntiga123',
    });

    await user.update({
      failed_login_attempts: 10,
      locked_until: new Date(Date.now() + 5 * 60 * 1000),
    });

    const crypto = await import('crypto');
    const rawToken = 'token-de-teste-para-reset';
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    await user.update({
      reset_token_hash: tokenHash,
      reset_token_expires_at: new Date(Date.now() + 30 * 60 * 1000),
    });

    const resetRes = await request(app).post('/auth/reset-password').send({
      token: rawToken,
      password: 'senhaNova123',
    });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app).post('/auth/login').send({
      email: 'reset-unlock@orionhub.dev',
      password: 'senhaNova123',
    });
    expect(loginRes.status).toBe(200);
  });
});
