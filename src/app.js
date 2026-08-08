import 'dotenv/config';
import express from 'express';
import { resolve } from 'path';
import cors from 'cors';
import { corsOptions } from './config/cors.js';
import { helmetConfig } from './config/helmet.js';
import { globalRateLimit } from './middlewares/rateLimit.js';

import './database';
import routes from './routes';

class App {
  constructor() {
    this.app = express();
    this.app.set('trust proxy', 1);
    this.middlewares();
    this.routes();
  }

  middlewares() {
    this.app.use(helmetConfig);
    this.app.use(cors(corsOptions));
    this.app.use(globalRateLimit);
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());
    this.app.use('/uploads', express.static(resolve('uploads')));
  }

  routes() {
    this.app.use('/', routes);
  }
}

export default new App().app;
