import type { LeadRecord } from '../types/leadin';

function encodeBase64Url(input: string): string {
  const utf8Bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < utf8Bytes.length; i += 1) {
    binary += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildProspectAlertEmail(leads: LeadRecord[], recipientEmail: string): {
  subject: string;
  htmlBody: string;
  textBody: string;
} {
  const count = leads.length;
  const topScore = Math.max(...leads.map((l) => l.aiScore), 0);
  const subject = `[Leadin Alert] ${count} High-Value Freelance Prospect${count === 1 ? '' : 's'} (Top Score ${topScore}/100)`;

  const rowsHtml = leads
    .map(
      (lead) => `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <strong>${escapeHtml(lead.accountName)}</strong><br/>
          <span style="color:#64748b;font-size:12px;">${escapeHtml(lead.platform.toUpperCase())} · ${escapeHtml(lead.postDate)}</span>
        </td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <strong>${escapeHtml(lead.work)}</strong><br/>
          <span style="color:#334155;font-size:13px;">${escapeHtml(lead.post.slice(0, 260))}${lead.post.length > 260 ? '...' : ''}</span>
        </td>
        <td style="padding:12px;border-bottom:1px solid #e2e8f0;vertical-align:top;">
          <strong style="color:#059669;">${lead.aiScore}/100</strong><br/>
          <span style="font-size:12px;color:#475569;">${escapeHtml(lead.contact)}</span><br/>
          ${
            lead.link
              ? `<a href="${escapeHtml(lead.link)}" style="color:#0284c7;font-size:12px;">Open Post</a>`
              : ''
          }
        </td>
      </tr>`
    )
    .join('');

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:740px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#059669;margin-bottom:4px;">Leadin High-Value Prospect Digest</h2>
      <p style="color:#475569;font-size:14px;margin-top:0;">
        Sent to ${escapeHtml(recipientEmail)} · ${count} prospect${count === 1 ? '' : 's'} matched your AI score threshold.
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;font-size:14px;">
        <thead>
          <tr style="background:#f8fafc;text-align:left;">
            <th style="padding:10px 12px;border-bottom:1px solid #cbd5e1;">Account & Date</th>
            <th style="padding:10px 12px;border-bottom:1px solid #cbd5e1;">Work & Post</th>
            <th style="padding:10px 12px;border-bottom:1px solid #cbd5e1;">Score & Contact</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;

  const textBody = leads
    .map(
      (lead, i) =>
        `${i + 1}. ${lead.accountName} (${lead.platform} · ${lead.postDate}) — Score: ${lead.aiScore}/100\nWork: ${lead.work}\nContact: ${lead.contact}\nLink: ${lead.link}\nPost: ${lead.post.slice(0, 300)}\n`
    )
    .join('\n---\n\n');

  return { subject, htmlBody, textBody };
}

export async function sendGmailAlert(params: {
  accessToken: string;
  to: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}): Promise<{ id: string }> {
  const boundary = `leadin_${Date.now()}`;
  const rawMessage = [
    `To: ${params.to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(params.subject)))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    params.textBody,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    params.htmlBody,
    '',
    `--${boundary}--`,
  ].join('\r\n');

  const encoded = encodeBase64Url(rawMessage);
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: encoded }),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 401 || res.status === 403) {
      throw new Error('Gmail authorization expired or missing. Please reconnect your Google account.');
    }
    throw new Error(`Gmail API error (${res.status}): ${errText}`);
  }

  const data = (await res.json()) as { id?: string };
  return { id: data.id || `gmail_${Date.now()}` };
}
