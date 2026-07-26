import Sequelize, { Model } from 'sequelize';

export default class Product extends Model {
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
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        category: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        brand: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        pricing_mode: {
          type: Sequelize.ENUM('unit', 'measured'),
          allowNull: false,
          defaultValue: 'unit',
        },
        unit_label: {
          type: Sequelize.ENUM('ml', 'kg', 'cm', 'm', 'un', 'g', 'l'),
          allowNull: false,
          defaultValue: 'un',
        },
        price: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        price_per_unit: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        stock_quantity: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        min_sale_quantity: {
          type: Sequelize.DECIMAL(10, 2),
          allowNull: true,
        },
        image_catalog_url: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        image_vitrine_url: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },
        is_featured: {
          type: Sequelize.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        metadata: {
          type: Sequelize.JSON,
          allowNull: true,
        },
      },
      { sequelize }
    );

    return this;
  }

  static associate(models) {
    this.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
  }
}
