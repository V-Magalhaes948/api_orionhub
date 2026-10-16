'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.removeColumn('diagnostics_submissions', 'email', {
        transaction,
      });
      await queryInterface.removeColumn(
        'diagnostics_submissions',
        'hasManualService',
        { transaction }
      );

      // No Postgres, o tipo ENUM continua existindo depois de remover a coluna
      if (queryInterface.sequelize.getDialect() === 'postgres') {
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_diagnostics_submissions_hasManualService";',
          { transaction }
        );
      }
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      // allowNull: true porque as linhas existentes não têm esses valores
      await queryInterface.addColumn(
        'diagnostics_submissions',
        'email',
        {
          type: Sequelize.STRING,
          allowNull: true,
        },
        { transaction }
      );
      await queryInterface.addColumn(
        'diagnostics_submissions',
        'hasManualService',
        {
          type: Sequelize.ENUM('Sim', 'Não'),
          allowNull: true,
        },
        { transaction }
      );
    });
  },
};
