import Sequelize from 'sequelize';
import databaseConfig from '../config/database';
import User from '../models/User';
import Bot from '../models/Bot';

const models = [User, Bot];

const connection = new Sequelize(databaseConfig);

models.forEach((model) => model.init(connection));
models.forEach(
  (model) => model.associate && model.associate(connection.models)
);

export default connection;
