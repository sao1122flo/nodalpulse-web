/**
 * T6 verification: confirm CAISO crawl landed correctly.
 *
 * Checks:
 *   1. CAISO filings count + sample titles
 *   2. Docket numbers extracted (metadata->docket_numbers must be non-empty FERC IDs)
 *   3. Multi-docket spot-check: DCR Transmission (ER23-2309, ER24-1394, EL26-34)
 *   4. filing_dockets junction rows (count + is_primary distribution)
 *   5. llm_calls cost baseline — avg cost per extraction (gate G4 target: <$0.15/item)
 *
 * Usage: node scripts/verify-caiso-crawl.mjs
 */
import { readFileSync, existsSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"
import postgres from "postgres"

const __dirname = dirname(fileURLToPath(import.meta.url))
const webRoot = resolve(__dirname, "..")

const envPath = resolve(webRoot, ".env.local")
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim()
    if (!t || t.startsWith("#")) continue
    const idx = t.indexOf("=")
    if (idx < 0) continue
    const key = t.slice(0, idx).trim()
    if (!process.env[key]) process.env[key] = t.slice(idx + 1).trim()
  }
}

const url = process.env.DATABASE_URL
if (!url) { console.error("DATABASE_URL not set"); process.exit(1) }

const sql = postgres(url, { ssl: "require" })

