import type { SalienceItem } from "../queries"

const MARKET_NAMES: Record<string, string> = {
  FERC:  "FERC",
  PUCT:  "PUCT",
  ERCOT: "ERCOT",
  CAISO: "CAISO",
  PJM:   "PJM",
}

const MARKET_ORDER = ["FERC", "CAISO", "PJM", "PUCT", "ERCOT"]

interface Props {
  items: SalienceItem[]
  markets: string[]
}

export function SaliencePanel({ items, markets }: Props) {
  if (markets.length === 0) return null

  const byMarket = new Map<string, SalienceItem[]>()
  for (const item of items) {
    if (!byMarket.has(item.market)) byMarket.set(item.market, [])
    byMarket.get(item.market)!.push(item)
  }

  const orderedMarkets = MARKET_ORDER.filter(m => markets.includes(m))

  return (
    <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface)] px-5 py-4">
      <h2 className="text-[11px] font-semibold text-[var(--np-text-muted)] uppercase tracking-[0.06em] mb-4">
        What&rsquo;s driving your markets this week
      </h2>

      <div className="flex flex-col gap-4">
        {orderedMarkets.map(market => {
          const marketItems = byMarket.get(market) ?? []
          const label = MARKET_NAMES[market] ?? market

          return (
            <div key={market}>
              <div className="text-[10px] font-bold text-[var(--np-accent-text)] uppercase tracking-[0.08em] mb-2">
                {label}
              </div>
              {marketItems.length === 0 ? (
                <p className="text-[13px] text-[var(--np-text-muted)] italic leading-snug">
                  Quiet week — no dominant proceedings yet
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {marketItems.map(item => (
                    <div key={item.docketKey} className="flex items-start gap-2">
                      <span className="font-mono text-[11px] text-[var(--np-accent-text)] shrink-0 mt-[2px]">
                        {item.docketKey}
                      </span>
                      <span className="text-[13px] text-[var(--np-text-body)] leading-snug">
                        {item.headline ?? item.docketTitle ?? item.docketKey}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
