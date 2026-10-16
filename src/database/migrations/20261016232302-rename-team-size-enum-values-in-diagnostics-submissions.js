'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Libera a coluna para aceitar os dois conjuntos de valores
    await queryInterface.changeColumn('diagnostics_submissions', 'teamSize', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // 2. Converte os valores existentes
    await queryInterface.sequelize.query(
      "UPDATE `diagnostics_submissions` SET `teamSize` = REPLACE(`teamSize`, 'vendedores', 'pessoas') WHERE `teamSize` LIKE '%vendedores'"
    );

    // 3. Volta para ENUM com os novos valores
    await queryInterface.changeColumn('diagnostics_submissions', 'teamSize', {
      type: Sequelize.ENUM(
        'Apenas eu',
        '2 a 5 pessoas',
        '6 a 15 pessoas',
        'Mais de 15'
      ),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('diagnostics_submissions', 'teamSize', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      "UPDATE `diagnostics_submissions` SET `teamSize` = REPLACE(`teamSize`, 'pessoas', 'vendedores') WHERE `teamSize` LIKE '%pessoas'"
    );

    await queryInterface.changeColumn('diagnostics_submissions', 'teamSize', {
      type: Sequelize.ENUM(
        'Apenas eu',
        '2 a 5 vendedores',
        '6 a 15 vendedores',
        'Mais de 15'
      ),
      allowNull: true,
    });
  },
};
