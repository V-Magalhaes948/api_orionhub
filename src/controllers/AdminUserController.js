import { Op } from 'sequelize';

import User from '../models/User.js';
import Plan from '../models/Plan.js';
import Product from '../models/Product.js';
import PlanAddon from '../models/PlanAddon.js';
import AddonPackage from '../models/AddonPackage.js';

import { invalidateCache } from '../middlewares/cache.js';

import { logActivity } from '../utils/logActivity.js';
import { handleError } from '../utils/handleError.js';
import { getEffectiveProductLimit } from '../utils/generateProductLimit.js';

import { expireUserAccess } from '../services/planExpirationService.js';
import SocketService from '../services/socketService.js';

class AdminUserController {
  async index(req, res) {
    try {
      const { search, plan_id, account_status } = req.query;
      const page = Number(req.query.page) || 1;
      const limit = Number(req.query.limit) || 20;

      const where = {};
      if (search) {
        where[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ];
      }
      if (plan_id) where.plan_id = plan_id;
      if (account_status) where.account_status = account_status;

      const { rows, count } = await User.findAndCountAll({
        where,
        attributes: [
          'id',
          'name',
          'email',
          'plan_id',
          'plan_status',
          'plan_expires_at',
          'addon_id',
          'addon_status',
          'addon_expires_at',
          'account_status',
          'is_admin',
          'created_at',
          'last_login_at',
        ],
        include: [
          { model: Plan, as: 'plan', attributes: ['id', 'name', 'price'] },
        ],
        limit,
        offset: (page - 1) * limit,
        order: [['created_at', 'DESC']],
      });

      return res.json({
        users: rows,
        total: count,
        page,
        pages: Math.ceil(count / limit),
      });
    } catch (err) {
      return handleError(res, err);
    }
  }

  async show(req, res) {
    try {
      const user = await User.findByPk(req.params.id, {
        attributes: { exclude: ['password_hash', 'refresh_token'] },
        include: [{ model: Plan, as: 'plan' }],
      });
      if (!user)
        return res.status(404).json({ error: 'Usuário não encontrado' });
      return res.json(user);
    } catch (err) {
      return handleError(res, err);
    }
  }

