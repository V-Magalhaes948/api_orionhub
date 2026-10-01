import crypto from 'crypto';
import { Op } from 'sequelize';
import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import Plan from '../models/Plan.js';

import { handleError } from '../utils/handleError.js';

import { emailQueue } from '../queues/emailQueue.js';

import SocketService from '../services/socketService.js';

import { sendVerificationCodeEmail } from '../lib/mailer.js';
import {
  REFRESH_COOKIE_NAME,
  refreshCookieOptions,
} from '../config/cookies.js';

const TRIAL_DAYS = 3;
const VERIFICATION_CODE_TTL_MINUTES = 15;
const MAX_VERIFICATION_ATTEMPTS = 5;

function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function safeCompareHash(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

class AuthController {
  async register(req, res) {
    try {
      const { name, email, password } = req.body;
      const normalizedEmail = email.trim().toLowerCase();

      const user = await User.findOne({ where: { email: normalizedEmail } });
      if (user) {
        return res.status(400).json({ message: 'Usuário já existe.' });
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
        plan_expires_at: null,
        messages_reset_at: null,
        email_verified: false,
        verification_code: verificationCode,
        verification_code_expires_at: verificationCodeExpiresAt,
        verification_attempts: 0,
      });

      let emailSent = true;
      try {
        await sendVerificationCodeEmail(
          normalizedEmail,
          name,
          verificationCode
        );
      } catch (mailError) {
        emailSent = false;
        console.error('Failed to send verification email:', mailError);
      }

      const { password_hash, refresh_token, verification_code, ...safeUser } =
        newUser.toJSON();

      return res.status(201).json({
        message: emailSent
          ? 'Conta criada. Verifique seu e-mail para ativar a conta.'
          : 'Conta criada, mas não conseguimos enviar o código. Solicite um novo envio.',
        email_sent: emailSent,
        user: {
          id: newUser.id,
          name: newUser.name,
          email: newUser.email,
          plan_status: newUser.plan_status,
          email_verified: newUser.email_verified,
          created_at: newUser.created_at,
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
              ? new Date(Date.now() + 5 * 60 * 1000)
              : null,
          });
        }
        return res.status(400).json({ message: 'E-mail ou senha inválidos' });
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
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '7d' }
      );

      await user.update({
        refresh_token: hashToken(refreshToken),
        last_login_at: new Date(),
        failed_login_attempts: 0,
        locked_until: null,
      });

      res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);

      // refreshToken NÃO vai mais no body
      return res.json({ message: 'Login successful', token });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async refresh(req, res) {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token ausente' });
      }

      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
      } catch {
        res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
        return res
          .status(401)
          .json({ message: 'Invalid or expired refresh token' });
      }

      const incomingHash = hashToken(refreshToken);
      const user = await User.findByPk(decoded.id);

      if (!user) {
        res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
        return res.status(401).json({ message: 'Refresh token revoked' });
      }

      // reuse detection com comparação constant-time
      if (!safeCompareHash(user.refresh_token, incomingHash)) {
        await user.update({ refresh_token: null });
        res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
        SocketService.emitToUser(user.id, 'force-logout', {
          reason: 'refresh_token_reuse',
        });
        return res
          .status(401)
          .json({ message: 'Refresh token reuse detected' });
      }

      const newToken = jwt.sign({ id: user.id }, process.env.TOKEN_SECRET, {
        expiresIn: process.env.TOKEN_EXPIRATION || '1h',
      });

      const newRefreshToken = jwt.sign(
        { id: user.id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION || '7d' }
      );

      await user.update({ refresh_token: hashToken(newRefreshToken) });
      res.cookie(REFRESH_COOKIE_NAME, newRefreshToken, refreshCookieOptions);

      return res.json({ token: newToken });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async logout(req, res) {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];

      if (refreshToken) {
        const incomingHash = hashToken(refreshToken);
        const user = await User.findOne({
          where: { refresh_token: incomingHash },
        });
        if (user) {
          await user.update({ refresh_token: null });
        }
      }

      res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
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
        password_changed_at: new Date(), // [FIX]
        reset_token_hash: null,
        reset_token_expires_at: null,
        refresh_token: null,
        failed_login_attempts: 0,
        locked_until: null,
      });

      SocketService.emitToUser(user.id, 'force-logout', {
        reason: 'password_reset',
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

      const updatePayload = {
        email_verified: true,
        verification_code: null,
        verification_code_expires_at: null,
        verification_attempts: 0,
      };

      if (user.plan_status === 'pending_verification') {
        const defaultPlan = user.plan_id
          ? await Plan.findByPk(user.plan_id)
          : null;
        const trialExpiresAt = defaultPlan
          ? new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
          : null;

        updatePayload.plan_status = defaultPlan ? 'trialing' : 'pending';
        updatePayload.plan_expires_at = trialExpiresAt;
      }

      await user.update(updatePayload);

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
