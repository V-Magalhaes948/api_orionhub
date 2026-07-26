export function verifyWebhookSecret(req, res, next) {
  const receivedSecret = req.query.secret;

  if (!receivedSecret || receivedSecret !== process.env.WEBHOOK_SECRET) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  return next();
}
