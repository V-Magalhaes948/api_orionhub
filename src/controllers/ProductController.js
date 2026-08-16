import Sequelize from 'sequelize';

import Product from '../models/Product.js';
import User from '../models/User.js';
import Plan from '../models/Plan.js';
import AddonPackage from '../models/AddonPackage.js';

import { invalidateCache } from '../middlewares/cache.js';

import { getEffectiveProductLimit } from '../utils/generateProductLimit.js';
import { handleError } from '../utils/handleError.js';
import { logActivity } from '../utils/logActivity.js';

const MAX_FEATURED_PRODUCTS = 6;

const PRODUCT_ATTRIBUTES = [
  'id',
  'name',
  'description',
  'category',
  'brand',
  'pricing_mode',
  'unit_label',
  'price',
  'price_per_unit',
  'stock_quantity',
  'min_sale_quantity',
  'image_catalog_url',
  'image_vitrine_url',
  'active',
  'is_featured',
  'metadata',
  'created_at',
  'updated_at',
];

export function serializeProduct(product) {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    brand: product.brand,
    pricing_mode: product.pricing_mode,
    unit_label: product.unit_label,
    price: product.price,
    price_per_unit: product.price_per_unit,
    stock_quantity: product.stock_quantity,
    min_sale_quantity: product.min_sale_quantity,
    image_catalog_url: product.image_catalog_url,
    image_vitrine_url: product.image_vitrine_url,
    active: product.active,
    is_featured: product.is_featured,
    metadata: product.metadata,
    created_at: product.created_at,
    updated_at: product.updated_at,
  };
}

async function checkFeaturedLimit(userId, excludeProductId = null) {
  const where = { user_id: userId, is_featured: true };
  if (excludeProductId) {
    where.id = { [Sequelize.Op.ne]: excludeProductId };
  }
  const count = await Product.count({ where });
  if (count >= MAX_FEATURED_PRODUCTS) {
    return `Você já tem ${MAX_FEATURED_PRODUCTS} produtos na vitrine. Remova um antes de adicionar outro.`;
  }
  return null;
}

async function checkProductLimit(userId, excludeProductId = null) {
  const user = await User.findByPk(userId, {
    // ← usar o parâmetro
    attributes: ['id', 'addon_status', 'product_selection_pending'],
    include: [
      { model: Plan, as: 'plan', attributes: ['id', 'max_products'] },
      {
        model: AddonPackage,
        as: 'addon',
        attributes: ['id', 'extra_products'],
      },
    ],
  });

  const limit = getEffectiveProductLimit(user);

  const where = { user_id: userId, active: true };
  if (excludeProductId) {
    where.id = { [Sequelize.Op.ne]: excludeProductId };
  }

  const count = await Product.count({ where });

  if (count >= limit) {
    return `Você atingiu o limite de ${limit} produtos ativos do seu plano. Faça upgrade ou desative outro produto para continuar.`;
  }
  return null;
}

class ProductController {
  async index(req, res) {
    try {
      const { category, active } = req.query;
      const where = { user_id: req.userId };
      if (category) where.category = category;
      if (active !== undefined) where.active = active === 'true';

      const products = await Product.findAll({
        where,
        attributes: PRODUCT_ATTRIBUTES,
        order: [['updated_at', 'DESC']],
      });

      return res.status(200).json(products.map(serializeProduct));
    } catch (error) {
      return handleError(res, error);
    }
  }

  async show(req, res) {
    try {
      const product = await Product.findOne({
        where: { id: req.params.id, user_id: req.userId },
        attributes: PRODUCT_ATTRIBUTES,
      });

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      return res.status(200).json(serializeProduct(product));
    } catch (error) {
      return handleError(res, error);
    }
  }

