import Sequelize, { Model } from 'sequelize';

export default class WebhookLog extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        instance_id: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        type: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        status: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        payload: {
          type: Sequelize.JSON,
          allowNull: false,
        },
      },
      {
        sequelize,
      }
    );
    return this;
  }
}
