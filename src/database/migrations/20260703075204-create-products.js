'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('products', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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
      is_featured: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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
      metadata: {
        type: Sequelize.JSON,
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
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('products');
  },
};
