import Link from "next/link"

// ── Per-jurisdiction empty-state copy: crawl cadence + source-portal link. ──
// Honest about WHY it's empty and what happens next (B4). Never implies data is
// coming if a crawl already ran and returned 0 — the caller only renders NoFilingsYet
// once last_crawled_at is set (or the assembling grace elapsed).
const PORTAL: Record<
  string,
  { name: string; crawl: string; url: (id: string) => string }
> = {
  PUCT: {
    name: "PUCT Interchange",
    crawl: "05:00 CT",
    url: (id) =>
      `https://interchange.puc.texas.gov/search/filings/?ControlNumber=${encodeURIComponent(id)}`,
  },
  ERCOT: { name: "ERCOT", crawl: "05:00 CT", url: () => "https://www.ercot.com/mktrules/issues" },
  CPUC: { name: "CPUC Docs", crawl: "the daily crawl", url: () => "https://docs.cpuc.ca.gov" },
  CAISO: { name: "CAISO", crawl: "the daily crawl", url: () => "https://www.caiso.com" },
  "CAISO-FERC": {
    name: "FERC eLibrary",
    crawl: "the daily crawl",
    url: () => "https://elibrary.ferc.gov",
  },
  FERC: { name: "FERC eLibrary", crawl: "the daily crawl", url: () => "https://elibrary.ferc.gov" },
  "PJM-FERC": {
    name: "FERC eLibrary",
    crawl: "the daily crawl",
    url: () => "https://elibrary.ferc.gov",
  },
  "NJ-BPU": {
    name: "NJ BPU",
    crawl: "the daily crawl",
    url: () => "https://publicaccess.bpu.state.nj.us",
  },
  "MD-PSC": {
    name: "MD PSC",
    crawl: "the daily crawl",
    url: () => "https://webpscxb.pscmaryland.com/DMS/official-filings",
  },
  "VA-SCC": {
    name: "VA SCC",
    crawl: "the daily crawl",
    url: () => "https://www.scc.virginia.gov/docketsearch",
  },
}

function portalFor(jurisdiction: string | null, externalId: string) {
  const p = PORTAL[jurisdiction ?? ""]
  if (!p) return { name: "the source portal", crawl: "the daily crawl", url: "#" }
  return { name: p.name, crawl: p.crawl, url: p.url(externalId) }
}

function Spinner() {
  return (
    <span
      className="inline-block w-4 h-4 flex-shrink-0 rounded-full border-2 border-[var(--np-accent)] border-t-transparent animate-spin"
      aria-hidden="true"
    />
  )
}

// State: assembling — a crawl/extraction is in flight. Spinner + skeletons, never
// perpetual (the caller flips to NoFilingsYet once the crawl completes or grace ends).
export function AssemblingBanner() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3 rounded-[var(--np-radius-lg)] border border-[var(--np-accent)] bg-[var(--np-surface-elevated)] px-5 py-4">
        <span className="mt-0.5">
          <Spinner />
        </span>
        <div>
          <p className="text-[14px] font-medium text-[var(--np-accent-text)]">
            Assembling your record — fetching filings and extracting deadlines.
          </p>
          <p className="text-[13px] text-[var(--np-text-muted)] mt-0.5">
            Usually 2–10 min. This page fills in as filings land — no need to refresh.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5" aria-hidden="true">
        {[64, 92, 48].map((w, i) => (
          <div
            key={i}
            className="h-3 rounded bg-[var(--np-border)]"
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
    </div>
  )
}

// State: no-filings-yet — a crawl ran (or the docket is checked daily) and there's
// genuinely nothing. Honest, with the source-portal link. NEVER a spinner.
export function NoFilingsYet({
  jurisdiction,
  externalId,
}: {
  jurisdiction: string | null
  externalId: string
}) {
  const p = portalFor(jurisdiction, externalId)
  return (
    <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface-elevated)] px-8 py-12 text-center">
      <div className="text-[28px] leading-none mb-3" aria-hidden="true">
        🔎
      </div>
      <h2 className="text-[var(--np-text-strong)] font-medium text-[15px] mb-2">
        No filings found yet for this docket
      </h2>
      <p className="text-[var(--np-text-muted)] text-[13px] max-w-md mx-auto leading-relaxed">
        We check this docket on every daily crawl ({p.crawl}). New or low-activity dockets
        may have nothing filed yet — we&rsquo;ll surface filings here the moment they appear.
      </p>
      <div className="flex items-center justify-center gap-2 mt-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--np-border)] px-3 py-1 text-[12px] text-[var(--np-text-muted)]">
          <span aria-hidden="true">🕓</span> Tracking · checked daily
        </span>
        {p.url !== "#" && (
          <Link
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--np-border)] px-3 py-1 text-[12px] text-[var(--np-accent-text)] hover:text-[var(--np-accent-hover)] transition-colors"
          >
            <span aria-hidden="true">↗</span> View on {p.name}
          </Link>
        )}
      </div>
    </div>
  )
}

// State: partial + processing — filings are shown, but extraction (deadlines/parties/
// salience) is still running. Small inline cue; disappears once extraction settles.
export function ProcessingStrip({ label }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-[var(--np-surface-elevated)] border border-[var(--np-accent)] px-3.5 py-1.5 text-[12px] text-[var(--np-accent-text)]">
      <Spinner />
      {label ?? "Extracting deadlines & parties…"}
    </div>
  )
}
