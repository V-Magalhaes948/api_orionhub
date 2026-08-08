import StoreFront from '../models/StoreFront.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import Product from '../models/Product.js';

import { handleError } from '../utils/handleError.js';

const SLUG_REGEX = /^[a-z0-9-]{3,50}$/;
const RESERVED_SLUGS = [
  'admin',
  'api',
  'app',
  'login',
  'register',
  'dashboard',
  'settings',
  'webhook',
  'uploads',
  'static',
  'assets',
];

const ATTRIBUTES = [
  'id',
  'name',
  'description',
  'category',
  'stock_quantity',
  'brand',
  'pricing_mode',
  'unit_label',
  'price',
  'price_per_unit',
  'min_sale_quantity',
  'image_catalog_url',
  'image_vitrine_url',
  'metadata',
];

const ESSENTIAL_OR_ABOVE = ['essential', 'presence', 'plus'];

function serializeStorefront(storefront) {
  return {
    id: storefront.id,
    slug: storefront.slug,
  };
}

async function hasEssentialOrAbove(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'plan_status'],
    include: [{ model: Plan, as: 'plan', attributes: ['id', 'name'] }],
  });

  if (!user?.plan) return false;
  const activeOrTrial = ['active', 'trialing'].includes(user.plan_status);
  return (
    activeOrTrial && ESSENTIAL_OR_ABOVE.includes(user.plan.name.toLowerCase())
  );
}

class StoreController {
  async index(req, res) {
    try {
      const { slug } = req.params;
      const storefront = await StoreFront.findOne({ where: { slug } });
      if (!storefront)
        return res.status(404).json({ error: 'Loja não encontrada' });

      const user = await User.findByPk(storefront.user_id, {
        attributes: ['id', 'name'],
      });

      res.json({ slug: storefront.slug, name: user.name });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async indexProducts(req, res) {
    try {
      const { slug } = req.params;
      const storefront = await StoreFront.findOne({ where: { slug } });
      if (!storefront)
        return res.status(404).json({ error: 'Loja não encontrada' });

      const products = await Product.findAll({
        where: { user_id: storefront.user_id, active: true },
        attributes: ATTRIBUTES,
      });

      res.json({ products });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async featuredProducts(req, res) {
    try {
      const { slug } = req.params;
      const storefront = await StoreFront.findOne({ where: { slug } });
      if (!storefront)
        return res.status(404).json({ error: 'Loja não encontrada' });

      const products = await Product.findAll({
        where: {
          user_id: storefront.user_id,
          active: true,
          is_featured: true,
        },
        attributes: ATTRIBUTES,
      });

      res.json({ products });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async checkSlug(req, res) {
    try {
      const { slug } = req.params;
      if (!SLUG_REGEX.test(slug) || RESERVED_SLUGS.includes(slug)) {
        return res.status(200).json({ available: false });
      }
      const existing = await StoreFront.findOne({ where: { slug } });
      return res.status(200).json({ available: !existing });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async store(req, res) {
    try {
      const { slug } = req.body;

      if (!slug || !SLUG_REGEX.test(slug) || RESERVED_SLUGS.includes(slug)) {
        return res.status(400).json({ message: 'Path inválido.' });
      }

      const eligible = await hasEssentialOrAbove(req.userId);
      if (!eligible) {
        return res.status(403).json({
          message:
            'A criação de loja requer plano Essential ou superior, com assinatura ativa ou em trial.',
        });
      }

      const existingStore = await StoreFront.findOne({
        where: { user_id: req.userId },
      });
      if (existingStore) {
        return res
          .status(409)
          .json({ message: 'Você já possui uma loja criada.' });
      }

      const existingSlug = await StoreFront.findOne({ where: { slug } });
      if (existingSlug) {
        return res.status(409).json({ message: 'Esse path já está em uso.' });
      }

      const storeFront = await StoreFront.create({ user_id: req.userId, slug });
      return res.status(201).json(serializeStorefront(storeFront));
    } catch (error) {
      return handleError(res, error);
    }
  }

  async me(req, res) {
    try {
      const storefront = await StoreFront.findOne({
        where: { user_id: req.userId },
      });

      return res
        .status(200)
        .json(storefront ? serializeStorefront(storefront) : null);
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new StoreController();
