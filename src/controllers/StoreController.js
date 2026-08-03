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
      });

      res.json({ products });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new StoreController();
