import dotenv from 'dotenv';
import express from 'express';
import { resolve } from 'path';
import cors from 'cors';
import helmet from 'helmet';
dotenv.config();

import './database';
import routes from './routes';
const whiteList = ['http://localhost:3001'];

const corsOptions = {
  origin: function (origin, callback) {
    // permite requisições sem origin (webhooks, Postman, mobile)
    if (!origin) return callback(null, true);

    if (whiteList.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // libera tudo por enquanto em desenvolvimento
    }
  },
};

class App {
  constructor() {
    this.app = express();
    this.middlewares();
    this.routes();
  }

  middlewares() {
    this.app.use(cors());
    this.app.use(helmet());
    this.app.use(express.urlencoded({ extended: true }));
    this.app.use(express.json());
    this.app.use(express.static(resolve(__dirname, 'uploads')));
  }

  routes() {
    this.app.use('/', routes);
  }
}

export default new App().app;
