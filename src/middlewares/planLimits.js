import User from '../models/User.js';
import Plan from '../models/Plan.js';
import AddonPackage from '../models/AddonPackage.js';
import Instance from '../models/Instance.js';
import Product from '../models/Product.js';
import { io } from '../server.js';
import { expireUserAccess } from '../services/planExpirationService.js';
import { getEffectiveProductLimit } from '../utils/generateProductLimit.js';

async function getUserWithPlan(userId) {
  const user = await User.findOne({
    where: { id: userId },
    include: [
      { model: Plan, as: 'plan' },
      { model: AddonPackage, as: 'addon' },
    ],
  });

  return user;
}

async function checkAndResetMessages(user) {
  const now = new Date();

  if (!user.messages_reset_at) {
    await user.update({ messages_reset_at: now });
    user.messages_reset_at = now;
    return;
  }

  const resetAt = new Date(user.messages_reset_at);
  const diffDays = (now - resetAt) / (1000 * 60 * 60 * 24);

  if (diffDays >= 30) {
    await user.update({ messages_this_month: 0, messages_reset_at: now });
    user.messages_this_month = 0;
  }
}

async function checkAndExpirePlan(user) {
  if (user.is_admin) return false;

  if (user.plan_status === 'expired') return true;

  if (user.plan_expires_at && new Date(user.plan_expires_at) < new Date()) {
    await expireUserAccess(user);
    return true;
  }

  return false;
}

const NO_ACTIVE_PLAN_MESSAGE =
  'Você ainda não tem um plano ativo. Entre em contato para ativar sua assinatura.';
const PLAN_EXPIRED_MESSAGE =
  'Seu período de teste expirou. Assine um plano para continuar.';

export function requireActivePlan() {
  return async (req, res, next) => {
    try {
      const user = await getUserWithPlan(req.userId);

      if (user.is_admin) {
        return next();
      }

      if (!user.plan_id || !user.plan) {
        return res.status(403).json({ message: NO_ACTIVE_PLAN_MESSAGE });
      }

      const expired = await checkAndExpirePlan(user);
      if (expired) {
        return res.status(403).json({ message: PLAN_EXPIRED_MESSAGE });
      }

      next();
    } catch (error) {
      return res.status(500).json({ message: 'Error verifying plan status.' });
    }
  };
}

export function checkInstanceLimit() {
  return async (req, res, next) => {
    try {
      const user = await getUserWithPlan(req.userId);

      if (user.is_admin) {
        return next();
      }

      if (!user.plan_id || !user.plan) {
        return res.status(403).json({ message: NO_ACTIVE_PLAN_MESSAGE });
      }

      const expired = await checkAndExpirePlan(user);
      if (expired) {
        return res.status(403).json({ message: PLAN_EXPIRED_MESSAGE });
      }

      const count = await Instance.count({ where: { user_id: req.userId } });

      if (count >= user.plan.max_instances) {
        return res.status(403).json({
          message: `O seu plano ${user.plan.name} permite um máximo de ${user.plan.max_instances} instância(s).`,
        });
      }

      next();
    } catch (error) {
      return res
        .status(500)
        .json({ message: 'Erro de verificação do limite de instâncias.' });
    }
  };
}

export async function checkMessageLimit(userId) {
  const user = await getUserWithPlan(userId);

  if (!user.plan_id || !user.plan) {
    return false;
  }

  const expired = await checkAndExpirePlan(user);
  if (expired) {
    return false;
  }

  await checkAndResetMessages(user);

  if (user.messages_this_month >= user.plan.max_messages_per_month) {
    return false;
  }

  await user.increment('messages_this_month');

  const used = user.messages_this_month + 1;
  const limit = user.plan.max_messages_per_month;
  const percent = Math.round((used / limit) * 100);

  if (percent === 80 || percent === 90 || percent === 95) {
    io.to(`user:${userId}`).emit('notification', {
      type: 'message_limit',
      title: 'Limite de mensagens',
      message: `Você usou ${percent}% das mensagens do seu plano (${used}/${limit}).`,
      at: new Date().toISOString(),
    });
  }

  return true;
}

export function blockIfSelectionPending() {
  return async (req, res, next) => {
    try {
      const user = await User.findByPk(req.userId);

      if (user.product_selection_pending) {
        return res.status(403).json({
          message: 'Selecione seus produtos ativos antes de continuar.',
        });
      }

      next();
    } catch (error) {
      return res
        .status(500)
        .json({ message: 'Erro de verificação de seleção.' });
    }
  };
}

export function checkProductLimit() {
  return async (req, res, next) => {
    try {
      const user = await getUserWithPlan(req.userId);

      if (user.is_admin) {
        return next();
      }

      if (!user.plan_id || !user.plan) {
        return res.status(403).json({ message: NO_ACTIVE_PLAN_MESSAGE });
      }

      const expired = await checkAndExpirePlan(user);
      if (expired) {
        return res.status(403).json({ message: PLAN_EXPIRED_MESSAGE });
      }

      const limit = getEffectiveProductLimit(user);
      const count = await Product.count({ where: { user_id: req.userId } });

      if (count >= limit) {
        return res.status(403).json({
          message: `O seu plano ${user.plan.name} permite um máximo de ${limit} produto(s).`,
        });
      }

      next();
    } catch (error) {
      return res
        .status(500)
        .json({ message: 'Erro de verificação do limite de produtos.' });
    }
  };
}

const PLAN_FEATURE_BLOCKED_MESSAGE = (planName) =>
  `Seu plano ${planName} não tem acesso a este recurso. Faça upgrade para desbloquear.`;

export function blockPlanAccess(blockedPlanNames = []) {
  return async (req, res, next) => {
    try {
      const user = await getUserWithPlan(req.userId);

      if (user.is_admin) {
        return next();
      }

      if (!user.plan_id || !user.plan) {
        return res.status(403).json({ message: NO_ACTIVE_PLAN_MESSAGE });
      }

      const expired = await checkAndExpirePlan(user);
      if (expired) {
        return res.status(403).json({ message: PLAN_EXPIRED_MESSAGE });
      }

      if (blockedPlanNames.includes(user.plan.name)) {
        return res.status(403).json({
          message: PLAN_FEATURE_BLOCKED_MESSAGE(user.plan.name),
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({ message: 'Erro de verificação do plano.' });
    }
  };
}
