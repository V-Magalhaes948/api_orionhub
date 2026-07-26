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
import Flow from '../src/models/Flow.js';
import FlowStep from '../src/models/FlowStep.js';
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

async function createFlowWithSteps(steps = []) {
  const flow = await Flow.create();
  await FlowStep.bulkCreate(
    steps.map((step, index) => ({
      flow_id: flow.id,
      order: index + 1,
      content: step.content ?? `Passo ${index + 1}`,
      completion_criteria: step.completion_criteria ?? 'Critério padrão',
      closes_conversation: step.closes_conversation ?? false,
      include_catalog: step.include_catalog ?? false,
    }))
  );
  return flow;
}

function validStep(overrides = {}) {
  return {
    content: 'Envie uma mensagem de boas-vindas',
    completion_criteria: 'Usuário respondeu com o nome',
    closes_conversation: false,
    include_catalog: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Flows — Show', () => {
  it('retorna null com status 200 quando o bot ainda não tem fluxo', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .get(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it('retorna o fluxo com os passos ordenados', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const flow = await createFlowWithSteps([
      { content: 'Primeiro passo' },
      { content: 'Segundo passo' },
      { content: 'Terceiro passo' },
    ]);
    await bot.update({ flow_id: flow.id });

    const res = await request(app)
      .get(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(flow.id);
    expect(res.body.steps).toHaveLength(3);
    expect(res.body.steps.map((s) => s.content)).toEqual([
      'Primeiro passo',
      'Segundo passo',
      'Terceiro passo',
    ]);
  });

  it('retorna 404 quando o bot não existe', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get(`/flows/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('retorna 404 ao tentar ver o fluxo de um bot de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const botB = await createBotFor(userB);

    const res = await request(app)
      .get(`/flows/${botB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('rejeita botId que não é um uuid válido (validação de schema)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get('/flows/nao-e-um-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('Flows — Store', () => {
  it('cria um fluxo com os passos enviados e vincula ao bot', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .post(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [validStep(), validStep({ content: 'Segunda etapa' })] });

    expect(res.status).toBe(201);
    expect(res.body.flow).toBeDefined();

    const updatedBot = await Bot.findByPk(bot.id);
    expect(updatedBot.flow_id).toBe(res.body.flow);

    const steps = await FlowStep.findAll({
      where: { flow_id: res.body.flow },
      order: [['order', 'ASC']],
    });
    expect(steps).toHaveLength(2);
    expect(steps[0].order).toBe(1);
    expect(steps[1].order).toBe(2);
  });

  it('loga a atividade de criação do fluxo', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .post(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [validStep()] });

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        action: 'flow.created',
        resourceType: 'flow',
        resourceId: res.body.flow,
        metadata: expect.objectContaining({ bot_id: bot.id }),
      })
    );
  });

  it('retorna 404 quando o bot não existe', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .post(`/flows/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [validStep()] });

    expect(res.status).toBe(404);
  });

  it('retorna 404 ao tentar criar fluxo em bot de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const botB = await createBotFor(userB);

    const res = await request(app)
      .post(`/flows/${botB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ steps: [validStep()] });

    expect(res.status).toBe(404);
  });

  it('retorna 409 quando o bot já possui um fluxo', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const flow = await createFlowWithSteps([{}]);
    await bot.update({ flow_id: flow.id });

    const res = await request(app)
      .post(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [validStep()] });

    expect(res.status).toBe(409);
  });

  it('rejeita quando steps está vazio (validação de schema)', async () => {
    const { token } = await createUserWithToken();
    const { user } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .post(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [] });

    expect(res.status).toBe(400);
  });

  it('rejeita quando um passo não tem content (validação de schema)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .post(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [{ completion_criteria: 'Algum critério' }] });

    expect(res.status).toBe(400);
  });

  it('rejeita quando um passo não tem completion_criteria (validação de schema)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .post(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [{ content: 'Só o conteúdo' }] });

    expect(res.status).toBe(400);
  });

  it('aplica os defaults de closes_conversation e include_catalog quando não informados', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .post(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        steps: [
          { content: 'Passo simples', completion_criteria: 'Critério simples' },
        ],
      });

    expect(res.status).toBe(201);

    const [step] = await FlowStep.findAll({
      where: { flow_id: res.body.flow },
    });
    expect(step.closes_conversation).toBe(false);
    expect(step.include_catalog).toBe(false);
  });
});

