import crypto from 'crypto';
import { Op } from 'sequelize';
import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import Plan from '../models/Plan.js';
import { formatDate } from '../utils/formatDate.js';
import { handleError } from '../utils/handleError.js';
import { emailQueue } from '../queues/emailQueue.js';
import { sendVerificationCodeEmail } from '../lib/mailer.js';

const TRIAL_DAYS = 3;
const VERIFICATION_CODE_TTL_MINUTES = 15;
const MAX_VERIFICATION_ATTEMPTS = 5;

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

class AuthController {
  async register(req, res) {
    try {
      const { name, email, password } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      const user = await User.findOne({ where: { email: normalizedEmail } });
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const defaultPlan = await Plan.findOne({ where: { is_default: true } });

      const verificationCode = generateVerificationCode();
      const verificationCodeExpiresAt = new Date(
        Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000
      );

      const newUser = await User.create({
        name,
        email: normalizedEmail,
        password,
        plan_id: defaultPlan ? defaultPlan.id : null,
        plan_status: defaultPlan ? 'pending_verification' : 'pending',
        plan_expires_at: null, // só é definido em verifyEmail
        messages_reset_at: null,
        email_verified: false,
        verification_code: verificationCode,
        verification_code_expires_at: verificationCodeExpiresAt,
        verification_attempts: 0,
      });

      try {
        await sendVerificationCodeEmail(
          normalizedEmail,
          name,
          verificationCode
        );
      } catch (mailError) {
        console.error('Failed to send verification email:', mailError);
      }

      const { password_hash, refresh_token, verification_code, ...safeUser } =
        newUser.toJSON();

      return res.status(201).json({
        message: 'Conta criada. Verifique seu e-mail para ativar a conta.',
        user: {
          ...safeUser,
          created_at: formatDate(newUser.created_at),
          updated_at: formatDate(newUser.updated_at),
        },
      });
    } catch (error) {
      if (
        error.name === 'SequelizeValidationError' ||
        error.name === 'SequelizeUniqueConstraintError'
      ) {
        const messages = error.errors.map((e) => e.message);
        return res.status(400).json({ errors: messages });
      }
      return handleError(res, error);
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      const user = await User.findOne({ where: { email: normalizedEmail } });

      if (user?.locked_until && user.locked_until > new Date()) {
        const minutesLeft = Math.ceil((user.locked_until - new Date()) / 60000);
        return res.status(423).json({
          message: `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${minutesLeft} minuto(s).`,
        });
      }

      if (!user || !(await user.checkPassword(password))) {
        if (user) {
          const attempts = user.failed_login_attempts + 1;
          const shouldLock = attempts >= 10;
          await user.update({
            failed_login_attempts: shouldLock ? 0 : attempts,
            locked_until: shouldLock
              ? new Date(Date.now() + 5 * 60 * 1000) // 5 minutos
              : null,
          });
        }
        return res.status(400).json({ message: 'Invalid email or password' });
      }

      if (!user.email_verified) {
        return res.status(403).json({
          message: 'E-mail não verificado. Verifique sua caixa de entrada.',
          code: 'EMAIL_NOT_VERIFIED',
        });
      }

      const token = jwt.sign({ id: user.id }, process.env.TOKEN_SECRET, {
        expiresIn: process.env.TOKEN_EXPIRATION || '1h',
      });

      const refreshToken = jwt.sign(
        { id: user.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.TOKEN_EXPIRATION || '1h' }
      );

      await user.update({
        refresh_token: refreshToken,
        last_login_at: new Date(),
        failed_login_attempts: 0,
        locked_until: null,
      });

      return res.json({ message: 'Login successful', token, refreshToken });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      let decoded;

      try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      } catch {
        return res
          .status(401)
          .json({ message: 'Invalid or expired refresh token' });
      }

      const user = await User.findOne({
        where: { id: decoded.id, refresh_token: refreshToken },
      });

      if (!user) {
        return res.status(401).json({ message: 'Refresh token revoked' });
      }

      const newToken = jwt.sign({ id: user.id }, process.env.TOKEN_SECRET, {
        expiresIn: process.env.TOKEN_EXPIRATION || '1h',
      });

      const newRefreshToken = jwt.sign(
        { id: user.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: '7d' }
      );

      await user.update({ refresh_token: newRefreshToken });

      return res.json({ token: newToken, refreshToken: newRefreshToken });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async logout(req, res) {
    try {
      const { refreshToken } = req.body;

      const user = await User.findOne({
        where: { refresh_token: refreshToken },
      });

      if (user) {
        await user.update({ refresh_token: null });
      }

      return res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      const user = await User.findOne({ where: { email: normalizedEmail } });

      if (!user || user.account_status === 'deleted') {
        return res.status(200).json({
          message: 'Se o e-mail existir, um link de redefinição foi enviado.',
        });
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      await user.update({
        reset_token_hash: tokenHash,
        reset_token_expires_at: new Date(Date.now() + 30 * 60 * 1000),
      });

      const resetUrl = `${process.env.FRONT_URL}/reset-password?token=${rawToken}`;

      await emailQueue.add('password-reset', { to: normalizedEmail, resetUrl });

      return res.status(200).json({
        message: 'Se o e-mail existir, um link de redefinição foi enviado.',
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

      const user = await User.findOne({
        where: {
          reset_token_hash: tokenHash,
          reset_token_expires_at: { [Op.gt]: new Date() },
        },
      });

      if (!user) {
        return res.status(400).json({ message: 'Token inválido ou expirado' });
      }

      await user.update({
        password,
        reset_token_hash: null,
        reset_token_expires_at: null,
        refresh_token: null,
        failed_login_attempts: 0,
        locked_until: null,
      });

      return res.status(200).json({ message: 'Senha redefinida com sucesso' });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async verifyEmail(req, res) {
    try {
      const { email, code } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      const user = await User.findOne({ where: { email: normalizedEmail } });
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      if (user.email_verified) {
        return res.status(400).json({ message: 'E-mail já verificado' });
      }

      if (
        !user.verification_code ||
        !user.verification_code_expires_at ||
        new Date() > new Date(user.verification_code_expires_at)
      ) {
        return res
          .status(400)
          .json({ message: 'Código expirado. Solicite um novo.' });
      }

      if (user.verification_attempts >= MAX_VERIFICATION_ATTEMPTS) {
        return res
          .status(429)
          .json({ message: 'Muitas tentativas. Solicite um novo código.' });
      }

      if (user.verification_code !== code) {
        await user.increment('verification_attempts');
        return res.status(400).json({ message: 'Código inválido' });
      }

      const defaultPlan = user.plan_id
        ? await Plan.findByPk(user.plan_id)
        : null;
      const trialExpiresAt = defaultPlan
        ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
        : null;

      await user.update({
        email_verified: true,
        verification_code: null,
        verification_code_expires_at: null,
        verification_attempts: 0,
        plan_status: defaultPlan ? 'trialing' : 'pending',
        plan_expires_at: trialExpiresAt,
      });

      return res.status(200).json({ message: 'E-mail verificado com sucesso' });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async resendVerificationCode(req, res) {
    try {
      const { email } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      const user = await User.findOne({ where: { email: normalizedEmail } });
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }
      if (user.email_verified) {
        return res.status(400).json({ message: 'E-mail já verificado' });
      }

      const verificationCode = generateVerificationCode();
      const verificationCodeExpiresAt = new Date(
        Date.now() + VERIFICATION_CODE_TTL_MINUTES * 60 * 1000
      );

      await user.update({
        verification_code: verificationCode,
        verification_code_expires_at: verificationCodeExpiresAt,
        verification_attempts: 0,
      });

      await sendVerificationCodeEmail(
        normalizedEmail,
        user.name,
        verificationCode
      );

      return res.status(200).json({ message: 'Novo código enviado' });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new AuthController();
