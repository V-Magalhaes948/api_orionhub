import Sequelize, { Model } from 'sequelize';

export default class AdminAuditLog extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        admin_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        action: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        target_user_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        details: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
      },
      {
        sequelize,
        tableName: 'AdminAuditLogs',
      }
    );

    return this;
  }

  static associate(models) {
    this.belongsTo(models.User, { foreignKey: 'admin_id', as: 'admin' });
    this.belongsTo(models.User, {
      foreignKey: 'target_user_id',
      as: 'targetUser',
    });
  }
}
