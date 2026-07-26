import { v4 as uuidv4 } from 'uuid';

export async function up(queryInterface) {
  const [plans] = await queryInterface.sequelize.query(
    `SELECT id, name FROM plans`
  );
  const [addons] = await queryInterface.sequelize.query(
    `SELECT id, name FROM addon_packages`
  );

  const planByName = Object.fromEntries(plans.map((p) => [p.name, p.id]));
  const addonByName = Object.fromEntries(addons.map((a) => [a.name, a.id]));

  await queryInterface.bulkInsert('plan_addons', [
    {
      id: uuidv4(),
      plan_id: planByName.Essential,
      addon_id: addonByName.Core,
      price: 29.9,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: uuidv4(),
      plan_id: planByName.Essential,
      addon_id: addonByName.Flow,
      price: 49.9,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: uuidv4(),
      plan_id: planByName.Presence,
      addon_id: addonByName.Core,
      price: 39.9,
      created_at: new Date(),
      updated_at: new Date(),
    },
    {
      id: uuidv4(),
      plan_id: planByName.Presence,
      addon_id: addonByName.Flow,
      price: 59.9,
      created_at: new Date(),
      updated_at: new Date(),
    },
  ]);
}

export async function down(queryInterface) {
  await queryInterface.bulkDelete('plan_addons', null, {});
}
