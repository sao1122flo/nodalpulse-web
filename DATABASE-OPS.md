# Database Operations

## Connection

All DB work (migrations, ad-hoc SELECTs, schema inspection) must go through the CLI.
The Railway in-browser SQL console is off-limits — it has caused injection-vulnerable
copy-paste errors in the past.

```bash
# Interactive psql session against the Railway database
railway run psql $DATABASE_URL

# Or via Railway's native connect shortcut
railway connect postgres
```

> **Local note:** `railway run` injects the *private* `DATABASE_URL` (`postgres.railway.internal`)
> which is only reachable from within Railway's network. For local scripts, use the public URL
> from `.env.local` directly:
>
> ```bash
> node --env-file=.env.local my-script.mjs
> ```
>
> The `--env-file` flag is built into Node 20+. No dotenv dependency needed.

## Applying migrations

Migration files live in `drizzle/`. Apply them with psql:

```bash
railway run psql $DATABASE_URL -f drizzle/<migration-file>.sql
```

Once `drizzle-kit` is wired to Railway's `DATABASE_URL`, the preferred path will be:

```bash
railway run npx drizzle-kit migrate
```

## Schema inspection

```bash
railway run psql $DATABASE_URL -c '\dt'              # list all tables
railway run psql $DATABASE_URL -c '\d <table>'       # describe a table
railway run psql $DATABASE_URL -c 'SELECT COUNT(*) FROM <table>'
```

## Drizzle schema conventions

Tables in `db/schema/index.ts` fall into two ownership classes:

| Owner | Tables | Write from web app? |
|---|---|---|
| `nodalpulse-web` | `users`, `sessions`, `verifications`, `accounts`, `user_profiles`, `entitlements`, `subscriptions`, `briefs`, `admin_actions`, `health_checks` | Yes |
| `nodalpulse-services` | `jobs`, `job_results`, `eval_runs`, `filings`, `extractions`, `sources` | No — read-only. Route any writes through the services API. |

The services-owned tables carry a `// READ-ONLY from nodalpulse-web.` comment block
in the schema file as a reminder.

---

## Backlog

### Services: instrument token usage on job_results.output

Every LLM-touching job in `nodalpulse-services` (`extract`, `compose-brief`, and any
future `llm.*` kind) must write the `usage` block below to `job_results.output`. This
gates the cost dashboard at `/admin/cost` (currently showing a placeholder notice).

```json
{
  "usage": {
    "model": "string",
    "input_tokens": "number",
    "output_tokens": "number",
    "cache_creation_input_tokens": "number",
    "cache_read_input_tokens": "number",
    "cost_usd": "number"
  }
}
```

`cost_usd` is computed services-side from the current Anthropic pricing table. The web
app reads this field and never fetches pricing itself.

Once any row has `output->'usage'->>'cost_usd'` populated, the cost tables on
`/admin/cost` will populate automatically — no web-app deploy required.
