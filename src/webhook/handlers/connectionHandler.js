import Instance from '../../models/Instance.js';
import SocketService from '../../services/socketService.js';

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

    SocketService.emitNotification(
      instance.user_id,
      'instance_reconnected',
      'Instância reconectada',
      `A instância "${instance.name}" foi reconectada.`,
      { instanceName: instance.name }
    );
    return;
  }

  if (data?.state === 'close' || data?.state === 'refused') {
    await instance.update({ status: 'disconnected' });

    SocketService.emitNotification(
      instance.user_id,
      'instance_disconnected',
      'Instância desconectada',
      `A instância "${instance.name}" foi desconectada.`,
      { instanceName: instance.name }
    );
  }
}
