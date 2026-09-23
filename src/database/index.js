import Sequelize from 'sequelize';
import databaseConfig from '../config/database';
import User from '../models/User';
import Bot from '../models/Bot';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import WebhookLog from '../models/WebhookLog';
import Instance from '../models/Instance';
import Plan from '../models/Plan';
import Flow from '../models/Flow';
import FlowStep from '../models/FlowStep';
import FlowSession from '../models/FlowSession';
import ContactIdentity from '../models/ContactIdentity';
import Product from '../models/Product';
import AdminAuditLog from '../models/AdminAuditLog.js';
import ActivityLog from '../models/ActivityLog.js';
import AddonPackage from '../models/AddonPackage.js';
import PlanAddon from '../models/PlanAddon.js';
import PromptTemplate from '../models/PromptTemplate.js';
import StoreFront from '../models/StoreFront.js';
import Notification from '../models/Notification.js';
import Diagnostic from '../models/Diagnostic.js';

const models = [
  Plan,
  User,
  Instance,
  Bot,
  Flow,
  FlowStep,
  FlowSession,
  Conversation,
  Message,
  WebhookLog,
  ContactIdentity,
  Product,
  AdminAuditLog,
  ActivityLog,
  AddonPackage,
  PlanAddon,
  PromptTemplate,
  StoreFront,
  Notification,
  Diagnostic,
];

const connection = new Sequelize(databaseConfig);

models.forEach((model) => model.init(connection));
models.forEach(
  (model) => model.associate && model.associate(connection.models)
);

export default connection;
