export const REFRESH_COOKIE_NAME = 'refreshToken';

export const refreshCookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: 'strict',
  path: '/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};
