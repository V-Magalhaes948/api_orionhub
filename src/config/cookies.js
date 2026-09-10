export const REFRESH_COOKIE_NAME = 'refreshToken';

export const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax', // mesma origem (orionhub.space) → lax já resolve, não precisa 'none'
  path: '/api/auth', // bate com a URL pública que o Nginx expõe
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
