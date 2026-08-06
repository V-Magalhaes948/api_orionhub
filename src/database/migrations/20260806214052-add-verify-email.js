'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'email_verified', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    });
    await queryInterface.addColumn('users', 'verification_code', {
      type: Sequelize.STRING(6),
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'verification_code_expires_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn('users', 'verification_attempts', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'email_verified');
    await queryInterface.removeColumn('users', 'verification_code');
    await queryInterface.removeColumn('users', 'verification_code_expires_at');
    await queryInterface.removeColumn('users', 'verification_attempts');
  },
};
