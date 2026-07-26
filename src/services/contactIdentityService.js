import ContactIdentity from '../models/ContactIdentity.js';

function isSamePhoneNumber(a, b) {
  if (!a || !b) return false;
  const digitsA = a.replace(/\D/g, '');
  const digitsB = b.replace(/\D/g, '');
  if (digitsA === digitsB) return true;

  const stripNinth = (d) => (d.length === 13 ? d.slice(0, 4) + d.slice(5) : d);
  return stripNinth(digitsA) === stripNinth(digitsB);
}

async function findPhoneByLid(botId, lid) {
  const record = await ContactIdentity.findOne({
    where: { bot_id: botId, lid },
  });
  return record?.phone ?? null;
}

async function upsertIdentity(botId, lid, phone) {
  const existing = await ContactIdentity.findOne({
    where: { bot_id: botId, lid },
  });

  if (existing) {
    if (existing.phone !== phone) {
      await existing.update({ phone });
    }
    return existing;
  }

  return ContactIdentity.create({ bot_id: botId, lid, phone });
}

export default { isSamePhoneNumber, findPhoneByLid, upsertIdentity };
