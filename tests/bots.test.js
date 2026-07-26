import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Instance from '../src/models/Instance.js';
import Bot from '../src/models/Bot.js';

function generateToken(userId) {
  return jwt.sign({ id: userId }, process.env.TOKEN_SECRET, {
    expiresIn: '1h',
  });
}

async function createUserWithToken(overrides = {}) {
  const user = await User.create({
    name: 'Bot Teste',
    email: `bot-teste-${randomUUID()}@orionhub.dev`,
    password: 'senha123',
    ...overrides,
  });
  const token = generateToken(user.id);
  return { user, token };
}

async function createConnectedInstance(userId) {
  return Instance.create({
    user_id: userId,
    name: 'Instância Teste',
    instance_id: `instance-${randomUUID()}`,
    instance_token: 'token-fake',
    status: 'connected',
  });
}

describe('Bots — Store (criação)', () => {
  it('cria um bot vinculado a uma instância conectada do próprio usuário', async () => {
    const { user, token } = await createUserWithToken();
    const instance = await createConnectedInstance(user.id);

    const res = await request(app)
      .post('/bots')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Meu Bot',
        system_prompt: 'Você é um assistente de vendas.',
        instance_id: instance.id,
        mode: 'ai',
      });

    expect(res.status).toBe(201);
    expect(res.body.botId).toBeDefined();
  });

  it('rejeita instância que não existe', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post('/bots')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bot Órfão',
        system_prompt: 'Prompt qualquer',
        instance_id: randomUUID(),
        mode: 'manual',
      });

    expect(res.status).toBe(404);
  });

  it('rejeita instância desconectada', async () => {
    const { user, token } = await createUserWithToken();
    const instance = await Instance.create({
      user_id: user.id,
      name: 'Instância Desconectada',
      instance_id: `instance-${randomUUID()}`,
      instance_token: 'token-fake',
      status: 'disconnected',
    });

    const res = await request(app)
      .post('/bots')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bot Inválido',
        system_prompt: 'Prompt qualquer',
        instance_id: instance.id,
        mode: 'manual',
      });

    expect(res.status).toBe(404);
  });

  it('rejeita instância de OUTRO usuário (isolamento entre contas)', async () => {
    const { user: owner } = await createUserWithToken();
    const { token: attackerToken } = await createUserWithToken();
    const instance = await createConnectedInstance(owner.id);

    const res = await request(app)
      .post('/bots')
      .set('Authorization', `Bearer ${attackerToken}`)
      .send({
        name: 'Bot Invasor',
        system_prompt: 'Prompt qualquer',
        instance_id: instance.id,
        mode: 'manual',
      });

    expect(res.status).toBe(404);
  });

  it('rejeita vincular uma instância que já tem bot (mesmo usuário)', async () => {
    const { user, token } = await createUserWithToken();
    const instance = await createConnectedInstance(user.id);

    await request(app)
      .post('/bots')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Primeiro Bot',
        system_prompt: 'Prompt A',
        instance_id: instance.id,
        mode: 'manual',
      });

    const res = await request(app)
      .post('/bots')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Segundo Bot',
        system_prompt: 'Prompt B',
        instance_id: instance.id,
        mode: 'manual',
      });

    expect(res.status).toBe(409);
  });

  it('usa "manual" como mode padrão quando não informado', async () => {
    const { user, token } = await createUserWithToken();
    const instance = await createConnectedInstance(user.id);

    const createRes = await request(app)
      .post('/bots')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bot Sem Mode',
        system_prompt: 'Prompt qualquer',
        instance_id: instance.id,
      });

    const bot = await Bot.findByPk(createRes.body.botId);
    expect(bot.mode).toBe('manual');
  });

  it('rejeita requisição sem autenticação', async () => {
    const res = await request(app).post('/bots').send({
      name: 'Bot Sem Auth',
      system_prompt: 'Prompt',
      instance_id: randomUUID(),
    });

    expect(res.status).toBe(401);
  });
});

