import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

class AuthController {
  async register(req, res) {
    try {
      const { nome, email, password } = req.body;
      const user = await User.findOne({ where: { email } });

      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const newUser = await User.create({
        nome,
        email,
        password,
      });
      return res
        .status(201)
        .json({ message: 'User registered successfully', user: newUser });
    } catch (error) {
      return res.status(500).json({ message: 'Error registering user', error });
    }
  }

  async login(req, res) {
    try {
      const { email, password } = req.body;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(400).json({ message: 'Invalid email or password' });
      }
      const isPasswordValid = await user.checkPassword(password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: 'Invalid email or password' });
      }

      const token = jwt.sign({ id: user.id }, process.env.TOKEN_SECRET, {
        expiresIn: process.env.TOKEN_EXPIRATION || '1h',
      });
      return res.json({ message: 'Login successful', token });
    } catch (error) {
      return res.status(500).json({ message: 'Error logging in', error });
    }
  }
}

export default new AuthController();