  async store(req, res) {
    try {
      const {
        name,
        description,
        category,
        brand,
        pricing_mode,
        unit_label,
        price,
        is_featured,
        price_per_unit,
        stock_quantity,
        min_sale_quantity,
        image_catalog_url,
        image_vitrine_url,
        metadata,
      } = req.body;

      const limitError = await checkProductLimit(req.userId);
      if (limitError) {
        return res.status(400).json({ message: limitError });
      }

      if (is_featured && req.body.active === false) {
        return res.status(400).json({
          message:
            'Não é possível colocar um produto desativado na vitrine. Ative o produto primeiro.',
        });
      }

      if (is_featured) {
        const featuredLimitError = await checkFeaturedLimit(req.userId);
        if (featuredLimitError) {
          return res.status(400).json({ message: featuredLimitError });
        }
      }

      const product = await Product.create({
        user_id: req.userId,
        name,
        description,
        category,
        brand,
        pricing_mode,
        unit_label,
        price,
        is_featured: is_featured ?? false,
        price_per_unit,
        stock_quantity,
        min_sale_quantity,
        image_catalog_url,
        image_vitrine_url,
        metadata,
      });

      await logActivity({
        userId: req.userId,
        action: 'product.created',
        resourceType: 'product',
        resourceId: product.id,
        metadata: { name: product.name },
        ip: req.ip,
      });

      await invalidateCache(req.userId, ['/products']);
      await invalidateCache(req.userId, [
        '/stores/:slug/products',
        '/stores/:slug/featured-products',
      ]);

      return res.status(201).json({ product: serializeProduct(product) });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async update(req, res) {
    try {
      const product = await Product.findOne({
        where: { id: req.params.id, user_id: req.userId },
      });

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const {
        name,
        description,
        category,
        brand,
        pricing_mode,
        unit_label,
        price,
        is_featured,
        price_per_unit,
        stock_quantity,
        min_sale_quantity,
        image_catalog_url,
        image_vitrine_url,
        active,
        metadata,
      } = req.body;

      const nextActive = active !== undefined ? active : product.active;

      if (nextActive && !product.active) {
        const limitError = await checkProductLimit(req.userId, product.id);
        if (limitError) {
          return res.status(400).json({ message: limitError });
        }
      }

      let nextFeatured =
        is_featured !== undefined ? is_featured : product.is_featured;

      if (nextFeatured && !nextActive) {
        if (is_featured === true) {
          return res.status(400).json({
            message:
              'Não é possível colocar um produto desativado na vitrine. Ative o produto primeiro.',
          });
        }
        nextFeatured = false;
      }

      if (nextFeatured && !product.is_featured) {
        const limitError = await checkFeaturedLimit(req.userId, product.id);
        if (limitError) {
          return res.status(400).json({ message: limitError });
        }
      }

      await product.update({
        name,
        description,
        category,
        brand,
        pricing_mode,
        unit_label,
        is_featured: nextFeatured,
        price,
        price_per_unit,
        stock_quantity,
        min_sale_quantity,
        image_catalog_url,
        image_vitrine_url,
        active,
        metadata,
      });

      await logActivity({
        userId: req.userId,
        action: 'product.updated',
        resourceType: 'product',
        resourceId: product.id,
        metadata: { name: product.name },
        ip: req.ip,
      });

      await invalidateCache(req.userId, ['/products']);
      await invalidateCache(req.userId, [
        '/stores/:slug/products',
        '/stores/:slug/featured-products',
      ]);

      return res.status(200).json({ product: serializeProduct(product) });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async confirmSelection(req, res) {
    try {
      const { activeProductIds } = req.body;

      if (!Array.isArray(activeProductIds)) {
        return res
          .status(400)
          .json({ message: 'activeProductIds deve ser um array' });
      }

      const uniqueProductIds = [...new Set(activeProductIds)];

      const user = await User.findByPk(req.userId, {
        attributes: ['id', 'addon_status', 'product_selection_pending'],
        include: [
          { model: Plan, as: 'plan', attributes: ['id', 'max_products'] },
          {
            model: AddonPackage,
            as: 'addon',
            attributes: ['id', 'extra_products'],
          },
        ],
      });

      const limit = getEffectiveProductLimit(user);

      if (uniqueProductIds.length > limit) {
        return res
          .status(400)
          .json({ message: `Selecione no máximo ${limit} produtos` });
      }

      const owned = await Product.count({
        where: { user_id: user.id, id: uniqueProductIds },
      });
      if (owned !== uniqueProductIds.length) {
        return res
          .status(400)
          .json({ message: 'IDs inválidos ou não pertencem a este usuário' });
      }

      await Product.update({ active: false }, { where: { user_id: user.id } });
      await Product.update(
        { active: true },
        { where: { user_id: user.id, id: uniqueProductIds } }
      );

      await user.update({ product_selection_pending: false });

      await logActivity({
        userId: user.id,
        action: 'product.selection_confirmed',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { active_count: uniqueProductIds.length, limit },
        ip: req.ip,
      });

      await invalidateCache(user.id, ['/products']);
      await invalidateCache(user.id, [
        '/stores/:slug/products',
        '/stores/:slug/featured-products',
      ]);

      return res
        .status(200)
        .json({ message: 'Seleção confirmada com sucesso' });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async selectionStatus(req, res) {
    try {
      const user = await User.findByPk(req.userId, {
        attributes: ['id', 'addon_status', 'product_selection_pending'],
        include: [
          { model: Plan, as: 'plan', attributes: ['id', 'max_products'] },
          {
            model: AddonPackage,
            as: 'addon',
            attributes: ['id', 'extra_products'],
          },
        ],
      });

      const limit = getEffectiveProductLimit(user);

      const products = await Product.findAll({
        where: { user_id: req.userId },
        attributes: [
          'id',
          'name',
          'category',
          'brand',
          'price',
          'active',
          'image_vitrine_url',
          'updated_at',
        ],
        order: [['updated_at', 'DESC']],
      });

      return res.status(200).json({
        pending: user.product_selection_pending,
        limit,
        products: products.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          brand: p.brand,
          price: p.price,
          active: p.active,
          image_vitrine_url: p.image_vitrine_url,
          updated_at: p.updated_at,
        })),
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async destroy(req, res) {
    try {
      const product = await Product.findOne({
        where: { id: req.params.id, user_id: req.userId },
      });

      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      await product.destroy();

      await logActivity({
        userId: req.userId,
        action: 'product.deleted',
        resourceType: 'product',
        resourceId: product.id,
        metadata: { name: product.name },
        ip: req.ip,
      });

      await invalidateCache(req.userId, ['/products']);
      await invalidateCache(req.userId, [
        '/stores/:slug/products',
        '/stores/:slug/featured-products',
      ]);

      return res.status(200).json({ message: 'Product removed successfully' });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async recent(req, res) {
    try {
      const products = await Product.findAll({
        where: { user_id: req.userId, active: true },
        attributes: [
          'id',
          'name',
          'pricing_mode',
          'price',
          'price_per_unit',
          'unit_label',
          'image_vitrine_url',
        ],
        order: [['created_at', 'DESC']],
        limit: 5,
      });

      return res.status(200).json(products);
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new ProductController();
