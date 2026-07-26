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
import Instance from '../src/models/Instance.js';
import Bot from '../src/models/Bot.js';
import Conversation from '../src/models/Conversation.js';
import Flow from '../src/models/Flow.js';
import FlowSession from '../src/models/FlowSession.js';
import { invalidateCache } from '../src/middlewares/cache.js';
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

async function createBotFor(user) {
  const instance = await Instance.create({
    user_id: user.id,
    name: 'Instância Teste',
    instance_id: `inst-${randomUUID()}`,
    instance_token: 'token',
    status: 'connected',
  });
  return Bot.create({
    user_id: user.id,
    name: 'Bot Teste',
    instance_id: instance.id,
    mode: 'manual',
  });
}

async function createConversation(bot, overrides = {}) {
  return Conversation.create({
    bot_id: bot.id,
    contact_phone: `5512${Math.floor(Math.random() * 1e8)}`,
    contact_name: 'Contato Teste',
    status: 'open',
    ...overrides,
  });
}

async function createFlowSessionFor(conversation) {
  const flow = await Flow.create({});
  return FlowSession.create({
    conversation_id: conversation.id,
    flow_id: flow.id,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Conversations — Index', () => {
  it('lista todas as conversas do usuário quando botId não é informado', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    await createConversation(bot);
    await createConversation(bot);

    const res = await request(app)
      .get('/conversations')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it('NÃO vaza conversas de outros usuários quando botId não é informado (regressão do bug crítico)', async () => {
    const { user: userA, token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const botA = await createBotFor(userA);
    const botB = await createBotFor(userB);
    await createConversation(botA);
    await createConversation(botB);
    await createConversation(botB);

    const res = await request(app)
      .get('/conversations')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('filtra por botId, retornando apenas as conversas daquele bot', async () => {
    const { user, token } = await createUserWithToken();
    const botX = await createBotFor(user);
    const botY = await createBotFor(user);
    await createConversation(botX);
    await createConversation(botY);
    await createConversation(botY);

    const res = await request(app)
      .get('/conversations')
      .query({ botId: botY.id })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((c) => c.bot_id === botY.id)).toBe(true);
  });

  it('retorna 404 quando o botId informado pertence a outro usuário', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const botB = await createBotFor(userB);

    const res = await request(app)
      .get('/conversations')
      .query({ botId: botB.id })
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('filtra por status', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    await createConversation(bot, { status: 'open' });
    await createConversation(bot, { status: 'closed' });

    const res = await request(app)
      .get('/conversations')
      .query({ status: 'closed' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('closed');
  });

  it('rejeita status inválido (validação de schema)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get('/conversations')
      .query({ status: 'invalido' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('rejeita botId que não é um uuid válido (validação de schema)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get('/conversations')
      .query({ botId: 'nao-e-um-uuid' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('Conversations — Show', () => {
  it('retorna os detalhes de uma conversa do próprio usuário', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot, {
      contact_name: 'Fulano',
    });

    const res = await request(app)
      .get(`/conversations/${conversation.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(conversation.id);
    expect(res.body.contact_name).toBe('Fulano');
  });

  it('retorna 404 para conversa inexistente', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get(`/conversations/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('retorna 404 ao tentar ver conversa de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const botB = await createBotFor(userB);
    const conversationB = await createConversation(botB);

    const res = await request(app)
      .get(`/conversations/${conversationB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('id malformado é rejeitado pelo schema Zod com 400 antes de chegar no controller', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get('/conversations/nao-e-um-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('Conversations — Update', () => {
  it('atualiza o status da conversa', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot, { status: 'open' });

    const res = await request(app)
      .patch(`/conversations/${conversation.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'waiting' });

    expect(res.status).toBe(200);
    expect(res.body.conversation.status).toBe('waiting');

    const updated = await Conversation.findByPk(conversation.id);
    expect(updated.status).toBe('waiting');
  });

  it('remove a flow session vinculada quando a conversa é fechada', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot, { status: 'open' });
    const flowSession = await createFlowSessionFor(conversation);

    const res = await request(app)
      .patch(`/conversations/${conversation.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'closed' });

    expect(res.status).toBe(200);

    const stillThere = await FlowSession.findByPk(flowSession.id);
    expect(stillThere).toBeNull();
  });

  it('NÃO remove a flow session quando o novo status não é "closed"', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot, { status: 'open' });
    const flowSession = await createFlowSessionFor(conversation);

    const res = await request(app)
      .patch(`/conversations/${conversation.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'waiting' });

    expect(res.status).toBe(200);

    const stillThere = await FlowSession.findByPk(flowSession.id);
    expect(stillThere).not.toBeNull();
  });

  it('loga a atividade e invalida o cache de conversas', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot, { status: 'open' });

    const res = await request(app)
      .patch(`/conversations/${conversation.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'closed' });

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'conversation.status_changed',
        resourceId: conversation.id,
        metadata: expect.objectContaining({
          new_status: 'closed',
          flow_session_cleared: true,
        }),
      })
    );
    expect(invalidateCache).toHaveBeenCalledWith(user.id, ['/conversations']);
  });

  it('retorna 404 para conversa inexistente', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .patch(`/conversations/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'closed' });

    expect(res.status).toBe(404);
  });

  it('retorna 404 ao tentar atualizar conversa de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const botB = await createBotFor(userB);
    const conversationB = await createConversation(botB);

    const res = await request(app)
      .patch(`/conversations/${conversationB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'closed' });

    expect(res.status).toBe(404);
  });

  it('status fora do ENUM é rejeitado pelo schema Zod com 400 antes de chegar no banco', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot);

    const res = await request(app)
      .patch(`/conversations/${conversation.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'invalido' });

    expect(res.status).toBe(400);
  });

  it('id malformado é rejeitado pelo schema Zod com 400 antes de chegar no controller', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .patch('/conversations/nao-e-um-uuid')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'closed' });

    expect(res.status).toBe(400);
  });
});
