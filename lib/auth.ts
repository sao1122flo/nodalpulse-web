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
        await sendMagicLink({ to: email, url })
      },
    }),
  ],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  databaseHooks: {
    user: {
      create: {
        before: async (user: any) => ({
          data: {
            ...user,
            id: toUUID(user.id),
            image: user.image?.startsWith("data:") ? null : user.image,
          },
        }),
      },
    },
  } as any,
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.Session.user
