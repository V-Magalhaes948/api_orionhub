import PromptTemplate from '../models/PromptTemplate.js';
import { handleError } from '../utils/handleError.js';

class PromptTemplateController {
  async index(req, res) {
    try {
      const templates = await PromptTemplate.findAll({
        where: { active: true },
        attributes: ['id', 'niche', 'label', 'description', 'content'],
        order: [['label', 'ASC']],
      });

      return res.status(200).json(templates);
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new PromptTemplateController();
