import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import rateLimitRedis from '../lib/rateLimitRedis.js';

const isTestEnv = process.env.NODE_ENV === 'test';
const noopMiddleware = (req, res, next) => next();

function buildRateLimit(zoneName, options) {
  if (isTestEnv) return noopMiddleware;

  const limiter = rateLimit({
    ...options,
    store: new RedisStore({
      sendCommand: (...args) => rateLimitRedis.call(...args),
      prefix: `rl:${zoneName}:`,
    }),
  });

  // Fail-open: se o Redis falhar, loga e deixa passar em vez de derrubar a rota
  return (req, res, next) => {
    limiter(req, res, (err) => {
      if (err) {
        console.error(
          `[rateLimit:${zoneName}] Falha, permitindo requisição:`,
          err.message
        );
        return next();
      }
      return next();
    });
  };
}

export const loginRateLimit = buildRateLimit('login', {
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Muitas tentativas de login. Tente novamente em algumas horas.',
  },
});

export const registerRateLimit = buildRateLimit('register', {
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      'Muitas contas criadas a partir deste IP. Tente novamente mais tarde.',
  },
});

export const forgotPasswordRateLimit = buildRateLimit('forgot-password', {
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Muitas solicitações. Tente novamente em alguns minutos.',
  },
});

export const globalRateLimit = buildRateLimit('global', {
  windowMs: 60 * 60 * 1000,
  max: 1500,
  standardHeaders: false,
  legacyHeaders: false,
  skip: (req) => req.path === '/health' || req.method === 'OPTIONS',
  message: { message: 'Muitas requisições. Tente novamente mais tarde.' },
});

export const verifyEmailRateLimit = buildRateLimit('verify-email', {
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.body?.email || ipKeyGenerator(req.ip),
  message: {
    message:
      'Muitas tentativas de verificação. Tente novamente em alguns minutos.',
  },
});

export const resendCodeRateLimit = buildRateLimit('resend-code', {
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      'Muitas solicitações de código. Tente novamente em alguns minutos.',
  },
});
