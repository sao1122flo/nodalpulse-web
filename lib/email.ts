import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY!)

export async function sendMagicLink({ to, url }: { to: string; url: string }) {
  await resend.emails.send({
    from: process.env.RESEND_FROM ?? "NodalPulse <noreply@nodalpulse.com>",
    to,
    subject: "Sign in to NodalPulse",
    html: `<p>Click <a href="${url}">here</a> to sign in to NodalPulse.</p><p>This link expires in 15 minutes.</p>`,
  })
}

export async function sendTestEmail(to: string) {
  return resend.emails.send({
    from: process.env.RESEND_FROM ?? "NodalPulse <noreply@nodalpulse.com>",
    to,
    subject: "NodalPulse — email test",
    html: "<p>Email is working. 🚀</p>",
  })
}
