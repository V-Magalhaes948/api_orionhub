import Sequelize, { Model } from 'sequelize';

export default class PlanAddon extends Model {
  static init(sequelize) {
    super.init(
      {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        plan_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        addon_id: {
          type: Sequelize.UUID,
          allowNull: false,
        },
        price: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: 'PlanAddon',
        tableName: 'plan_addons',
      }
    );
    return this;
  }

  static associate(models) {
    this.belongsTo(models.Plan, {
      foreignKey: 'plan_id',
      as: 'plan',
    });
    this.belongsTo(models.AddonPackage, {
      foreignKey: 'addon_id',
      as: 'addon',
    });
  }
}
