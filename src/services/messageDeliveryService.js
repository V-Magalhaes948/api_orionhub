import Instance from '../models/Instance.js';

import WhatsAppService from './whatsAppService.js';
import SocketService from './socketService.js';

function isDisconnectionError(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.response?.message;
  return (
    status === 400 && /not connected|closed|disconnected/i.test(code || '')
  );
}

async function safeSendText(instance, phone, text) {
  try {
    return await WhatsAppService.sendText(instance, phone, text);
  } catch (err) {
    if (isDisconnectionError(err)) {
      await instance.update({ status: 'disconnected' });

      SocketService.emitNotification(
        instance.user_id,
        'instance_disconnected',
        'Instância desconectada',
        `A instância "${instance.name}" caiu e não está enviando mensagens. Reconecte via QR Code.`,
        { instanceId: instance.id, instanceName: instance.name }
      );
    } else {
      console.error(
        '[MessageDelivery] Erro não mapeado ao enviar:',
        err.message
      );
    }
    throw err;
  }
}

export default { safeSendText };
