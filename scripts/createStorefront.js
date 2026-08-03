const { User, Storefront } = require('../models');

async function main() {
  const userId = '04a3d40a-1404-48cc-b053-d1e15a015e9e';
  const slug = 'olfater-perfum';

  const user = await User.findByPk(userId);
  if (!user) throw new Error('User não encontrado');

  const storefront = await Storefront.create({ user_id: userId, slug });
  console.log('Storefront criado:', storefront.toJSON());
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
