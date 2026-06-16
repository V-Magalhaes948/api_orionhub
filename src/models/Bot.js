import Sequelize, { Model } from 'sequelize';

export default class Bot extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
          allowNull: false,
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        instance_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            len: {
              args: [3, 100],
              msg: 'Nome deve ter entre 3 e 100 caracteres.',
            },
          },
        },
        mode: {
          type: Sequelize.ENUM('ai', 'manual'),
          allowNull: false,
          defaultValue: 'manual',
        },
        system_prompt: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },
      },
      {
        sequelize,
      }
    );

    return this;
  }

  static associate(models) {
    this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    this.belongsTo(models.Instance, {
      foreignKey: 'instance_id',
      as: 'instance',
    });
    this.hasMany(models.Conversation, {
      foreignKey: 'bot_id',
      as: 'conversations',
    });
  }
}
