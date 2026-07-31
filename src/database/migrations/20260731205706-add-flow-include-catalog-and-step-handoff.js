module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('flows', 'include_catalog', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.addColumn('flow_steps', 'hands_off_to_human', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.removeColumn('flow_steps', 'include_catalog');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('flow_steps', 'include_catalog', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.removeColumn('flow_steps', 'hands_off_to_human');
    await queryInterface.removeColumn('flows', 'include_catalog');
  },
};
