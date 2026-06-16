import Sequelize, { Model } from 'sequelize';

export default class Message extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        conversation_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        content: {
          type: Sequelize.TEXT,
          allowNull: false,
        },
        role: {
          type: Sequelize.ENUM('user', 'assistant'),
          allowNull: false,
        },
        message_id: {
          type: Sequelize.STRING,
          allowNull: true,
        },
      },
      { sequelize }
    );
    return this;
  }

  static associate(models) {
    this.belongsTo(models.Conversation, {
      foreignKey: 'conversation_id',
      as: 'conversation',
    });
  }
}
