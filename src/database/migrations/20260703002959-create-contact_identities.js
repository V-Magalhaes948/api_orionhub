'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contact_identities', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      bot_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'bots', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      lid: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: false,
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

    await queryInterface.addIndex('contact_identities', ['bot_id', 'lid'], {
      unique: true,
      name: 'contact_identities_bot_lid_unique',
    });

    await queryInterface.addIndex('contact_identities', ['bot_id', 'phone'], {
      name: 'contact_identities_bot_phone_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('contact_identities');
  },
};
