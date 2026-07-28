'use strict';
module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('messages', ['message_id'], {
      unique: true,
      name: 'messages_message_id_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('messages', 'messages_message_id_unique');
  },
};
