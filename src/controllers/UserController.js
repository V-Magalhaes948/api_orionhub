import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import { handleError } from '../utils/handleError.js';

const USER_ATTRIBUTES = ['id', 'nome', 'email', 'created_at', 'updated_at'];

class UserController {
  async index(req, res) {
    try {
      const users = await User.findAll({
        where: { active: true },
        attributes: USER_ATTRIBUTES,
      });
      return res.status(200).json(users);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async show(req, res) {
    try {
      const user = await User.findByPk(req.userId, {
        attributes: USER_ATTRIBUTES,
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json(user);
    } catch (error) {
      return handleError(res, error);
    }
  }

  async update(req, res) {
    try {
      const { nome, email, password } = req.body;
      const user = await User.findByPk(req.userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      await user.update({ nome, email, password });

      if (password) {
        const token = jwt.sign({ id: user.id }, process.env.TOKEN_SECRET, {
          expiresIn: process.env.TOKEN_EXPIRATION,
        });
        return res
          .status(200)
          .json({ message: 'User updated successfully', token });
      }
      return res
        .status(200)
        .json({ message: 'User updated successfully', user });
    } catch (error) {
      return handleError(res, error);
    }
  }

  async destroy(req, res) {
    try {
      const user = await User.findByPk(req.userId);

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      await user.update({ active: false });
      return res.status(200).json({ message: 'User deleted successfully' });
    } catch (error) {
      return handleError(res, error);
    }
  }
}

export default new UserController();
