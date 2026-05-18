# NodalPulse — Prerequisites & External Service Setup

One-time setup required before the app can run in production. Local dev only needs `DATABASE_URL`, `BETTER_AUTH_*`, and `STRIPE_*` test keys — everything else can be stubbed or omitted locally.

---

## 1. Railway (hosting + database)

- Create a Railway project and provision a **PostgreSQL** plugin.
- Copy the `DATABASE_URL` from the plugin's connection tab.
- Set all env vars from `.env.example` in the Railway service's Variables tab.
- The app runs on Railway at `nodalpulse-web-production.up.railway.app`; traffic is proxied through Cloudflare to `app.nodalpulse.com`.

---

## 2. Cloudflare (DNS + TLS)

- Add `app.nodalpulse.com` as a CNAME pointing to the Railway service domain.
- Enable **Full (strict)** SSL mode.
- Railway provisions its own TLS cert automatically — Cloudflare handles the public-facing cert.

---

## 3. Brevo (transactional email)

- Create a Brevo account and generate an API key.
- Verify the sender domain (`nodalpulse.com`) via DNS records.
- Set `BREVO_API_KEY`, `BREVO_FROM_EMAIL`, and `BREVO_FROM_NAME` in Railway.

---

## 4. Cloudflare R2 (document storage)

- Create an R2 bucket named `nodalpulse-docs` (or override with `R2_BUCKET`).
- Generate an R2 API token with **Object Read & Write** on that bucket.
- Set `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_ENDPOINT_URL` in Railway.

---

## 5. Stripe (billing)

Full product specs and copy in `regradar/stripe-products.md`. Summary below.

### 5a. Products to create

Create all four in **Stripe Dashboard → Product catalog → Add product**. Use test mode until the first paying customer is queued.

---

#### 1. NodalPulse Starter — $49 / month

| Field | Value |
|---|---|
| **Name** | NodalPulse Starter |
| **Description** | The morning regulatory brief for the Texas electricity market. Every PUCT filing, NPRR amendment, FERC action, and Texas legislative item that touches your role — sourced and cited, in your inbox by 6:30 CT every weekday. Built for solo consultants, junior analysts, and anyone tracking ERCOT regulatory without a dedicated reg-tech team. |
| **Statement descriptor** | `NODALPULSE` |
| **Tax behavior** | Exclusive |
| **Price** | $49.00 USD / month |
| **Trial period** | 14 days |
| **Price description** | Monthly subscription · cancel anytime · 14-day free trial |

Save price ID as `STRIPE_PRICE_STARTER` in Railway.

> **Migration note (P1):** The env var was previously named `STRIPE_PRICE_INDIVIDUAL`. Rename the Railway variable to `STRIPE_PRICE_STARTER` before deploying the P1 code drop.

---

#### 2. NodalPulse Pro — $199 / month *(featured)*

| Field | Value |
|---|---|
| **Name** | NodalPulse Pro |
| **Description** | Everything in Individual, plus per-role personalization, 20 tracked dockets with comment-period and effective-date alerts, and full citation-grounded Q&A across the entire ERCOT/PUCT/FERC corpus. Designed for regulatory leads at REPs and IPPs, energy lawyers with active ERCOT practices, and traders who can't miss a docket. |
| **Statement descriptor** | `NODALPULSE PRO` |
| **Tax behavior** | Exclusive |
| **Price** | $199.00 USD / month |
| **Trial period** | 14 days |
| **Price description** | Monthly subscription · cancel anytime · 14-day free trial |

Save price ID as `STRIPE_PRICE_PRO` in Railway.

---

#### 3. NodalPulse Team — $599 / month

| Field | Value |
|---|---|
| **Name** | NodalPulse Team |
| **Description** | Five seats for a regulatory or compliance team. Shared tracked dockets, team-level brief, Slack integration, and a co-branded weekly summary your team can forward upstream. Built for small REPs, IPP regulatory groups, and boutique consultancies where the team reads from the same script. |
| **Statement descriptor** | `NODALPULSE TEAM` |
| **Tax behavior** | Exclusive |
| **Price** | $599.00 USD / month |
| **Trial period** | 14 days |
| **Price description** | Monthly subscription · 5 seats · cancel anytime · 14-day free trial |

Save price ID as `STRIPE_PRICE_TEAM` in Railway. CTA on pricing page is "Contact us" at launch — flip to self-checkout once Pro has 10+ paying customers.

---

#### 4. NodalPulse Org — $1,499 / month

