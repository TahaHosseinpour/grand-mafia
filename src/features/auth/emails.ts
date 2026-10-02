import 'server-only';
import type { MailMessage } from '@/server/mailer';

/**
 * The auth emails, in Persian. Inline styles only (mail clients ignore
 * stylesheets); RTL set on the wrapper.
 */

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

function layout(title: string, body: string, buttonText: string, link: string): string {
  return `<!doctype html>
<html lang="fa" dir="rtl">
<body style="margin:0;padding:0;background:#201212;font-family:Tahoma,Arial,sans-serif;">
  <div dir="rtl" style="max-width:560px;margin:0 auto;padding:24px;background:#030000;color:#eeeeee;text-align:right;">
    <h1 style="margin:0 0 16px;font-size:20px;color:#e36248;">هیتلر ناشناس</h1>
    <h2 style="margin:0 0 16px;font-size:16px;color:#eeeeee;">${title}</h2>
    <p style="font-size:14px;line-height:1.9;color:#cccccc;">${body}</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${link}" style="display:inline-block;padding:12px 28px;background:#2185d0;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:bold;">${buttonText}</a>
    </p>
    <p dir="ltr" style="font-size:12px;color:#888888;word-break:break-all;text-align:left;">${link}</p>
    <p style="font-size:12px;color:#888888;">اگر این درخواست را شما نداده‌اید، این ایمیل را نادیده بگیرید. این لینک یک روز اعتبار دارد.</p>
  </div>
</body>
</html>`;
}

export function verificationEmail(to: string, username: string, link: string): MailMessage {
  const name = escapeHtml(username);
  return {
    to,
    subject: 'هیتلر ناشناس — تأیید حساب کاربری',
    html: layout('تأیید حساب کاربری', `سلام ${name}، درخواستی برای تأیید حساب شما ثبت شده است. برای تأیید حساب روی دکمه‌ی زیر بزنید.`, 'تأیید حساب', link),
    text: `سلام ${username}، درخواستی برای تأیید حساب شما ثبت شده است. برای تأیید حساب به این آدرس بروید: ${link}`,
  };
}

export function passwordResetEmail(to: string, username: string, link: string): MailMessage {
  const name = escapeHtml(username);
  return {
    to,
    subject: 'هیتلر ناشناس — بازیابی رمز عبور',
    html: layout('بازیابی رمز عبور', `سلام ${name}، درخواستی برای تغییر رمز عبور شما ثبت شده است. برای انتخاب رمز جدید روی دکمه‌ی زیر بزنید.`, 'تغییر رمز عبور', link),
    text: `سلام ${username}، درخواستی برای تغییر رمز عبور شما ثبت شده است. برای تغییر رمز به این آدرس بروید: ${link}`,
  };
}
