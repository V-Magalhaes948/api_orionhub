export async function up(queryInterface, Sequelize) {
  await queryInterface.sequelize.query(`
    ALTER TABLE users
    MODIFY COLUMN plan_status
    ENUM('active', 'expired', 'pending', 'trialing', 'pending_verification')
    NOT NULL DEFAULT 'pending';
  `);
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.sequelize.query(`
    ALTER TABLE users
    MODIFY COLUMN plan_status
    ENUM('active', 'expired', 'pending', 'trialing')
    NOT NULL DEFAULT 'pending';
  `);
}
