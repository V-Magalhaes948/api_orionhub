import rateLimit from 'express-rate-limit';

const isTestEnv = process.env.NODE_ENV === 'test';

const noopMiddleware = (req, res, next) => next();

function buildRateLimit(options) {
  return isTestEnv ? noopMiddleware : rateLimit(options);
}

export const loginRateLimit = buildRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Muitas tentativas de login. Tente novamente em algumas horas.',
  },
});

export const registerRateLimit = buildRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      'Muitas contas criadas a partir deste IP. Tente novamente mais tarde.',
  },
});

export const forgotPasswordRateLimit = buildRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Muitas solicitações. Tente novamente em alguns minutos.',
  },
});

export const globalRateLimit = buildRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Muitas requisições. Tente novamente mais tarde.' },
});
