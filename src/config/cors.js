const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

console.log('[DEBUG CORS] allowedOrigins:', JSON.stringify(allowedOrigins));
// config/cors.js
export const corsOptions = {
  origin(origin, callback) {
    // Lido a cada chamada, não uma vez na importação do módulo — isso
    // evita depender da ordem de execução entre dotenv.config() e os
    // imports de nível superior (que em ES Modules rodam antes de
    // qualquer código do arquivo que os importa, mesmo que dotenv.config()
    // apareça primeiro no texto do app.js).
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
