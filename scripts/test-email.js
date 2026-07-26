import 'dotenv/config';
import { sendPasswordResetEmail } from '../src/lib/mailer.js';

sendPasswordResetEmail(
  'vsmagalhaesfilho@gmail.com',
  'https://exemplo.com/reset-password?token=teste123'
)
  .then((data) => console.log('Enviado:', data))
  .catch((err) => console.error('Erro:', err.message));
