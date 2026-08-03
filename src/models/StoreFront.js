import Sequelize, { Model } from 'sequelize';

export default class StoreFront extends Model {
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
        slug: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
      },
      {
        sequelize,
        tableName: 'storefronts',
      }
    );

    return this;
  }

  static associate(models) {
    this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  }
}
