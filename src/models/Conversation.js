import Sequelize, { Model } from 'sequelize';

export default class Conversation extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        bot_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        contact_phone: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        contact_name: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        status: {
          type: Sequelize.ENUM('open', 'closed', 'waiting'),
          defaultValue: 'open',
        },
      },
      { sequelize }
    );
    return this;
  }

  static associate(models) {
    this.belongsTo(models.Bot, { foreignKey: 'bot_id', as: 'bot' });
    this.hasMany(models.Message, {
      foreignKey: 'conversation_id',
      as: 'messages',
    });
  }
}
