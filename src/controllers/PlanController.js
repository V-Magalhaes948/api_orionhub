import Plan from '../models/Plan.js';
import PlanAddon from '../models/PlanAddon.js';
import AddonPackage from '../models/AddonPackage.js';
import { handleError } from '../utils/handleError.js';

class PlanController {
  async index(req, res) {
    try {
      const plans = await Plan.findAll({
        order: [['price', 'ASC']],
      });
      return res.status(200).json(plans);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async addons(req, res) {
    try {
      const plan = await Plan.findByPk(req.params.id);

      if (!plan) {
        return res.status(404).json({ message: 'Plan not found' });
      }

      const planAddons = await PlanAddon.findAll({
        where: { plan_id: req.params.id },
        include: [{ model: AddonPackage, as: 'addon' }],
      });

      return res.status(200).json(planAddons);
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new PlanController();
