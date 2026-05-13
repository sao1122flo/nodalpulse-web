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

---

### Services + Web: prerequisite for Phase 1c.ii (admin recompose-brief / refresh-extraction)

All four items below must land before the 1c.ii admin UI can be built. Items 1–3 are
services-repo changes; item 4 is a web-repo change. Ship them as a coordinated pair.

#### 1. Services: API auth middleware

Add a Bearer-token dependency to every non-health route in `api/app.py`. The token is a
shared secret stored in both Railway deployments under the same name (`SERVICES_API_KEY`).

```python
# settings.py — add field:
services_api_key: str = ""

# api/app.py — add dependency (preferred over middleware so /health stays open):
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer = HTTPBearer()

def _check_api_key(
    creds: HTTPAuthorizationCredentials = Security(_bearer),
) -> None:
    if creds.credentials != settings.services_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")

# Apply to all protected routes:
@app.post("/brief/recompose", dependencies=[Depends(_check_api_key)])
@app.post("/extraction/refresh", dependencies=[Depends(_check_api_key)])
# Also retrofit /crawl/puct, /crawl/ercot, /brief/trigger if external callers are added.
```

Railway env var: `SERVICES_API_KEY` — set the same value in both the `nodalpulse-services`
and `nodalpulse-web` Railway environments.

#### 2. Services: `POST /brief/recompose`

Per-user recompose endpoint. Contrast with `/brief/trigger` which fans out to all
active users. Reuses the existing `compose-brief` handler — no new job kind needed.

```python
# api/app.py
class RecomposeRequest(BaseModel):
    user_id: str           # UUID string
    brief_date: str        # ISO date, e.g. "2026-05-12"

@app.post("/brief/recompose", dependencies=[Depends(_check_api_key)])
async def recompose_brief(body: RecomposeRequest) -> JSONResponse:
    job_id = await enqueue(
        "compose-brief",
        {"user_id": body.user_id, "brief_date": body.brief_date},
        priority=10,       # above cron default of 5
    )
    return JSONResponse({"job_id": job_id, "status": "queued"})
```

#### 3. Services: `POST /extraction/refresh` + `refresh-extraction` handler

New job kind `refresh-extraction`. The handler accepts only `{"filing_id"}` and fetches
`r2_key` + `doc_type` from the DB itself — unlike the original `extract` handler which
requires those fields in the payload. This keeps the admin caller simple.

```python
# api/app.py
class RefreshExtractionRequest(BaseModel):
    filing_id: str         # UUID string

@app.post("/extraction/refresh", dependencies=[Depends(_check_api_key)])
async def refresh_extraction(body: RefreshExtractionRequest) -> JSONResponse:
    job_id = await enqueue(
        "refresh-extraction",
        {"filing_id": body.filing_id},
        priority=10,
    )
    return JSONResponse({"job_id": job_id, "status": "queued"})

# workers/refresh_extraction.py (new file):
async def handle_refresh_extraction(payload: dict) -> dict:
    from nodalpulse.db.extractions import get_filing
    filing_id = payload["filing_id"]
    filing = await get_filing(filing_id)
    if not filing:
        raise RuntimeError(f"Filing {filing_id} not found")
    # Delegate to the core extract logic — r2_key and doc_type come from the DB row.
    return await handle_extract({
        "filing_id": filing_id,
        "r2_key": filing["r2_key"],
        "doc_type": filing.get("doc_type", "puct-filing"),
    })

# worker.py — add to HANDLERS:
"refresh-extraction": handle_refresh_extraction,
```

#### 4. Web: add `SERVICES_API_URL` + `SERVICES_API_KEY` to `lib/env.ts`

```typescript
// lib/env.ts — add to envSchema:
SERVICES_API_URL: z.string().url(),          // Railway internal URL of services web process
SERVICES_API_KEY: z.string().min(1),
```

Railway env var for `SERVICES_API_URL`: the internal Railway hostname of the services
`web` process, e.g. `https://nodalpulse-services.railway.internal`. Do not use the
public URL — keep traffic on the private network.
