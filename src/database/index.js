import Sequelize from 'sequelize';
import databaseConfig from '../config/database';
import User from '../models/User';
import Bot from '../models/Bot';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import WebhookLog from '../models/WebhookLog';
import Instance from '../models/Instance';

const models = [User, Bot, Conversation, Message, WebhookLog, Instance];

const connection = new Sequelize(databaseConfig);

models.forEach((model) => model.init(connection));
models.forEach(
  (model) => model.associate && model.associate(connection.models)
);

export default connection;
