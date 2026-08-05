import StoreFront from '../models/StoreFront.js';
import User from '../models/User.js';
import Product from '../models/Product.js';

import { handleError } from '../utils/handleError.js';

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
        attributes: [
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
          'metadata',
        ],
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
        attributes: [
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
          'metadata',
        ],
      });

      res.json({ products });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new StoreController();
