import Instance from '../../models/Instance.js';

export default async function connectionHandler({
  event,
  instance: instanceId,
  data,
}) {
  if (event !== 'connection.update') return;

  const instance = await Instance.findOne({
    where: { instance_id: instanceId },
  });

  if (!instance) return;

  if (data?.state === 'open') {
    await instance.update({
      status: 'connected',
      phone_number: data.wuid?.replace('@s.whatsapp.net', '') ?? null,
    });
    return;
  }

  if (data?.state === 'close' || data?.state === 'refused') {
    await instance.update({ status: 'disconnected' });
  }
}
