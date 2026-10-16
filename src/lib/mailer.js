import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const NOTIFICATION_EMAIL = 'contato.felipe.rc34@gmail.com';

const esc = (v) =>
  String(v ?? '-')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

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

export async function sendDiagnosticNotificationEmail(diagnostic) {
  const { name, company, phone, segment, teamSize } = diagnostic;

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to: NOTIFICATION_EMAIL,
    subject: `Novo diagnóstico recebido — ${company || name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Novo diagnóstico preenchido</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; font-weight: bold;">Nome</td><td style="padding: 6px 0;">${esc(name)}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Empresa</td><td style="padding: 6px 0;">${esc(company)}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Telefone</td><td style="padding: 6px 0;">${esc(phone)}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Segmento</td><td style="padding: 6px 0;">${esc(segment)}</td></tr>
          <tr><td style="padding: 6px 0; font-weight: bold;">Tamanho da equipe</td><td style="padding: 6px 0;">${esc(teamSize)}</td></tr>
        </table>
      </div>
    `,
  });

  if (error) {
    throw new Error(`Falha ao enviar e-mail de notificação: ${error.message}`);
  }

  return data;
}
