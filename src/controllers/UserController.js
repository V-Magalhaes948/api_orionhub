import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import Plan from '../models/Plan.js';
import { invalidateCache } from '../middlewares/cache.js';
import AddonPackage from '../models/AddonPackage.js';
import { handleError } from '../utils/handleError.js';
import { logActivity } from '../utils/logActivity.js';
import { sendVerificationCodeEmail } from '../lib/mailer.js';

const USER_ATTRIBUTES = [
  'id',
  'name',
  'email',
  'plan_id',
  'plan_status',
  'plan_expires_at',
  'addon_id',
  'addon_status',
  'addon_expires_at',
  'product_selection_pending',
  'instance_selection_pending',
  'is_admin',
  'account_status',
  'messages_this_month',
  'created_at',
  'updated_at',
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
          { model: Plan, as: 'plan' },
          { model: AddonPackage, as: 'addon' },
        ],
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json(user);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async update(req, res) {
    try {
      const { name, email, password } = req.body;
      const user = await User.findByPk(req.userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const emailChanged = email && email !== user.email;

      const updatePayload = { name, email, password };

      if (emailChanged) {
        updatePayload.email_verified = false;
        updatePayload.verification_code = generateVerificationCode();
        updatePayload.verification_code_expires_at = new Date(
          Date.now() + 15 * 60 * 1000
        );
        updatePayload.verification_attempts = 0;
        updatePayload.refresh_token = null; // invalida a sessão
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
          message: 'Email updated, please log in again',
          forceLogout: true,
        });
      }

      if (password) {
        const token = jwt.sign({ id: user.id }, process.env.TOKEN_SECRET, {
          expiresIn: process.env.TOKEN_EXPIRATION,
        });
        return res
          .status(200)
          .json({ message: 'User updated successfully', token });
      }

      return res
        .status(200)
        .json({ message: 'User updated successfully', userId: user.id });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async destroy(req, res) {
    try {
      const user = await User.findByPk(req.userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
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
        message: 'User deleted successfully',
        userId: user.id,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new UserController();
