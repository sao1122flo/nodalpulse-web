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
  await brevoSend(
    to,
    "Sign in to NodalPulse",
    `<p>Click <a href="${url}">here</a> to sign in to NodalPulse.</p><p>This link expires in 15 minutes.</p>`,
  )
}

export async function sendTestEmail(to: string) {
  return brevoSend(to, "NodalPulse — email test", "<p>Email is working.</p>")
}
