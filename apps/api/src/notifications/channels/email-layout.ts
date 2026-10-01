import type { NotificationContent } from '../templates.js';

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface EmailParts {
  subject: string;
  html: string;
  text: string;
}

/**
 * Bildirimi e-postaya çevirir. Tablo tabanlı, satır içi stilli basit şablon:
 * Gmail, Outlook ve telefon e-posta uygulamalarında aynı görünür.
 */
export function renderEmail(
  content: NotificationContent,
  { recipientName, webUrl, settingsPath }: { recipientName: string; webUrl: string; settingsPath: string },
): EmailParts {
  const link = new URL(content.path, webUrl).toString();
  const settingsLink = new URL(settingsPath, webUrl).toString();
  const firstName = recipientName.trim().split(/\s+/)[0] ?? '';
  const details = content.details ?? [];

  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(content.title)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Inter,Arial,Helvetica,sans-serif;color:#18181b">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:24px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#125139;padding:18px 24px;font-size:18px;font-weight:700;color:#ffffff">evdenevenakliyat<span style="color:#fcd34d">.app</span></td></tr>
<tr><td style="padding:28px 24px 8px">
<p style="margin:0 0 12px;font-size:15px">Merhaba ${escape(firstName)},</p>
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.35;color:#10432f">${escape(content.title)}</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.6">${escape(content.body)}</p>
${details.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#3f3f46">${details.map((d) => `<tr><td>${escape(d)}</td></tr>`).join('')}</table>` : ''}
<a href="${escape(link)}" style="display:inline-block;background:#136544;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px">${escape(content.actionLabel)}</a>
</td></tr>
<tr><td style="padding:24px;font-size:12px;line-height:1.6;color:#71717a">
Bu e-postayı evdenevenakliyat.app hesabındaki bildirim tercihlerine göre aldın.
<a href="${escape(settingsLink)}" style="color:#136544">Bildirim ayarlarını değiştir</a>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;

  const text = [
    `Merhaba ${firstName},`,
    '',
    content.title,
    '',
    content.body,
    ...(details.length ? ['', ...details] : []),
    '',
    `${content.actionLabel}: ${link}`,
    '',
    `Bildirim ayarları: ${settingsLink}`,
  ].join('\n');

  return { subject: content.title, html, text };
}
