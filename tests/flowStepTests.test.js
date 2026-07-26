import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

vi.mock('../src/webhook/handlers/flowHandler.js', () => ({
  executeStep: vi.fn(async () => ({
    reply: 'Resposta simulada do passo',
    completed: false,
  })),
}));

import app from '../src/app.js';
import User from '../src/models/User.js';
import Instance from '../src/models/Instance.js';
import Bot from '../src/models/Bot.js';
import { executeStep } from '../src/webhook/handlers/flowHandler.js';

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

async function createBotFor(user, overrides = {}) {
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
    ...overrides,
  });
}

function validPayload(overrides = {}) {
  return {
    content: 'Pergunte o nome do cliente',
    completion_criteria: 'Cliente informou o nome',
    closes_conversation: false,
    next_step_content: null,
    user_message: 'Meu nome é João',
    history: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FlowStepTest — Store', () => {
  it('retorna 200 com o resultado do executeStep quando o payload é válido', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      reply: 'Resposta simulada do passo',
      completed: false,
    });
  });

  it('chama executeStep com o bot correto, o step montado e a mensagem do usuário', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(
        validPayload({
          content: 'Etapa X',
          completion_criteria: 'Critério X',
          closes_conversation: true,
          user_message: 'Oi',
          history: [{ role: 'user', content: 'Olá' }],
        })
      );

    expect(res.status).toBe(200);
    expect(executeStep).toHaveBeenCalledTimes(1);

    const [calledBot, fakeStep, fakeNextStep, userMessage, history] =
      executeStep.mock.calls[0];

    expect(calledBot.id).toBe(bot.id);
    expect(fakeStep).toEqual({
      content: 'Etapa X',
      completion_criteria: 'Critério X',
      closes_conversation: true,
    });
    expect(fakeNextStep).toBeNull();
    expect(userMessage).toBe('Oi');
    // executeStep espera que o último item do history seja a mensagem
    // atual (é assim que o fluxo real entrega, via banco). O controller
    // de teste remonta esse formato concatenando o user_message no final,
    // pra não perder a última mensagem de contexto real enviada no body.
    expect(history).toEqual([
      { role: 'user', content: 'Olá' },
      { role: 'user', content: 'Oi' },
    ]);
  });

  it('monta fakeNextStep quando next_step_content é informado', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload({ next_step_content: 'Próxima etapa' }));

    const [, , fakeNextStep] = executeStep.mock.calls[0];
    expect(fakeNextStep).toEqual({ content: 'Próxima etapa' });
  });

  it('aplica default de closes_conversation (false) quando não informado', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const payload = validPayload();
    delete payload.closes_conversation;

    await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    const [, fakeStep] = executeStep.mock.calls[0];
    expect(fakeStep.closes_conversation).toBe(false);
  });

  it('aplica default de history ([]) e concatena a mensagem atual quando history não é informado', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const payload = validPayload();
    delete payload.history;

    await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    const [, , , , history] = executeStep.mock.calls[0];
    // history default é [], mas o controller sempre concatena a mensagem
    // atual no final antes de chamar executeStep — então o resultado não
    // é [], e sim um array com só a mensagem atual.
    expect(history).toEqual([{ role: 'user', content: payload.user_message }]);
  });

  it('concatena a mensagem atual ao final do history recebido, preservando o contexto anterior', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(
        validPayload({
          user_message: 'Mensagem final',
          history: [
            { role: 'user', content: 'Msg 1' },
            { role: 'assistant', content: 'Msg 2' },
            { role: 'user', content: 'Msg 3' },
          ],
        })
      );

    const [, , , , history] = executeStep.mock.calls[0];
    expect(history).toEqual([
      { role: 'user', content: 'Msg 1' },
      { role: 'assistant', content: 'Msg 2' },
      { role: 'user', content: 'Msg 3' },
      { role: 'user', content: 'Mensagem final' },
    ]);
  });

  it('retorna 401 sem token de autenticação', async () => {
    const { user } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .send(validPayload());

    expect(res.status).toBe(401);
    expect(executeStep).not.toHaveBeenCalled();
  });

  it('retorna 404 quando o bot não existe', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post(`/bots/${randomUUID()}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());

    expect(res.status).toBe(404);
    expect(executeStep).not.toHaveBeenCalled();
  });

  it('retorna 404 ao testar passo em bot de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const botB = await createBotFor(userB);

    const res = await request(app)
      .post(`/bots/${botB.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validPayload());

    expect(res.status).toBe(404);
    expect(executeStep).not.toHaveBeenCalled();
  });

  it('rejeita botId que não é um uuid válido (validação de schema)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post('/bots/nao-e-um-uuid/flow-steps/test')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());

    expect(res.status).toBe(400);
    expect(executeStep).not.toHaveBeenCalled();
  });

  it('rejeita quando content está ausente (validação de schema)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const payload = validPayload();
    delete payload.content;

    const res = await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(400);
  });

  it('rejeita quando completion_criteria está ausente (validação de schema)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const payload = validPayload();
    delete payload.completion_criteria;

    const res = await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(400);
  });

  it('rejeita quando user_message está ausente (validação de schema)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const payload = validPayload();
    delete payload.user_message;

    const res = await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(400);
  });

  it('rejeita user_message vazio (validação de schema)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload({ user_message: '   ' }));

    expect(res.status).toBe(400);
  });

  it('rejeita item de history com role inválido (validação de schema)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(
        validPayload({
          history: [{ role: 'system', content: 'Instrução' }],
        })
      );

    expect(res.status).toBe(400);
  });

  it('retorna 500 quando executeStep lança um erro inesperado', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    executeStep.mockRejectedValueOnce(new Error('Falha simulada na LLM'));

    const res = await request(app)
      .post(`/bots/${bot.id}/flow-steps/test`)
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());

    expect(res.status).toBe(500);
  });
});
