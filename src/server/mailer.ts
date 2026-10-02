import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from './env';
import { log } from './logger';

/**
 * The raw email transport. Each feature composes its own message; this only
 * delivers it.
 *
 * Without `SMTP_HOST` (development) the message is written to the log
 * instead of sent, so verification and reset links can be followed locally.
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.SMTP_HOST) return null;
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return transporter;
}

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendMail(message: MailMessage): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    log().info({ to: message.to, subject: message.subject, text: message.text }, 'email (not sent: SMTP_HOST unset)');
    return;
  }
  await transport.sendMail({ from: env.MAIL_FROM ?? env.SMTP_USER, ...message });
}
