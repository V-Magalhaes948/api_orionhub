'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('plan_addons', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      plan_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'plans', key: 'id' },
        onDelete: 'CASCADE',
      },
      addon_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'addon_packages', key: 'id' },
        onDelete: 'CASCADE',
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('plan_addons', ['plan_id', 'addon_id'], {
      unique: true,
      name: 'plan_addons_plan_id_addon_id_unique',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('plan_addons');
  },
};
