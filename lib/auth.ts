import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { magicLink } from "better-auth/plugins"
import { randomUUID } from "node:crypto"
import { db } from "@/db/client"
import { users, sessions, verifications, accounts } from "@/db/schema"
import { sendMagicLink } from "./email"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const toUUID = (id: string | null | undefined) => (id && UUID_RE.test(id) ? id : randomUUID())

const microsoftProvider =
  process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
    ? {
        microsoft: {
          clientId: process.env.MICROSOFT_CLIENT_ID,
          clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
          tenantId: "common",
        },
      }
    : {}

const googleProvider =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        },
      }
    : {}

export const auth = betterAuth({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  advanced: { generateId: () => randomUUID() } as any,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: users, session: sessions, verification: verifications, account: accounts },
  }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL!,
  emailAndPassword: { enabled: false },
  socialProviders: {
    ...microsoftProvider,
    ...googleProvider,
  },
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google", "microsoft"] },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // Extract the token from BA's verify URL and send a /magic-link-confirm
        // landing page instead. Pre-fetchers (M365 Safe Links, spam scanners) send
        // GET requests to URLs in emails — if the verify URL lands in the email
        // directly, the scanner consumes the single-use token before the user clicks.
        // The confirm page requires a button click (POST) to consume the token.
        const verifyUrl = new URL(url)
        const token = verifyUrl.searchParams.get("token") ?? ""
        const callbackURL = verifyUrl.searchParams.get("callbackURL") ?? "/dashboard"
        const appOrigin = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.nodalpulse.com"
        const confirmUrl =
          `${appOrigin}/magic-link-confirm` +
          `?token=${encodeURIComponent(token)}` +
          `&callbackURL=${encodeURIComponent(callbackURL)}`
        await sendMagicLink({ to: email, url: confirmUrl })
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        before: async (user: any) => ({
          data: {
            ...user,
            id: toUUID(user.id),
            image: user.image?.startsWith("data:") ? null : user.image,
          },
        }),
      },
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any,
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