describe('Flows — Update', () => {
  it('substitui os passos existentes pelos novos', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const flow = await createFlowWithSteps([
      { content: 'Passo antigo 1' },
      { content: 'Passo antigo 2' },
    ]);
    await bot.update({ flow_id: flow.id });

    const res = await request(app)
      .put(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [validStep({ content: 'Passo novo único' })] });

    expect(res.status).toBe(200);
    expect(res.body.flowId).toBe(flow.id);

    const steps = await FlowStep.findAll({ where: { flow_id: flow.id } });
    expect(steps).toHaveLength(1);
    expect(steps[0].content).toBe('Passo novo único');
  });

  it('loga a atividade de atualização do fluxo', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const flow = await createFlowWithSteps([{}]);
    await bot.update({ flow_id: flow.id });

    const res = await request(app)
      .put(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [validStep()] });

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        action: 'flow.updated',
        resourceType: 'flow',
        resourceId: flow.id,
        metadata: expect.objectContaining({ bot_id: bot.id }),
      })
    );
  });

  it('retorna 404 quando o bot não existe', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .put(`/flows/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [validStep()] });

    expect(res.status).toBe(404);
  });

  it('retorna 404 quando o bot ainda não tem fluxo', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .put(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [validStep()] });

    expect(res.status).toBe(404);
  });

  it('retorna 404 ao tentar atualizar fluxo de bot de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const botB = await createBotFor(userB);
    const flow = await createFlowWithSteps([{}]);
    await botB.update({ flow_id: flow.id });

    const res = await request(app)
      .put(`/flows/${botB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ steps: [validStep()] });

    expect(res.status).toBe(404);
  });

  it('rejeita quando steps está vazio (validação de schema)', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const flow = await createFlowWithSteps([{}]);
    await bot.update({ flow_id: flow.id });

    const res = await request(app)
      .put(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ steps: [] });

    expect(res.status).toBe(400);
  });
});

describe('Flows — Destroy', () => {
  it('exclui o fluxo e desvincula do bot', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const flow = await createFlowWithSteps([{}, {}]);
    await bot.update({ flow_id: flow.id });

    const res = await request(app)
      .delete(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.flowId).toBe(flow.id);

    const updatedBot = await Bot.findByPk(bot.id);
    expect(updatedBot.flow_id).toBeNull();

    const deletedFlow = await Flow.findByPk(flow.id);
    expect(deletedFlow).toBeNull();

    const remainingSteps = await FlowStep.findAll({
      where: { flow_id: flow.id },
    });
    expect(remainingSteps).toHaveLength(0);
  });

  it('loga a atividade de exclusão do fluxo com o resourceId correto', async () => {
    // NOTA: este teste expõe um bug em FlowController.destroy — o código atual
    // referencia a variável inexistente `flow.id` em vez de `flowId`, o que
    // lança um ReferenceError e faz a rota responder 500 mesmo após o delete
    // já ter sido efetivado no banco. Este teste deve passar somente após a
    // correção (`resourceId: flowId`).
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);
    const flow = await createFlowWithSteps([{}]);
    await bot.update({ flow_id: flow.id });

    const res = await request(app)
      .delete(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        action: 'flow.deleted',
        resourceType: 'flow',
        resourceId: flow.id,
        metadata: expect.objectContaining({ bot_id: bot.id }),
      })
    );
  });

  it('retorna 404 quando o bot não existe', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .delete(`/flows/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('retorna 404 quando o bot ainda não tem fluxo', async () => {
    const { user, token } = await createUserWithToken();
    const bot = await createBotFor(user);

    const res = await request(app)
      .delete(`/flows/${bot.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('retorna 404 ao tentar excluir fluxo de bot de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const botB = await createBotFor(userB);
    const flow = await createFlowWithSteps([{}]);
    await botB.update({ flow_id: flow.id });

    const res = await request(app)
      .delete(`/flows/${botB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('rejeita botId que não é um uuid válido (validação de schema)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .delete('/flows/nao-e-um-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});
