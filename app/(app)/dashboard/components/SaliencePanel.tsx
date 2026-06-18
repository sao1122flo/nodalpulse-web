import type { SalienceItem } from "../queries"
import { jurisdictionStyle } from "./JurisdictionBadge"

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
  const activeMarkets = orderedMarkets.filter(m => (byMarket.get(m) ?? []).length > 0)
  const quietMarkets  = orderedMarkets.filter(m => (byMarket.get(m) ?? []).length === 0)

  if (activeMarkets.length === 0) {
    return (
      <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface)] px-5 py-4">
        <h2 className="text-[11px] font-semibold text-[var(--np-text-muted)] uppercase tracking-[0.06em] mb-1">
          What&rsquo;s driving your markets this week
        </h2>
        <p className="text-[12px] text-[var(--np-text-muted)] italic">
          Quiet week — no dominant proceedings yet
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--np-radius-lg)] border border-[var(--np-border)] bg-[var(--np-surface)] px-5 py-4">
      <h2 className="text-[11px] font-semibold text-[var(--np-text-muted)] uppercase tracking-[0.06em] mb-4">
        What&rsquo;s driving your markets this week
      </h2>

      <div className="flex flex-col gap-4">
        {activeMarkets.map(market => {
          const marketItems = byMarket.get(market) ?? []
          const label = MARKET_NAMES[market] ?? market
          const mktStyle = jurisdictionStyle(market)
          return (
            <div key={market}>
              <div
                className="text-[10px] font-bold uppercase tracking-[0.08em] mb-2"
                style={{ color: mktStyle.color }}
              >
                {label}
              </div>
              <div className="flex flex-col gap-2">
                {marketItems.map(item => (
                  <div key={item.docketKey} className="flex items-start gap-2">
                    <span className="font-mono text-[11px] shrink-0 mt-[2px]" style={{ color: mktStyle.color }}>
                      {item.docketKey}
                    </span>
                    <span className="text-[13px] text-[var(--np-text-body)] leading-snug">
                      {item.headline ?? item.docketTitle ?? item.docketKey}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Quiet markets collapse to a single footer line */}
      {quietMarkets.length > 0 && (
        <p className="text-[11px] text-[var(--np-text-muted)] mt-4 pt-3 border-t border-[var(--np-border)]">
          Quiet — {quietMarkets.map(m => MARKET_NAMES[m] ?? m).join(" · ")}
        </p>
      )}
    </div>
  )
}
