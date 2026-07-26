import Sequelize, { Model } from 'sequelize';

export default class ContactIdentity extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        bot_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        lid: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        phone: {
          type: Sequelize.STRING,
          allowNull: false,
        },
      },
      { sequelize }
    );
    return this;
  }

  static associate(models) {
    this.belongsTo(models.Bot, {
      foreignKey: 'bot_id',
      as: 'bot',
    });
  }
}
