import { Op } from 'sequelize';
import AdminAuditLog from '../models/AdminAuditLog';
import User from '../models/User';

class AdminAuditLogController {
  async index(req, res) {
    try {
      const {
        page = 1,
        limit = 20,
        admin_id = '',
        target_user_id = '',
        action = '',
      } = req.query;

      const where = {};
      if (admin_id) where.admin_id = admin_id;
      if (target_user_id) where.target_user_id = target_user_id;
      if (action) where.action = { [Op.like]: `%${action}%` };

      const { rows, count } = await AdminAuditLog.findAndCountAll({
        where,
        include: [
          { model: User, as: 'admin', attributes: ['id', 'name', 'email'] },
          {
            model: User,
            as: 'targetUser',
            attributes: ['id', 'name', 'email'],
          },
        ],
        limit: Number(limit),
        offset: (Number(page) - 1) * Number(limit),
        order: [['createdAt', 'DESC']],
      });

      return res.json({
        logs: rows,
        total: count,
        page: Number(page),
        pages: Math.ceil(count / Number(limit)),
      });
    } catch (err) {
      console.error('[AdminAuditLog] Erro ao listar logs:', err);
      return res.status(500).json({ error: 'Erro ao buscar logs' });
    }
  }

  async show(req, res) {
    try {
      const log = await AdminAuditLog.findByPk(req.params.id, {
        include: [
          { model: User, as: 'admin', attributes: ['id', 'name', 'email'] },
          {
            model: User,
            as: 'targetUser',
            attributes: ['id', 'name', 'email'],
          },
        ],
      });
      if (!log) return res.status(404).json({ error: 'Log não encontrado' });
      return res.json(log);
    } catch (err) {
      console.error('[AdminAuditLog] Erro ao buscar log:', err);
      return res.status(500).json({ error: 'Erro ao buscar log' });
    }
  }
}

export default new AdminAuditLogController();
