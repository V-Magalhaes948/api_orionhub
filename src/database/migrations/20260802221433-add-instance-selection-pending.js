module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'instance_selection_pending', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'instance_selection_pending');
  },
};
