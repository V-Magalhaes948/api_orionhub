import { beforeAll, afterAll, afterEach } from 'vitest';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test', override: true });

let database;
let redis;

beforeAll(async () => {
  database = (await import('../src/database/index.js')).default;
  redis = (await import('../src/queues/redis.js')).default;

  await database.authenticate();
  await database.sync({ force: true });
});

afterEach(async () => {
  await database.query('SET FOREIGN_KEY_CHECKS = 0');
  const models = Object.values(database.models);
  for (const model of models) {
    await model.destroy({ where: {}, truncate: true, force: true });
  }
  await database.query('SET FOREIGN_KEY_CHECKS = 1');

  await redis.flushdb();
});

afterAll(async () => {
  await database.close();
  await redis.quit();
});
