import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  RESEND_API_KEY: z.string().startsWith("re_"),
  RESEND_FROM: z.string().default("NodalPulse <noreply@nodalpulse.com>"),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_ENDPOINT_URL: z.string().min(1),
  R2_BUCKET: z.string().default("nodalpulse-docs"),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().min(1).default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})

export const env = envSchema.parse(process.env)
