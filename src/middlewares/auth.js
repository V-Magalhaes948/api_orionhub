import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'No token provided' });
  }

  const [, token] = authHeader.split(' ');

  try {
    const decoded = jwt.verify(token, process.env.TOKEN_SECRET);

    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'is_admin', 'account_status'],
    });

    if (
      !user ||
      user.account_status === 'suspended' ||
      user.account_status === 'deleted'
    ) {
      return res.status(403).json({ message: 'Conta não encontrada' });
    }

    if (
      user.password_changed_at &&
      decoded.iat < Math.floor(user.password_changed_at.getTime() / 1000)
    ) {
      return res
        .status(401)
        .json({ message: 'Sessão expirada, faça login novamente' });
    }

    req.userId = decoded.id;
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export default authMiddleware;
