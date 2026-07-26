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
import Product from '../src/models/Product.js';
import Plan from '../src/models/Plan.js';
import AddonPackage from '../src/models/AddonPackage.js';
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

function validProductPayload(overrides = {}) {
  return {
    name: 'Produto Teste',
    description: 'Descrição do produto teste',
    category: 'Categoria A',
    brand: 'Marca X',
    pricing_mode: 'unit',
    unit_label: 'un',
    price: 29.9,
    stock_quantity: 10,
    min_sale_quantity: 1,
    ...overrides,
  };
}

async function createProduct(user, overrides = {}) {
  return Product.create({
    user_id: user.id,
    name: 'Produto Teste',
    pricing_mode: 'unit',
    unit_label: 'un',
    price: 29.9,
    ...overrides,
  });
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

async function createUserWithTokenAndPlan(overrides = {}) {
  const plan = await createPlan({ max_products: 50 });
  return createUserWithToken({ plan_id: plan.id, ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Products — Index', () => {
  it('lista os produtos do usuário ordenados por updated_at DESC', async () => {
    const { user, token } = await createUserWithToken();
    await createProduct(user, { name: 'Mais antigo' });
    await new Promise((r) => setTimeout(r, 1100));
    await createProduct(user, { name: 'Mais recente' });

    const res = await request(app)
      .get('/products')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].name).toBe('Mais recente');
  });

  it('não retorna produtos de outros usuários', async () => {
    const { user: userA, token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    await createProduct(userA);
    await createProduct(userB);
    await createProduct(userB);

    const res = await request(app)
      .get('/products')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it('filtra por category', async () => {
    const { user, token } = await createUserWithToken();
    await createProduct(user, { category: 'Perfumaria' });
    await createProduct(user, { category: 'Cosméticos' });

    const res = await request(app)
      .get('/products')
      .query({ category: 'Perfumaria' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].category).toBe('Perfumaria');
  });

  it('filtra por active', async () => {
    const { user, token } = await createUserWithToken();
    await createProduct(user, { active: true });
    await createProduct(user, { active: false });

    const res = await request(app)
      .get('/products')
      .query({ active: 'false' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].active).toBe(false);
  });

  it('rejeita active com valor fora de true/false (validação de schema)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get('/products')
      .query({ active: 'talvez' })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('Products — Show', () => {
  it('retorna os detalhes de um produto do próprio usuário', async () => {
    const { user, token } = await createUserWithToken();
    const product = await createProduct(user, { name: 'Perfume X' });

    const res = await request(app)
      .get(`/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(product.id);
    expect(res.body.name).toBe('Perfume X');
  });

  it('retorna 404 para produto inexistente', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get(`/products/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('retorna 404 ao ver produto de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const productB = await createProduct(userB);

    const res = await request(app)
      .get(`/products/${productB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('rejeita id que não é um uuid válido (validação de schema)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .get('/products/nao-e-um-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('Products — Store', () => {
  it('cria um produto vinculado ao usuário autenticado', async () => {
    const { user, token } = await createUserWithTokenAndPlan();

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProductPayload());

    expect(res.status).toBe(201);
    expect(res.body.product.name).toBe('Produto Teste');

    const stored = await Product.findByPk(res.body.product.id);
    expect(stored.user_id).toBe(user.id);
  });

  it('loga a atividade e invalida o cache de produtos', async () => {
    const { user, token } = await createUserWithTokenAndPlan();

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProductPayload({ name: 'Produto Logado' }));

    expect(res.status).toBe(201);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        action: 'product.created',
        resourceType: 'product',
        resourceId: res.body.product.id,
        metadata: expect.objectContaining({ name: 'Produto Logado' }),
      })
    );
    expect(invalidateCache).toHaveBeenCalledWith(user.id, ['/products']);
  });

  it('rejeita quando name está ausente (validação de schema)', async () => {
    const { token } = await createUserWithTokenAndPlan();
    const payload = validProductPayload();
    delete payload.name;

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(400);
  });

  it('rejeita pricing_mode fora do enum (validação de schema)', async () => {
    const { token } = await createUserWithTokenAndPlan();

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProductPayload({ pricing_mode: 'inválido' }));

    expect(res.status).toBe(400);
  });

  it('rejeita price negativo (validação de schema)', async () => {
    const { token } = await createUserWithTokenAndPlan();

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProductPayload({ price: -10 }));

    expect(res.status).toBe(400);
  });

  it('rejeita image_catalog_url que não é uma URL válida (validação de schema)', async () => {
    const { token } = await createUserWithTokenAndPlan();

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProductPayload({ image_catalog_url: 'nao-e-url' }));

    expect(res.status).toBe(400);
  });

  it('aceita image_catalog_url vazia (string vazia é permitida pelo schema)', async () => {
    const { token } = await createUserWithTokenAndPlan();

    const res = await request(app)
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .send(validProductPayload({ image_catalog_url: '' }));

    expect(res.status).toBe(201);
  });
});

describe('Products — Update', () => {
  it('atualiza os campos enviados com sucesso quando o payload está completo', async () => {
    const { user, token } = await createUserWithToken();
    const product = await createProduct(user, { name: 'Nome antigo' });

    const res = await request(app)
      .put(`/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(validProductPayload({ name: 'Nome novo', price: 55.5 }));

    expect(res.status).toBe(200);
    expect(res.body.product.name).toBe('Nome novo');
    expect(Number(res.body.product.price)).toBe(55.5);
  });

  it('loga a atividade e invalida o cache ao atualizar', async () => {
    const { user, token } = await createUserWithToken();
    const product = await createProduct(user);

    const res = await request(app)
      .put(`/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send(validProductPayload({ name: 'Produto Atualizado' }));

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        action: 'product.updated',
        resourceType: 'product',
        resourceId: product.id,
        metadata: expect.objectContaining({ name: 'Produto Atualizado' }),
      })
    );
    expect(invalidateCache).toHaveBeenCalledWith(user.id, ['/products']);
  });

  it('retorna 404 para produto inexistente', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .put(`/products/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`)
      .send(validProductPayload());

    expect(res.status).toBe(404);
  });

  it('retorna 404 ao atualizar produto de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const productB = await createProduct(userB);

    const res = await request(app)
      .put(`/products/${productB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validProductPayload());

    expect(res.status).toBe(404);
  });

  it(
    'PUT parcial sem pricing_mode/unit_label preserva os valores existentes ' +
      '(Sequelize ignora chaves com valor undefined em .update())',
    async () => {
      // CORREÇÃO em relação à suspeita inicial: a hipótese era que
      // pricing_mode/unit_label (ENUM allowNull:false no banco, mas
      // opcionais no Zod) chegariam como `undefined` quando omitidos do
      // body e o `product.update()` tentaria setar a coluna como NULL,
      // quebrando com 500. Testado contra o banco real, o comportamento é
      // outro: o Sequelize ignora chaves cujo valor é `undefined` em
      // `.update()` — só `null` explícito sobrescreve a coluna. Então um
      // PUT parcial sem esses campos simplesmente preserva o valor já
      // salvo, sem erro.
      const { user, token } = await createUserWithToken();
      const product = await createProduct(user, {
        pricing_mode: 'unit',
        unit_label: 'un',
      });

      const res = await request(app)
        .put(`/products/${product.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Só o nome mudou' });

      expect(res.status).toBe(200);
      expect(res.body.product.name).toBe('Só o nome mudou');
      expect(res.body.product.pricing_mode).toBe('unit');
      expect(res.body.product.unit_label).toBe('un');
    }
  );

  it('PUT parcial sem description preserva o valor existente (Sequelize ignora undefined em .update())', async () => {
    // Mesma correção do teste acima: description é nullable, mas omitir o
    // campo do body não apaga o valor salvo — o Sequelize não inclui essa
    // coluna no UPDATE quando o valor recebido é undefined.
    const { user, token } = await createUserWithToken();
    const product = await createProduct(user, {
      description: 'Descrição original que deveria ser preservada',
      pricing_mode: 'unit',
      unit_label: 'un',
    });

    const res = await request(app)
      .put(`/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: product.name,
        pricing_mode: 'unit',
        unit_label: 'un',
      });

    expect(res.status).toBe(200);
    expect(res.body.product.description).toBe(
      'Descrição original que deveria ser preservada'
    );
  });

  it('rejeita id que não é um uuid válido (validação de schema)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .put('/products/nao-e-um-uuid')
      .set('Authorization', `Bearer ${token}`)
      .send(validProductPayload());

    expect(res.status).toBe(400);
  });
});

describe('Products — Destroy', () => {
  it('remove o produto do próprio usuário', async () => {
    const { user, token } = await createUserWithToken();
    const product = await createProduct(user);

    const res = await request(app)
      .delete(`/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const deleted = await Product.findByPk(product.id);
    expect(deleted).toBeNull();
  });

  it('loga a atividade e invalida o cache ao remover', async () => {
    const { user, token } = await createUserWithToken();
    const product = await createProduct(user, { name: 'Produto a remover' });

    const res = await request(app)
      .delete(`/products/${product.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        action: 'product.deleted',
        resourceType: 'product',
        resourceId: product.id,
        metadata: expect.objectContaining({ name: 'Produto a remover' }),
      })
    );
    expect(invalidateCache).toHaveBeenCalledWith(user.id, ['/products']);
  });

  it('retorna 404 para produto inexistente', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .delete(`/products/${randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
  });

  it('retorna 404 ao remover produto de outro usuário (isolamento de tenant)', async () => {
    const { token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const productB = await createProduct(userB);

    const res = await request(app)
      .delete(`/products/${productB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.status).toBe(404);
  });

  it('rejeita id que não é um uuid válido (validação de schema)', async () => {
    const { token } = await createUserWithToken();

    const res = await request(app)
      .delete('/products/nao-e-um-uuid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });
});

describe('Products — selectionStatus (GET /products/selection)', () => {
  it('retorna pending, limit e a lista de produtos do usuário', async () => {
    const plan = await createPlan({ max_products: 4 });
    const { user, token } = await createUserWithToken({
      plan_id: plan.id,
      product_selection_pending: true,
    });
    await createProduct(user, { name: 'Produto A', active: true });
    await new Promise((r) => setTimeout(r, 1100));
    await createProduct(user, { name: 'Produto B', active: false });

    const res = await request(app)
      .get('/products/selection')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(true);
    expect(res.body.limit).toBe(4);
    expect(res.body.products).toHaveLength(2);
    expect(res.body.products[0].name).toBe('Produto B');
  });

  it('soma o bônus do addon ao limite quando addon_status é active', async () => {
    const plan = await createPlan({ max_products: 3 });
    const addon = await createAddon({ extra_products: 5 });
    const { token } = await createUserWithToken({
      plan_id: plan.id,
      addon_id: addon.id,
      addon_status: 'active',
    });

    const res = await request(app)
      .get('/products/selection')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(8);
  });

  it('não soma o bônus do addon quando addon_status não é active', async () => {
    const plan = await createPlan({ max_products: 3 });
    const addon = await createAddon({ extra_products: 5 });
    const { token } = await createUserWithToken({
      plan_id: plan.id,
      addon_id: addon.id,
      addon_status: 'expired',
    });

    const res = await request(app)
      .get('/products/selection')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(3);
  });

  it('retorna limit 0 quando o usuário não tem plano associado', async () => {
    const { token } = await createUserWithToken({ plan_id: null });

    const res = await request(app)
      .get('/products/selection')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(0);
  });
});

describe('Products — confirmSelection (POST /products/selection)', () => {
  it('ativa somente os produtos selecionados e desativa os demais', async () => {
    const plan = await createPlan({ max_products: 3 });
    const { user, token } = await createUserWithToken({
      plan_id: plan.id,
      product_selection_pending: true,
    });
    const keep = await createProduct(user, { name: 'Mantido', active: false });
    const drop = await createProduct(user, {
      name: 'Descartado',
      active: true,
    });

    const res = await request(app)
      .post('/products/selection')
      .set('Authorization', `Bearer ${token}`)
      .send({ activeProductIds: [keep.id] });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Seleção confirmada com sucesso');

    const refreshedKeep = await Product.findByPk(keep.id);
    const refreshedDrop = await Product.findByPk(drop.id);
    expect(refreshedKeep.active).toBe(true);
    expect(refreshedDrop.active).toBe(false);

    const refreshedUser = await User.findByPk(user.id);
    expect(refreshedUser.product_selection_pending).toBe(false);
  });

  it('loga a atividade e invalida o cache ao confirmar a seleção', async () => {
    const plan = await createPlan({ max_products: 3 });
    const { user, token } = await createUserWithToken({ plan_id: plan.id });
    const product = await createProduct(user);

    const res = await request(app)
      .post('/products/selection')
      .set('Authorization', `Bearer ${token}`)
      .send({ activeProductIds: [product.id] });

    expect(res.status).toBe(200);
    expect(logActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        action: 'product.selection_confirmed',
        resourceType: 'user',
        resourceId: user.id,
        metadata: expect.objectContaining({ active_count: 1, limit: 3 }),
      })
    );
    expect(invalidateCache).toHaveBeenCalledWith(user.id, ['/products']);
  });

  it('rejeita quando activeProductIds não é um array', async () => {
    const plan = await createPlan({ max_products: 3 });
    const { token } = await createUserWithToken({ plan_id: plan.id });

    const res = await request(app)
      .post('/products/selection')
      .set('Authorization', `Bearer ${token}`)
      .send({ activeProductIds: 'nao-e-array' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('activeProductIds deve ser um array');
  });

  it('rejeita quando a quantidade selecionada excede o limite efetivo do plano', async () => {
    const plan = await createPlan({ max_products: 1 });
    const { user, token } = await createUserWithToken({ plan_id: plan.id });
    const productA = await createProduct(user);
    const productB = await createProduct(user);

    const res = await request(app)
      .post('/products/selection')
      .set('Authorization', `Bearer ${token}`)
      .send({ activeProductIds: [productA.id, productB.id] });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Selecione no máximo 1 produtos');
  });

  it('considera o bônus do addon ativo ao calcular o limite permitido', async () => {
    const plan = await createPlan({ max_products: 1 });
    const addon = await createAddon({ extra_products: 2 });
    const { user, token } = await createUserWithToken({
      plan_id: plan.id,
      addon_id: addon.id,
      addon_status: 'active',
    });
    const productA = await createProduct(user);
    const productB = await createProduct(user);
    const productC = await createProduct(user);

    const res = await request(app)
      .post('/products/selection')
      .set('Authorization', `Bearer ${token}`)
      .send({ activeProductIds: [productA.id, productB.id, productC.id] });

    expect(res.status).toBe(200);
  });

  it('rejeita quando algum id não pertence ao usuário (ownership)', async () => {
    const plan = await createPlan({ max_products: 5 });
    const { user, token } = await createUserWithToken({ plan_id: plan.id });
    const { user: outroUsuario } = await createUserWithToken();
    const productProprio = await createProduct(user, { active: false });
    const productDeOutro = await createProduct(outroUsuario);

    const res = await request(app)
      .post('/products/selection')
      .set('Authorization', `Bearer ${token}`)
      .send({ activeProductIds: [productProprio.id, productDeOutro.id] });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(
      'IDs inválidos ou não pertencem a este usuário'
    );

    const refreshed = await Product.findByPk(productProprio.id);
    expect(refreshed.active).toBe(false);
  });

  it('aceita seleção com id duplicado em activeProductIds (dedupe aplicado no controller)', async () => {
    const plan = await createPlan({ max_products: 5 });
    const { user, token } = await createUserWithToken({ plan_id: plan.id });
    const product = await createProduct(user);

    const res = await request(app)
      .post('/products/selection')
      .set('Authorization', `Bearer ${token}`)
      .send({ activeProductIds: [product.id, product.id] });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Seleção confirmada com sucesso');

    const refreshed = await Product.findByPk(product.id);
    expect(refreshed.active).toBe(true);
  });

  it('conta apenas ids distintos ao validar o limite (duplicata não deve contar em dobro)', async () => {
    const plan = await createPlan({ max_products: 1 });
    const { user, token } = await createUserWithToken({ plan_id: plan.id });
    const product = await createProduct(user);

    const res = await request(app)
      .post('/products/selection')
      .set('Authorization', `Bearer ${token}`)
      .send({ activeProductIds: [product.id, product.id] });

    expect(res.status).toBe(200);
  });

  it('aceita array vazio e desativa todos os produtos do usuário', async () => {
    const plan = await createPlan({ max_products: 3 });
    const { user, token } = await createUserWithToken({ plan_id: plan.id });
    const product = await createProduct(user, { active: true });

    const res = await request(app)
      .post('/products/selection')
      .set('Authorization', `Bearer ${token}`)
      .send({ activeProductIds: [] });

    expect(res.status).toBe(200);

    const refreshed = await Product.findByPk(product.id);
    expect(refreshed.active).toBe(false);
  });
});