try {
  // ── 1. CAISO filing count + recent sample ──────────────────────────────────
  console.log("=== 1. CAISO filings ===")
  const counts = await sql`
    SELECT COUNT(*)::int AS total
    FROM filings
    WHERE source_id = (SELECT id FROM sources WHERE slug = 'caiso')
  `
  console.log("Total CAISO filings:", counts[0].total)

  const sample = await sql`
    SELECT title, filed_at::date, metadata->>'docket_numbers' AS docket_numbers
    FROM filings
    WHERE source_id = (SELECT id FROM sources WHERE slug = 'caiso')
    ORDER BY filed_at DESC
    LIMIT 5
  `
  console.table(sample)

  // ── 2. Docket number health: any filings with NULL / empty docket_numbers ──
  console.log("\n=== 2. Docket extraction health ===")
  const nullDockets = await sql`
    SELECT COUNT(*)::int AS filings_without_dockets
    FROM filings
    WHERE source_id = (SELECT id FROM sources WHERE slug = 'caiso')
      AND (metadata->'docket_numbers' IS NULL
           OR jsonb_array_length(metadata->'docket_numbers') = 0)
  `
  console.log("Filings with no docket_numbers:", nullDockets[0].filings_without_dockets,
    nullDockets[0].filings_without_dockets === 0 ? "(OK)" : "(WARN: investigate)")

  // ── 3. Multi-docket spot-check: DCR Transmission triple-caption ───────────
  console.log("\n=== 3. Multi-docket spot-check (DCR Transmission ER23-2309 / ER24-1394 / EL26-34) ===")
  const dcr = await sql`
    SELECT f.title, f.metadata->'docket_numbers' AS docket_numbers,
           COUNT(fd.docket_id)::int AS junction_row_count,
           BOOL_OR(fd.is_primary) AS has_primary
    FROM filings f
    LEFT JOIN filing_dockets fd ON fd.filing_id = f.id
    WHERE f.source_id = (SELECT id FROM sources WHERE slug = 'caiso')
      AND f.metadata->>'docket_numbers' LIKE '%ER23-2309%'
    GROUP BY f.id, f.title, f.metadata
    ORDER BY f.filed_at DESC
    LIMIT 3
  `
  if (dcr.length === 0) {
    console.log("DCR Transmission filing not found (may not have been in the since window — try enqueue with an earlier date)")
  } else {
    console.table(dcr)
    for (const row of dcr) {
      const n = JSON.parse(row.docket_numbers || "[]").length
      if (n >= 3 && row.junction_row_count >= 3 && row.has_primary) {
        console.log(`  ✓ ${n} dockets, ${row.junction_row_count} junction rows, is_primary set`)
      } else {
        console.log(`  WARN: expected ≥3 dockets/junction rows; got dockets=${n} junctions=${row.junction_row_count}`)
      }
    }
  }

  // ── 4. filing_dockets distribution ────────────────────────────────────────
  console.log("\n=== 4. filing_dockets distribution (CAISO filings) ===")
  const junctionStats = await sql`
    SELECT
      COUNT(DISTINCT fd.filing_id)::int AS filings_with_junctions,
      COUNT(*)::int                     AS total_junction_rows,
      SUM(CASE WHEN fd.is_primary THEN 1 ELSE 0 END)::int AS primary_rows,
      SUM(CASE WHEN NOT fd.is_primary THEN 1 ELSE 0 END)::int AS secondary_rows
    FROM filing_dockets fd
    JOIN filings f ON f.id = fd.filing_id
    WHERE f.source_id = (SELECT id FROM sources WHERE slug = 'caiso')
  `
  console.table(junctionStats)

  // ── 5. llm_calls cost baseline (gate G4: <$0.15/displayed item) ───────────
  console.log("\n=== 5. llm_calls cost baseline (last 7 days) ===")
  const costByStage = await sql`
    SELECT
      pipeline_stage,
      COUNT(*)::int            AS calls,
      SUM(input_tokens + output_tokens)::int AS total_tokens,
      ROUND(SUM(cost_usd_estimate)::numeric, 4) AS total_cost_usd,
      ROUND(AVG(cost_usd_estimate)::numeric, 5) AS avg_cost_per_call
    FROM llm_calls
    WHERE created_at >= NOW() - INTERVAL '7 days'
      AND error IS NULL
    GROUP BY pipeline_stage
    ORDER BY total_cost_usd DESC
  `
  console.table(costByStage)

  // pipeline_stage is 'sonnet-extract' + 'haiku-gate' (not 'extraction')
  // G4 cost-per-displayed-item = haiku-gate (pre-filter) + sonnet-extract (if passed)
  const extractionCost = await sql`
    SELECT
      COUNT(DISTINCT filing_id)::int          AS unique_filings_extracted,
      ROUND(AVG(cost_usd_estimate)::numeric, 5) AS avg_cost_per_extraction,
      ROUND(SUM(cost_usd_estimate)::numeric, 4) AS total_extraction_cost_7d
    FROM llm_calls
    WHERE pipeline_stage = 'sonnet-extract'
      AND created_at >= NOW() - INTERVAL '7 days'
      AND error IS NULL
      AND filing_id IS NOT NULL
  `
  console.table(extractionCost)

  const gateCost = await sql`
    SELECT ROUND(AVG(cost_usd_estimate)::numeric, 5) AS avg_gate_cost
    FROM llm_calls
    WHERE pipeline_stage = 'haiku-gate'
      AND created_at >= NOW() - INTERVAL '7 days'
      AND error IS NULL
  `

  const g4Target = 0.15
  const avgExtract = parseFloat(extractionCost[0]?.avg_cost_per_extraction || "0")
  const avgGate    = parseFloat(gateCost[0]?.avg_gate_cost || "0")
  const combined   = avgExtract + avgGate
  if (extractionCost[0]?.unique_filings_extracted === 0) {
    console.log("No extraction data yet — run after extraction jobs process (EXTRACTION_MODE must be active or trigger manually)")
  } else {
    console.log(`G4 gate: haiku-gate $${avgGate.toFixed(5)} + sonnet-extract $${avgExtract.toFixed(5)} = $${combined.toFixed(5)}/item`)
    console.log(combined <= g4Target
      ? `  ✓ $${combined.toFixed(5)} ≤ $${g4Target} — passes`
      : `  WARN: $${combined.toFixed(5)} > $${g4Target} — investigate before scaling`)
  }

} catch (e) {
  console.error("FAIL:", e.message)
  process.exit(1)
} finally {
  await sql.end()
}
