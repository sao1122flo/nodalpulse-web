// Maps jurisdiction DB values to the market token key and display label.
// Jurisdiction values: PUCT | ERCOT | FERC | CAISO-FERC | CAISO | CPUC | PJM-FERC | PJM | NJ-BPU | MD-PSC | VA-SCC

const JURISDICTION_TO_MKT: Record<string, string> = {
  FERC:        "ferc",
  CAISO:       "caiso",
  "CAISO-FERC":"caiso",
  CPUC:        "cpuc",
  PJM:         "pjm",
  "PJM-FERC":  "pjm",
  "NJ-BPU":    "pjm",   // NJ state PUC — PJM region (reuses PJM palette)
  "MD-PSC":    "pjm",   // MD state PUC — PJM region (reuses PJM palette)
  "VA-SCC":    "pjm",   // VA state SCC — PJM region (reuses PJM palette)
  PUCT:        "puct",
  ERCOT:       "ercot",
}

const JURISDICTION_LABEL: Record<string, string> = {
  FERC:        "FERC",
  CAISO:       "CAISO",
  "CAISO-FERC":"CAISO",
  CPUC:        "CPUC",
  PJM:         "PJM",
  "PJM-FERC":  "PJM",
  "NJ-BPU":    "NJ",    // per-state label — show the state, never the bare market "PJM"
  "MD-PSC":    "MD",    // per-state label — show the state, never the bare market "PJM"
  "VA-SCC":    "VA",    // per-state label — show the state, never the bare market "PJM"
  PUCT:        "PUCT",
  ERCOT:       "ERCOT",
}

export function jurisdictionStyle(jurisdiction: string): React.CSSProperties {
  const mkt = JURISDICTION_TO_MKT[jurisdiction]
  if (!mkt) return {
    color: "var(--np-text-muted)",
    background: "var(--np-surface-deep)",
    borderColor: "var(--np-border)",
  }
  return {
    color:       `var(--np-mkt-${mkt}-text)`,
    background:  `var(--np-mkt-${mkt}-fill)`,
    borderColor: `var(--np-mkt-${mkt}-border)`,
  }
}

export function jurisdictionLabel(jurisdiction: string): string {
  return JURISDICTION_LABEL[jurisdiction] ?? jurisdiction
}

export function JurisdictionBadge({ jurisdiction }: { jurisdiction: string | null }) {
  if (!jurisdiction) return null
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border shrink-0"
      style={jurisdictionStyle(jurisdiction)}
    >
      {jurisdictionLabel(jurisdiction)}
    </span>
  )
}
