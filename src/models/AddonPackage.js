import Sequelize, { Model } from 'sequelize';

export default class AddonPackage extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        extra_products: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'AddonPackage',
        tableName: 'addon_packages',
      }
    );
    return this;
  }

  static associate(models) {
    this.hasMany(models.PlanAddon, {
      foreignKey: 'addon_id',
      as: 'planAddons',
    });
    this.hasMany(models.User, {
      foreignKey: 'addon_id',
      as: 'users',
    });
  }
}
