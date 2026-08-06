import { timingSafeEqual } from 'crypto';

export function verifyWebhookSecret(req, res, next) {
  const receivedSecret = req.headers['x-webhook-secret'];
  const expectedSecret = process.env.WEBHOOK_SECRET;

  if (!receivedSecret || !expectedSecret) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const receivedBuffer = Buffer.from(receivedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  // timingSafeEqual exige buffers do mesmo tamanho, senão lança erro
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  return next();
}
