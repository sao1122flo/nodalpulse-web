const BREVO_API = "https://api.brevo.com/v3/smtp/email"

const FROM = {
  name: process.env.BREVO_FROM_NAME ?? "NodalPulse",
  email: process.env.BREVO_FROM_EMAIL ?? "noreply@nodalpulse.com",
}

async function brevoSend(to: string, subject: string, html: string) {
  const res = await fetch(BREVO_API, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sender: FROM, to: [{ email: to }], subject, htmlContent: html }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Brevo error ${res.status}: ${body}`)
  }
  return res.json()
}

export async function sendMagicLink({ to, url }: { to: string; url: string }) {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td align="center" style="padding:48px 16px">
<table width="100%" style="max-width:480px;background:#1a1d27;border:1px solid #2a2d3a;border-radius:8px;padding:40px 36px" cellpadding="0" cellspacing="0" role="presentation">
<tr><td>
<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">NodalPulse</p>
<h1 style="margin:0 0 14px;font-size:20px;font-weight:600;color:#f3f4f6;letter-spacing:-.02em">Sign in to your account</h1>
<p style="margin:0 0 28px;font-size:14px;color:#9ca3af;line-height:1.65">Click the button below to complete your sign-in. This link expires in 15 minutes and can only be used once.</p>
<a href="${url}" style="display:inline-block;background:#4f46e5;color:#fff;font-size:14px;font-weight:500;padding:11px 22px;border-radius:6px;text-decoration:none">Sign in to NodalPulse</a>
<p style="margin:28px 0 0;font-size:12px;color:#4b5563">If you didn't request this, you can ignore this email — your account remains secure.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
  await brevoSend(to, "Sign in to NodalPulse", html)
}

export async function sendTeamInviteEmail({
  to,
  ownerName,
  ownerEmail,
  acceptUrl,
}: {
  to: string
  ownerName: string
  ownerEmail: string
  acceptUrl: string
}) {
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation">
<tr><td align="center" style="padding:48px 16px">
<table width="100%" style="max-width:480px;background:#1a1d27;border:1px solid #2a2d3a;border-radius:8px;padding:40px 36px" cellpadding="0" cellspacing="0" role="presentation">
<tr><td>
<p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#6b7280">NodalPulse</p>
<h1 style="margin:0 0 14px;font-size:20px;font-weight:600;color:#f3f4f6;letter-spacing:-.02em">You've been invited</h1>
<p style="margin:0 0 6px;font-size:14px;color:#9ca3af;line-height:1.65"><strong style="color:#d1d5db">${ownerName}</strong> (${ownerEmail}) has invited you to join their NodalPulse team.</p>
<p style="margin:0 0 28px;font-size:14px;color:#9ca3af;line-height:1.65">NodalPulse delivers personalized regulatory briefs for ERCOT participants — PUCT, ERCOT, and FERC filings, filtered to what matters to you, every weekday at 06:00&nbsp;CT.</p>
<a href="${acceptUrl}" style="display:inline-block;background:#4f46e5;color:#fff;font-size:14px;font-weight:500;padding:11px 22px;border-radius:6px;text-decoration:none">Accept invitation</a>
<p style="margin:28px 0 0;font-size:12px;color:#4b5563">If you didn't expect this invitation, you can ignore this email.</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`
  await brevoSend(to, `${ownerName} invited you to NodalPulse`, html)
}

export async function sendTestEmail(to: string) {
  return brevoSend(to, "NodalPulse — email test", "<p>Email is working.</p>")
}
