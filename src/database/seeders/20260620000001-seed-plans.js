import { v4 as uuidv4 } from 'uuid';

export default {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('plans', [
      {
        id: uuidv4(),
        name: 'Essential',
        max_instances: 0,
        max_products: 20,
        max_messages_per_month: 0,
        is_default: true,
        price: 97.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: 'Presence',
        max_instances: 2,
        max_products: 80,
        max_messages_per_month: 1500,
        is_default: false,
        price: 197.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: 'Plus',
        max_instances: 5,
        max_products: 130,
        max_messages_per_month: 3500,
        is_default: false,
        price: 347.0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('plans', null, {});
  },
};
