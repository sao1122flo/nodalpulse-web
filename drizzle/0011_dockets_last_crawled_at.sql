-- Record page warming states — durable per-docket "crawled at T" signal.
-- services stamps last_crawled_at on every crawl that covers a docket (touched
-- dockets always; on-demand/watch-set targeted dockets even with 0 results). The
-- Record page uses it to tell "crawled, 0 results" (→ No filings yet) from
-- "never crawled / in-flight" (→ Assembling), so a genuinely-empty docket never
-- shows a perpetual spinner. Idempotent — safe on the shared DB.

ALTER TABLE dockets ADD COLUMN IF NOT EXISTS last_crawled_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS dockets_last_crawled_at_idx ON dockets (last_crawled_at);
