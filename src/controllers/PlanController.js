import Plan from '../models/Plan.js';
import PlanAddon from '../models/PlanAddon.js';
import AddonPackage from '../models/AddonPackage.js';
import { handleError } from '../utils/handleError.js';

class PlanController {
  async index(req, res) {
    try {
      const plans = await Plan.findAll({
        order: [['price', 'ASC']],
        attributes: [
          'id',
          'name',
          'max_instances',
          'max_products',
          'max_messages_per_month',
          'price',
        ],
      });
      return res.status(200).json(plans);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async addons(req, res) {
    try {
      const plan = await Plan.findByPk(req.params.id, { attributes: ['id'] });

      if (!plan) {
        return res.status(404).json({ message: 'Plano não encontrado.' });
      }

      const planAddons = await PlanAddon.findAll({
        where: { plan_id: req.params.id },
        attributes: ['id', 'price'],
        include: [
          {
            model: AddonPackage,
            as: 'addon',
            attributes: ['id', 'name', 'extra_products'],
          },
        ],
      });

      return res.status(200).json(planAddons);
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new PlanController();
