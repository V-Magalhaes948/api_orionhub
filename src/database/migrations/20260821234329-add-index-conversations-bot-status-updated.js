'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addIndex(
      'conversations',
      ['bot_id', 'status', 'updated_at'],
      {
        name: 'idx_conversations_bot_status_updated',
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(
      'conversations',
      'idx_conversations_bot_status_updated'
    );
  },
};
