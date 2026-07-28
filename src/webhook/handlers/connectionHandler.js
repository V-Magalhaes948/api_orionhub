import Instance from '../../models/Instance.js';
import { io } from '../../server.js';

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

    io.to(`user:${instance.user_id}`).emit('notification', {
      type: 'instance_reconnected',
      instanceId: instance.id,
      instanceName: instance.name,
      title: 'Instância reconectada',
      message: `A instância "${instance.name}" foi reconectada.`,
      at: new Date().toISOString(),
    });
    return;
  }

  if (data?.state === 'close' || data?.state === 'refused') {
    await instance.update({ status: 'disconnected' });

    io.to(`user:${instance.user_id}`).emit('notification', {
      type: 'instance_disconnected',
      instanceId: instance.id,
      instanceName: instance.name,
      title: 'Instância desconectada',
      message: `A instância "${instance.name}" foi desconectada.`,
      at: new Date().toISOString(),
    });
  }
}
