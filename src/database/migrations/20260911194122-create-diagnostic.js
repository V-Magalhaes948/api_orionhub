'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('diagnostics_submissions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      company: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      segment: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      hasManualService: {
        type: Sequelize.ENUM('Sim', 'Não'),
        allowNull: false,
      },
      teamSize: {
        type: Sequelize.ENUM(
          'Apenas eu',
          '2 a 5 vendedores',
          '6 a 15 vendedores',
          'Mais de 15'
        ),
        allowNull: true,
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('diagnostics_submissions');
  },
};
