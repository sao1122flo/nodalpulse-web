import { z } from "zod"

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith("sk_"),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith("whsec_"),
  STRIPE_PRICE_INDIVIDUAL: z.string().startsWith("price_").optional(),
  STRIPE_PRICE_PRO: z.string().startsWith("price_").optional(),
  STRIPE_PRICE_TEAM: z.string().startsWith("price_").optional(),
  STRIPE_PRICE_ORG: z.string().startsWith("price_").optional(),
  BREVO_API_KEY: z.string().min(1),
  BREVO_FROM_EMAIL: z.string().default("noreply@nodalpulse.com"),
  BREVO_FROM_NAME: z.string().default("NodalPulse"),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_ENDPOINT_URL: z.string().min(1),
  R2_BUCKET: z.string().default("nodalpulse-docs"),
  SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().min(1).default("http://localhost:3000"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
})

export const env = envSchema.parse(process.env)
