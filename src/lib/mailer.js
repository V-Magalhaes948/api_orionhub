import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendPasswordResetEmail(to, resetUrl) {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject: 'Redefinição de senha — OrionHub',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Redefinir sua senha</h2>
        <p>Recebemos um pedido para redefinir a senha da sua conta OrionHub.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">
            Redefinir senha
          </a>
        </p>
        <p>Esse link expira em 30 minutos. Se você não pediu isso, pode ignorar este e-mail.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail de reset: ${error.message}`);
  }

  return data;
}

export async function sendVerificationCodeEmail(to, name, code) {
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    subject: 'Confirme seu e-mail — OrionHub',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Olá, ${name}!</h2>
        <p>Use o código abaixo para confirmar seu e-mail e ativar sua conta:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; padding: 16px; background: #f4f4f5; border-radius: 8px;">
          ${code}
        </p>
        <p>Esse código expira em 15 minutos. Se você não criou uma conta na OrionHub, pode ignorar este e-mail.</p>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail de verificação: ${error.message}`);
  }

  return data;
}
