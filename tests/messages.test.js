import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

vi.mock('../src/services/whatsAppService.js', () => ({
  default: {
    sendText: vi.fn(async () => ({ data: { status: 'sent' } })),
  },
}));

vi.mock('../src/services/messageService.js', () => ({
  default: {
    saveAndEmit: vi.fn(async ({ conversationId, content, role }) => ({
      id: randomUUID(),
      conversation_id: conversationId,
      content,
      role,
      message_id: null,
      created_at: new Date().toISOString(),
    })),
  },
}));

vi.mock('../src/services/contactIdentityService.js', () => ({
  default: {
    isSamePhoneNumber: vi.fn(() => false),
  },
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
import Message from '../src/models/Message.js';
import WhatsAppService from '../src/services/whatsAppService.js';
import MessageService from '../src/services/messageService.js';
import ContactIdentityService from '../src/services/contactIdentityService.js';

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

async function createBotFor(user, instanceOverrides = {}, botOverrides = {}) {
  const instance = await Instance.create({
    user_id: user.id,
    name: 'Instância Teste',
    instance_id: `inst-${randomUUID()}`,
    instance_token: 'token',
    status: 'connected',
    phone_number: '5512999990000',
    ...instanceOverrides,
  });
  return Bot.create({
    user_id: user.id,
    name: 'Bot Teste',
    instance_id: instance.id,
    mode: 'manual',
    ...botOverrides,
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Messages — Index', () => {
  it('lista as mensagens da conversa ordenadas por created_at ASC', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot);

    await Message.create({
      conversation_id: conversation.id,
      content: 'Primeira mensagem',
      role: 'user',
    });
    await Message.create({
      conversation_id: conversation.id,
      content: 'Segunda mensagem',
      role: 'assistant',
    });

    const res = await request(app)
      .get(`/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((m) => m.content)).toEqual([
      'Primeira mensagem',
      'Segunda mensagem',
    ]);
  });

  it('retorna apenas os campos esperados em cada mensagem', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot);
    await Message.create({
      conversation_id: conversation.id,
      content: 'Mensagem única',
      role: 'user',
      message_id: 'wamid.abc123',
    });

    const res = await request(app)
      .get(`/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Object.keys(res.body[0]).sort()).toEqual(
      [
        'id',
        'conversation_id',
        'content',
        'role',
        'message_id',
        'created_at',
      ].sort()
    );
  });

  it('retorna 404 quando a conversa não existe', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get(`/conversations/${randomUUID()}/messages`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('retorna 404 ao listar mensagens de conversa de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const botB = await createBotFor(userB);
    const conversationB = await createConversation(botB);

    const res = await request(app)
      .get(`/conversations/${conversationB.id}/messages`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('rejeita conversationId que não é um uuid válido (validação de schema)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get('/conversations/nao-e-um-uuid/messages')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('Messages — Store', () => {
  it('cria a mensagem, envia via WhatsApp e retorna 201', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot, {
      contact_phone: '551299998888',
    });

    const res = await request(app)
      .post(`/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Olá, tudo bem?' });

    expect(res.status).toBe(201);
    expect(res.body.content).toBe('Olá, tudo bem?');
    expect(res.body.role).toBe('assistant');

    expect(MessageService.saveAndEmit).toHaveBeenCalledWith({
      conversationId: conversation.id,
      content: 'Olá, tudo bem?',
      role: 'assistant',
    });

    expect(WhatsAppService.sendText).toHaveBeenCalledTimes(1);
    const [calledInstance, calledDestination, calledContent] =
      WhatsAppService.sendText.mock.calls[0];
    expect(calledInstance.id).toBe(bot.dataValues.instance_id);
    expect(calledDestination).toBe('551299998888');
    expect(calledContent).toBe('Olá, tudo bem?');
  });

  it('retorna 404 quando a conversa não existe', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post(`/conversations/${randomUUID()}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Oi' });

    expect(res.status).toBe(404);
    expect(MessageService.saveAndEmit).not.toHaveBeenCalled();
    expect(WhatsAppService.sendText).not.toHaveBeenCalled();
  });

  it('retorna 404 quando a conversa está fechada', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot, { status: 'closed' });

    const res = await request(app)
      .post(`/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Oi' });

    expect(res.status).toBe(404);
    expect(MessageService.saveAndEmit).not.toHaveBeenCalled();
  });

  it('retorna 404 ao enviar mensagem em conversa de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const botB = await createBotFor(userB);
    const conversationB = await createConversation(botB);

    const res = await request(app)
      .post(`/conversations/${conversationB.id}/messages`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'Oi' });

    expect(res.status).toBe(404);
    expect(MessageService.saveAndEmit).not.toHaveBeenCalled();
  });

  it('retorna 422 quando o contato ainda não foi resolvido (telefone termina com @lid)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot, {
      contact_phone: '123456789@lid',
    });

    const res = await request(app)
      .post(`/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Oi' });

    expect(res.status).toBe(422);
    expect(MessageService.saveAndEmit).not.toHaveBeenCalled();
    expect(WhatsAppService.sendText).not.toHaveBeenCalled();
  });

  it('retorna 422 quando o destino é o mesmo número da instância (bloqueio de auto-resposta)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot);
    ContactIdentityService.isSamePhoneNumber.mockReturnValueOnce(true);

    const res = await request(app)
      .post(`/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Oi' });

    expect(res.status).toBe(422);
    expect(MessageService.saveAndEmit).not.toHaveBeenCalled();
    expect(WhatsAppService.sendText).not.toHaveBeenCalled();
  });

  it('rejeita quando content está ausente (validação de schema)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot);

    const res = await request(app)
      .post(`/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(MessageService.saveAndEmit).not.toHaveBeenCalled();
  });

  it('rejeita content vazio ou só com espaços (validação de schema)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot);

    const res = await request(app)
      .post(`/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: '   ' });

    expect(res.status).toBe(400);
    expect(MessageService.saveAndEmit).not.toHaveBeenCalled();
  });

  it('rejeita content acima de 4096 caracteres (validação de schema)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot);

    const res = await request(app)
      .post(`/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'a'.repeat(4097) });

    expect(res.status).toBe(400);
    expect(MessageService.saveAndEmit).not.toHaveBeenCalled();
  });

  it('rejeita conversationId que não é um uuid válido (validação de schema)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post('/conversations/nao-e-um-uuid/messages')
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Oi' });

    expect(res.status).toBe(400);
    expect(MessageService.saveAndEmit).not.toHaveBeenCalled();
  });

  it('retorna 500 quando o envio via WhatsApp falha, mesmo com a mensagem já salva (ver NOTA no topo)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const conversation = await createConversation(bot);
    WhatsAppService.sendText.mockRejectedValueOnce(
      new Error('Falha simulada no envio')
    );

    const res = await request(app)
      .post(`/conversations/${conversation.id}/messages`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Oi' });

    expect(res.status).toBe(500);
    expect(MessageService.saveAndEmit).toHaveBeenCalledTimes(1);
  });
});
