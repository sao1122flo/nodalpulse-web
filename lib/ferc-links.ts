// FERC eLibrary link helpers.
//
// FERC-family filings (jurisdiction FERC / PJM-FERC / CAISO-FERC) have no public
// source_url — the document is fetched via the eLibrary webapi and stored in R2.
// The extraction worker previously wrote a verify_url of the form
//   https://elibrary.ferc.gov/eLibrary/search?q=<docket>
// but the new eLibrary is a JS single-page app that ignores ?q= as a deep link,
// so that URL lands on an empty search page.
//
// Working deep link (confirmed): the per-accession file list —
//   /eLibrary/filelist?accession_number=YYYYMMDD-NNNN
// (The /docketsheet?docketNumber= form was tested and does NOT deep-link.)
// FERC filing external_ids ARE the accession number (e.g. "20260601-5389"), so we
// can always build the precise per-filing link.

const FERC_BASE = "https://elibrary.ferc.gov/eLibrary"

// FERC accession number format: 8-digit date + dash + 3–5 digit series.
const FERC_ACCESSION = /^\d{8}-\d{3,5}$/

// The broken SPA search URL the extractor used to emit.
const FERC_SEARCH_RX = /elibrary\.ferc\.gov\/eLibrary\/search\?q=/i

const clean = (s: string | null | undefined): string | null => {
  const v = s?.trim()
  return v ? v : null
}

export function isBrokenFercSearchUrl(url: string | null | undefined): boolean {
  return !!url && FERC_SEARCH_RX.test(url)
}

/** Per-filing eLibrary link from a FERC accession (= the filing's external_id). */
export function fercAccessionUrl(filingExternalId: string | null | undefined): string | null {
  const id = clean(filingExternalId)
  return id && FERC_ACCESSION.test(id)
    ? `${FERC_BASE}/filelist?accession_number=${id}`
    : null
}

/**
 * Best verifiable source link for a deadline/filing row, FERC-aware.
 * Priority: a real per-deadline verify_url (not the broken search URL) → a real
 * filing source_url → the FERC accession filelist link. Returns null if none.
 */
export function bestSourceLink(
  verifyUrl: string | null | undefined,
  sourceUrl: string | null | undefined,
  filingExternalId: string | null | undefined,
): string | null {
  const v = clean(verifyUrl)
  if (v && !isBrokenFercSearchUrl(v)) return v
  const s = clean(sourceUrl)
  if (s) return s
  return fercAccessionUrl(filingExternalId)
}
