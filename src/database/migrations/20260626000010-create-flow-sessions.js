'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('flow_sessions', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'conversations', key: 'id' },
        onDelete: 'CASCADE',
      },
      flow_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'flows', key: 'id' },
      },
      current_step_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'flow_steps', key: 'id' },
      },
      data: {
        type: Sequelize.JSON,
        defaultValue: {},
      },
      completed: {
        type: Sequelize.BOOLEAN,
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

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('flow_sessions');
  },
};
