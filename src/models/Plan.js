import Sequelize, { Model } from 'sequelize';

export default class Plan extends Model {
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
        is_default: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        max_instances: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        max_products: {
          type: Sequelize.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        max_messages_per_month: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        price: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: false,
        },
      },
      {
        sequelize,
        tableName: 'plans',
      }
    );
    return this;
  }

  static associate(models) {
    this.hasMany(models.User, { foreignKey: 'plan_id', as: 'users' });
    this.hasMany(models.PlanAddon, {
      foreignKey: 'plan_id',
      as: 'planAddons',
    });
  }
}
