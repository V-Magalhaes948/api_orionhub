import { v4 as uuidv4 } from 'uuid';

export default {
  up: async (queryInterface) => {
    await queryInterface.bulkInsert('addon_packages', [
      {
        id: uuidv4(),
        name: 'Core',
        extra_products: 10,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: uuidv4(),
        name: 'Flow',
        extra_products: 20,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ]);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('addon_packages', null, {});
  },
};
