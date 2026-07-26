'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      plan_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'plans',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      addon_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'addon_packages', key: 'id' },
      },
      is_admin: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      plan_status: {
        type: Sequelize.ENUM('active', 'expired', 'pending', 'trialing'),
        defaultValue: 'pending',
      },
      addon_status: {
        type: Sequelize.ENUM('active', 'expired'),
        allowNull: true,
      },
      addon_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      plan_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      account_status: {
        type: Sequelize.ENUM('active', 'suspended', 'deleted'),
        allowNull: false,
        defaultValue: 'active',
      },
      suspended_reason: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      messages_this_month: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      messages_reset_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      password_hash: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      refresh_token: {
        type: Sequelize.STRING(512),
        allowNull: true,
        defaultValue: null,
      },
      reset_token_hash: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      reset_token_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      failed_login_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      locked_until: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      product_selection_pending: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
