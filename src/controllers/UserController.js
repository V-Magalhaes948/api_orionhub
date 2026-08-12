import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import Plan from '../models/Plan.js';
import AddonPackage from '../models/AddonPackage.js';

import { invalidateCache } from '../middlewares/cache.js';

import { sendVerificationCodeEmail } from '../lib/mailer.js';

import { handleError } from '../utils/handleError.js';
import { logActivity } from '../utils/logActivity.js';

const USER_ATTRIBUTES = [
  'id',
  'name',
  'email',
  'plan_id',
  'plan_status',
  'plan_expires_at',
  'is_admin',
  'addon_id',
  'addon_status',
  'addon_expires_at',
  'product_selection_pending',
  'instance_selection_pending',
  'account_status',
  'messages_this_month',
];

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

class UserController {
  async show(req, res) {
    try {
      const user = await User.findByPk(req.userId, {
        attributes: USER_ATTRIBUTES,
        include: [
          {
            model: Plan,
            as: 'plan',
            attributes: [
              'id',
              'name',
              'max_instances',
              'max_products',
              'max_messages_per_month',
              'price',
            ],
          },
          {
            model: AddonPackage,
            as: 'addon',
            attributes: ['id', 'name', 'extra_products'],
          },
        ],
      });

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      const userData = user.toJSON();
      return res.status(200).json(userData);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async update(req, res) {
    try {
      const { name, email, password } = req.body;
      const user = await User.findByPk(req.userId);
      if (!user)
        return res.status(404).json({ message: 'Usuário não encontrado.' });

      const emailChanged = email !== undefined && email !== user.email;

      const updatePayload = {};
      if (name !== undefined) updatePayload.name = name;
      if (email !== undefined) updatePayload.email = email;
      if (password !== undefined) updatePayload.password = password;

      if (emailChanged) {
        updatePayload.email_verified = false;
        updatePayload.verification_code = generateVerificationCode();
        updatePayload.verification_code_expires_at = new Date(
          Date.now() + 15 * 60 * 1000
        );
        updatePayload.verification_attempts = 0;
        updatePayload.refresh_token = null;
      }

      await user.update(updatePayload);

      await invalidateCache(req.userId, ['/users']);

      await logActivity({
        userId: req.userId,
        action: 'user.updated',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { name: user.name, email_changed: emailChanged },
        ip: req.ip,
      });

      if (emailChanged) {
        try {
          await sendVerificationCodeEmail(
            user.email,
            user.name,
            user.verification_code
          );
        } catch (mailError) {
          console.error('Failed to send verification email:', mailError);
        }

        return res.status(200).json({
          message:
            'Email atualizado com sucesso. Verifique seu email para confirmar a alteração.',
          forceLogout: true,
        });
      }

      if (password) {
        const token = jwt.sign({ id: user.id }, process.env.TOKEN_SECRET, {
          expiresIn: process.env.TOKEN_EXPIRATION,
        });
        return res
          .status(200)
          .json({ message: 'Usuário atualizado com sucesso.', token });
      }

      return res
        .status(200)
        .json({ message: 'Usuário atualizado com sucesso.', userId: user.id });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async destroy(req, res) {
    try {
      const user = await User.findByPk(req.userId);

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      await user.update({ account_status: 'deleted' });

      await logActivity({
        userId: req.userId,
        action: 'user.deleted',
        resourceType: 'user',
        resourceId: user.id,
        metadata: { name: user.name },
        ip: req.ip,
      });

      return res.status(200).json({
        message: 'Usuário excluído com sucesso.',
        userId: user.id,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new UserController();