  async updatePlan(req, res) {
    try {
      const { plan_id, duration_days, addon_id, addon_duration_days } =
        req.body;

      const user = await User.findByPk(req.params.id);

      if (!user)
        return res.status(404).json({ error: 'Usuário não encontrado' });

      let plan = null;

      if (plan_id) {
        plan = await Plan.findByPk(plan_id);
        if (!plan) return res.status(400).json({ error: 'Plano inválido' });
      }

      if (addon_id && user.is_admin) {
        return res
          .status(400)
          .json({ error: 'Contas admin não podem ter pacotes adicionais' });
      }

      let addon = null;
      if (addon_id) {
        if (!plan_id) {
          return res
            .status(400)
            .json({ error: 'Addon requer um plano válido' });
        }

        const pricing = await PlanAddon.findOne({
          where: { plan_id, addon_id },
        });

        if (!pricing) {
          return res
            .status(400)
            .json({ error: 'Addon indisponível para este plano' });
        }

        addon = await AddonPackage.findByPk(addon_id);
      }

      if (plan_id && !user.is_admin && (!duration_days || duration_days < 1)) {
        return res.status(400).json({
          error: 'Informe a duração em dias para atribuir este plano',
        });
      }

      if (
        addon_id &&
        !user.is_admin &&
        (!addon_duration_days || addon_duration_days < 1)
      ) {
        return res.status(400).json({
          error: 'Informe a duração em dias para atribuir este addon',
        });
      }

      const now = Date.now();

      const isSamePlan = plan_id && user.plan_id === plan_id;

      const isNewPlanAssignment =
        !user.is_admin &&
        plan_id &&
        (!isSamePlan || user.plan_status !== 'active');

      const isSamePlanActive =
        isSamePlan &&
        user.plan_status === 'active' &&
        user.plan_expires_at &&
        new Date(user.plan_expires_at).getTime() > now;

      const planBaseTime = isSamePlanActive
        ? new Date(user.plan_expires_at).getTime()
        : now;

      const expiresAt =
        plan_id && !user.is_admin
          ? new Date(planBaseTime + duration_days * 24 * 60 * 60 * 1000)
          : null;

      const isSameAddon = addon_id && user.addon_id === addon_id;

      const isNewAddonAssignment =
        !user.is_admin &&
        addon_id &&
        (!isSameAddon || user.addon_status !== 'active');

      const isSameAddonActive =
        isSameAddon &&
        user.addon_status === 'active' &&
        user.addon_expires_at &&
        new Date(user.addon_expires_at).getTime() > now;

      const addonBaseTime = isSameAddonActive
        ? new Date(user.addon_expires_at).getTime()
        : now;

      const addonExpiresAt =
        addon_id && !user.is_admin
          ? new Date(addonBaseTime + addon_duration_days * 24 * 60 * 60 * 1000)
          : null;

      const isPlanBeingRenewedOrAssigned =
        plan_id && !user.is_admin && (isNewPlanAssignment || duration_days > 0);

      const messagesResetAt =
        isPlanBeingRenewedOrAssigned && plan.max_messages_per_month > 0
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : user.messages_reset_at;

      const messagesThisMonth = isPlanBeingRenewedOrAssigned
        ? 0
        : user.messages_this_month;

      const newLimit = plan_id
        ? getEffectiveProductLimit({
            plan,
            addon,
            addon_status: addon_id ? 'active' : null,
          })
        : 0;

      const activeCount = await Product.count({
        where: { user_id: user.id, active: true },
      });

      const needsSelection = plan_id ? activeCount > newLimit : false;

      await user.update({
        plan_id: plan_id || null,
        plan_status: plan_id ? 'active' : 'pending',
        plan_expires_at: expiresAt,
        addon_id: addon_id || null,
        addon_status: addon_id ? 'active' : null,
        addon_expires_at: addonExpiresAt,
        messages_this_month: messagesThisMonth,
        messages_reset_at: messagesResetAt,
        product_selection_pending: needsSelection,
      });

      if (!plan_id) {
        await expireUserAccess(user);
      } else if (needsSelection) {
        SocketService.emitNotification(
          user.id,
          'product_selection_required',
          'Selecione seus produtos ativos',
          `Seu novo plano permite ${newLimit} produtos ativos. Selecione quais manter no catálogo.`
        );
      }

      await invalidateCache(user.id, ['/products']);
      await invalidateCache(user.id, ['/instances']);
      await invalidateCache(user.id, ['/conversations']);
      await invalidateCache(user.id, ['/users']);

      await logActivity({
        userId: req.userId,
        action: 'user.plan_updated',
        resourceType: 'user',
        resourceId: user.id,
        metadata: {
          target_user_name: user.name,
          plan_id: plan_id || null,
          plan_name: plan?.name || null,
          duration_days: plan_id ? duration_days : null,
          addon_id: addon_id || null,
          addon_name: addon?.name || null,
          product_selection_pending: needsSelection,
        },
        ip: req.ip,
      });

      await invalidateCache(req.userId, ['/admin/users']);

      return res.json({
        message: 'Plano atualizado com sucesso',
        userId: user.id,
        productSelectionPending: needsSelection,
      });
    } catch (err) {
      return handleError(res, err);
    }
  }

  async updateStatus(req, res) {
    try {
      const { account_status, reason } = req.body;

      const user = await User.findByPk(req.params.id);

      if (!user)
        return res.status(404).json({ error: 'Usuário não encontrado' });

      if (user.is_admin && account_status === 'suspended') {
        return res
          .status(400)
          .json({ error: 'Não é possível suspender outro admin' });
      }

      if (user.account_status === 'deleted') {
        return res.status(400).json({
          error: 'Não é possível alterar o status de uma conta excluída',
        });
      }

      await user.update({
        account_status,
        suspended_reason:
          account_status === 'suspended' ? reason || null : null,
      });

      await logActivity({
        userId: req.userId,
        action: 'user.status_changed',
        resourceType: 'user',
        resourceId: user.id,
        metadata: {
          target_user_name: user.name,
          new_status: account_status,
          reason: reason || null,
        },
        ip: req.ip,
      });

      await invalidateCache(req.userId, ['/admin/users']);
      await invalidateCache(user.id, ['/users']);

      return res.json({
        message: `Conta ${account_status === 'suspended' ? 'suspensa' : 'reativada'} com sucesso`,
        userId: user.id,
      });
    } catch (err) {
      return handleError(res, err);
    }
  }

  async destroy(req, res) {
    try {
      const user = await User.findByPk(req.params.id);

      if (!user)
        return res.status(404).json({ error: 'Usuário não encontrado' });

      if (user.is_admin)
        return res
          .status(400)
          .json({ error: 'Não é possível excluir um admin' });

      await expireUserAccess(user);
      await user.update({ account_status: 'deleted' });

      await logActivity({
        userId: req.userId,
        action: 'user.deleted',
        resourceType: 'user',
        resourceId: user.id,
        metadata: {
          target_user_name: user.name,
          plan_status: user.plan_status || null,
        },
        ip: req.ip,
      });

      await invalidateCache(user.id, ['/users']);

      return res.json({
        message: 'Conta marcada como excluída',
        userId: user.id,
      });
    } catch (err) {
      return handleError(res, err);
    }
  }
}

export default new AdminUserController();
