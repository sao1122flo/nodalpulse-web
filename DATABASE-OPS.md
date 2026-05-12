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