describe('Bots — Index (listagem + cache)', () => {
  it('lista apenas bots ATIVOS do próprio usuário', async () => {
    const { user, token } = await createUserWithToken();
    const instance1 = await createConnectedInstance(user.id);
    const instance2 = await createConnectedInstance(user.id);

    await Bot.create({
      user_id: user.id,
      name: 'Bot Ativo',
      instance_id: instance1.id,
      mode: 'manual',
      active: true,
    });
    await Bot.create({
      user_id: user.id,
      name: 'Bot Inativo',
      instance_id: instance2.id,
      mode: 'manual',
      active: false,
    });

    const res = await request(app)
      .get('/bots')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Bot Ativo');
  });

  it('não lista bots de outros usuários', async () => {
    const { user: userA, token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const instance = await createConnectedInstance(userB.id);

    await Bot.create({
      user_id: userB.id,
      name: 'Bot do Outro',
      instance_id: instance.id,
      mode: 'manual',
      active: true,
    });

    const res = await request(app)
      .get('/bots')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it('serve a segunda chamada a partir do cache (sem nova consulta ao banco)', async () => {
    const { user, token } = await createUserWithToken();
    const instance = await createConnectedInstance(user.id);
    await Bot.create({
      user_id: user.id,
      name: 'Bot Cacheável',
      instance_id: instance.id,
      mode: 'manual',
      active: true,
    });

    const firstRes = await request(app)
      .get('/bots')
      .set('Authorization', `Bearer ${token}`);
    expect(firstRes.status).toBe(200);
    expect(firstRes.body).toHaveLength(1);

    // Apaga o bot diretamente no banco, ignorando a camada da aplicação
    await Bot.destroy({ where: {} });

    // Se o cache estiver funcionando, a segunda chamada ainda retorna o bot "fantasma"
    const secondRes = await request(app)
      .get('/bots')
      .set('Authorization', `Bearer ${token}`);
    expect(secondRes.status).toBe(200);
    expect(secondRes.body).toHaveLength(1);
  });

  it('invalida o cache após criar um novo bot', async () => {
    const { user, token } = await createUserWithToken();
    const instance1 = await createConnectedInstance(user.id);

    // Primeira leitura — cache vazio, grava cache com lista vazia
    const emptyRes = await request(app)
      .get('/bots')
      .set('Authorization', `Bearer ${token}`);
    expect(emptyRes.body).toHaveLength(0);

    const instance2 = await createConnectedInstance(user.id);
    await request(app)
      .post('/bots')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Bot Novo',
        system_prompt: 'Prompt',
        instance_id: instance2.id,
        mode: 'manual',
      });

    // Segunda leitura — cache deveria ter sido invalidado pelo store()
    const afterRes = await request(app)
      .get('/bots')
      .set('Authorization', `Bearer ${token}`);
    expect(afterRes.body).toHaveLength(1);
  });
});

describe('Bots — Show', () => {
  it('retorna 404 para bot de outro usuário', async () => {
    const { user: owner } = await createUserWithToken();
    const { token: otherToken } = await createUserWithToken();
    const instance = await createConnectedInstance(owner.id);
    const bot = await Bot.create({
      user_id: owner.id,
      name: 'Bot Privado',
      instance_id: instance.id,
      mode: 'manual',
    });

    const res = await request(app)
      .get(`/bots/${bot.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });
});

describe('Bots — Update', () => {
  it('atualiza apenas o campo enviado, sem apagar os demais', async () => {
    const { user, token } = await createUserWithToken();
    const instance = await createConnectedInstance(user.id);
    const bot = await Bot.create({
      user_id: user.id,
      name: 'Nome Original',
      system_prompt: 'Prompt Original',
      instance_id: instance.id,
      mode: 'manual',
    });

    const res = await request(app)
      .patch(`/bots/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nome Atualizado' });

    expect(res.status).toBe(200);

    const updated = await Bot.findByPk(bot.id);
    expect(updated.name).toBe('Nome Atualizado');
    // system_prompt e mode não deveriam ter sido apagados
    expect(updated.system_prompt).toBe('Prompt Original');
    expect(updated.mode).toBe('manual');
  });

  it('rejeita atualizar bot de outro usuário', async () => {
    const { user: owner } = await createUserWithToken();
    const { token: otherToken } = await createUserWithToken();
    const instance = await createConnectedInstance(owner.id);
    const bot = await Bot.create({
      user_id: owner.id,
      name: 'Bot Privado',
      instance_id: instance.id,
      mode: 'manual',
    });

    const res = await request(app)
      .patch(`/bots/${bot.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Tentativa de Invasão' });

    expect(res.status).toBe(404);
  });
});

describe('Bots — Destroy', () => {
  it('exclui um bot do próprio usuário', async () => {
    const { user, token } = await createUserWithToken();
    const instance = await createConnectedInstance(user.id);
    const bot = await Bot.create({
      user_id: user.id,
      name: 'Bot pra Excluir',
      instance_id: instance.id,
      mode: 'manual',
    });

    const res = await request(app)
      .delete(`/bots/${bot.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const deleted = await Bot.findByPk(bot.id);
    expect(deleted).toBeNull();
  });

  it('rejeita excluir bot de outro usuário', async () => {
    const { user: owner } = await createUserWithToken();
    const { token: otherToken } = await createUserWithToken();
    const instance = await createConnectedInstance(owner.id);
    const bot = await Bot.create({
      user_id: owner.id,
      name: 'Bot Protegido',
      instance_id: instance.id,
      mode: 'manual',
    });

    const res = await request(app)
      .delete(`/bots/${bot.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
  });
});