| Field | Value |
|---|---|
| **Name** | NodalPulse Org |
| **Description** | Fifteen seats with single sign-on (SAML / OIDC), custom taxonomy tags, full audit log export, and API access. Built for enterprise REPs, AmLaw firms with active ERCOT practices, and large IPPs that need compliance-grade traceability, role-level access control, and integration with internal systems. |
| **Statement descriptor** | `NODALPULSE ORG` |
| **Tax behavior** | Exclusive |
| **Price** | $1,499.00 USD / month (annual contracts available on request) |
| **Trial period** | None — sales-assisted |
| **Price description** | Monthly subscription · 15 seats · annual contracts available |

Save price ID as `STRIPE_PRICE_ORG` in Railway. Stays sales-assisted indefinitely.

---

### 5b. Trial behavior

Individual, Pro, and Team get **14-day trials, no card required**. Set `trial_period_days` on the price and use `payment_method_collection: if_required` on the checkout session so Stripe prompts for a card only when the trial converts.

Org: no self-serve trial. Granted manually via custom invoice with `cancel_at_period_end`.

### 5c. Register the webhook endpoint

Run once (requires `STRIPE_SECRET_KEY` in your shell):

```sh
STRIPE_SECRET_KEY=sk_live_... sh scripts/create_stripe_webhook.sh
```

This registers `https://app.nodalpulse.com/api/stripe-webhook` for:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`

The command prints a webhook object — copy the `secret` (`whsec_...`) and set it as `STRIPE_WEBHOOK_SECRET` in Railway.

### 5d. Enable the Customer Portal

In Stripe Dashboard → **Billing → Customer portal**:
- Enable the portal.
- Allow customers to: cancel subscriptions, update payment methods, switch plans.
- Set the return URL to `https://app.nodalpulse.com/settings`.

This powers the **Manage billing** button in Settings.

### 5e. P1 deploy runbook (tier-aware pricing)

Execute in this exact order. Do not skip steps.

**Step 1 — Run the DB migration**

```sh
railway run --service nodalpulse-web npx drizzle-kit migrate
```

Adds `subscriptions.tier` (nullable text) and `entitlements.value` (jsonb, default `{}`).
Verify: `SELECT column_name FROM information_schema.columns WHERE table_name IN ('subscriptions','entitlements') AND column_name IN ('tier','value');`

**Step 2 — Rename Railway env var**

In Railway → nodalpulse-web → Variables:
- Delete `STRIPE_PRICE_INDIVIDUAL`
- Add `STRIPE_PRICE_STARTER` with the same `price_...` value

Do this before deploying the new code. The old code reads `STRIPE_PRICE_PRO` (unaffected).

**Step 3 — Deploy the code**

Push / trigger Railway redeploy. The app now reads `STRIPE_PRICE_STARTER` and all four price ID env vars for tier routing.

**Step 4 — Run the backfill script**

```sh
railway run --service nodalpulse-web tsx scripts/backfill-tier-entitlements.ts
```

Idempotent — safe to re-run if it fails mid-way.

**Step 5 — Verify in Postgres**

```sql
-- Every active subscription should have a non-null tier
SELECT id, user_id, tier, status FROM subscriptions WHERE status = 'active';

-- Each user should have multiple entitlement rows matching their tier
SELECT user_id, feature, value, expires_at
FROM entitlements
ORDER BY user_id, feature;
```

Expected per-tier entitlement row counts: Starter=5, Pro=6, Team=7, Org=9.

---

### 5f. Test the full flow (test mode)

1. Set `STRIPE_SECRET_KEY=sk_test_...` and all four `STRIPE_PRICE_*` test price IDs.
2. Go to `/pricing` → click **Start trial** on a tier → use Stripe test card `4242 4242 4242 4242`.
3. Verify `subscriptions` and `entitlements` rows are written with the correct tier.
4. Confirm `/pricing` shows **Current plan** on the subscribed tier card.
5. Test upgrade/downgrade via the portal: webhook fires → entitlements replaced.
6. Test cancellation: `subscription.deleted` → entitlement rows deleted.

---

## 6. Sentry (error monitoring, optional)

- Create a Next.js project in Sentry.
- Copy the DSN and set `SENTRY_DSN` in Railway.
- If `SENTRY_DSN` is absent the app runs fine — errors are only logged to Railway stdout.

---

## 7. PostHog (product analytics, optional)

- Create a PostHog project and copy the project API key.
- Set `NEXT_PUBLIC_POSTHOG_KEY` in Railway (and `.env.local` for local dev).
- If absent, analytics are silently skipped.
