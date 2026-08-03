import connection from '../database/index.js';
async function main() {
  const [, , userId, slug] = process.argv;

  if (!userId || !slug) {
    console.error(
      'Uso: node dist/scripts/createStorefront.js <user_id> <slug>'
    );
    process.exit(1);
  }

  const { User, StoreFront } = connection.models;

  const user = await User.findByPk(userId);
  if (!user) {
    console.error(`User ${userId} não encontrado`);
    process.exit(1);
  }

  const storefront = await StoreFront.create({ user_id: userId, slug });
  console.log('Storefront criado:', storefront.toJSON());
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
