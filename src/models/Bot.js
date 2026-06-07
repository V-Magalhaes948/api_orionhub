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
        phone_number: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: {
            msg: 'Número de telefone já cadastrado.',
          },
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
  }
}
