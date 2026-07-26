import Sequelize, { Model } from 'sequelize';

export default class Instance extends Model {
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
        name: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        instance_id: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        instance_token: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        phone_number: {
          type: Sequelize.STRING,
          allowNull: true,
          validate: {
            len: {
              args: [10, 15],
              msg: 'O Número de Telefone deve ter entre 10 e 15 dígitos',
            },
          },
        },
        status: {
          type: Sequelize.ENUM('connected', 'disconnected', 'pending'),
          allowNull: false,
          defaultValue: 'pending',
        },
      },
      {
        sequelize,
      }
    );

    return this;
  }

  static associate(models) {
    this.hasOne(models.Bot, { foreignKey: 'instance_id', as: 'bot' });
  }
}
