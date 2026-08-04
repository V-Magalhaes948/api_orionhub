const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

console.log('[DEBUG CORS] allowedOrigins:', JSON.stringify(allowedOrigins));

export const corsOptions = {
  origin(origin, callback) {
    const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Origem bloqueada: ${origin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};
