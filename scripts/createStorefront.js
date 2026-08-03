const { User, Storefront } = require('../models');

async function main() {
  const [, , userId, slug] = process.argv;

  if (!userId || !slug) {
    console.error('Uso: node scripts/createStorefront.js <user_id> <slug>');
    process.exit(1);
  }

  const user = await User.findByPk(userId);
  if (!user) throw new Error(`User ${userId} não encontrado`);

  const storefront = await Storefront.create({ user_id: userId, slug });
  console.log('Storefront criado:', storefront.toJSON());
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
