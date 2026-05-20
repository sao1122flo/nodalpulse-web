import { describe, it, expect } from "vitest"

// ---------------------------------------------------------------------------
// WCAG 2.1 contrast math (§1.4.3 / §1.4.11)
// ---------------------------------------------------------------------------
function srgbLinear(c8: number): number {
  const c = c8 / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function luminance(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16)
  const r = srgbLinear((n >> 16) & 0xff)
  const g = srgbLinear((n >> 8) & 0xff)
  const b = srgbLinear(n & 0xff)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(hex1: string, hex2: string): number {
  const l1 = luminance(hex1)
  const l2 = luminance(hex2)
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

// ---------------------------------------------------------------------------
// Token values extracted from app/globals.css under [data-theme="dark"].
// The layout sets data-theme="dark" unconditionally — there is no light mode.
// --np-indigo-50 is defined only in :root and is NOT overridden in dark mode,
// so it stays #EEF2FF even when the rest of the page is dark.
// ---------------------------------------------------------------------------
const DARK = {
  surface:        "#0A0A0D",
  surfaceElev:    "#18181B",
  indigo50:       "#EEF2FF",   // card bg for highlighted tier — always light
  indigo600:      "#4F46E5",   // "Most popular" badge bg
  textPrimary:    "#FAFAFA",   // dark-mode resolved value
  textBody:       "#A3A3A3",   // dark-mode resolved value
  textMuted:      "#52525B",   // dark-mode resolved value
  textStrong:     "#D4D4D8",
  white:          "#FFFFFF",
} as const

// Hardcoded colors applied on the highlighted card (Prompt 4 + this fix)
const HIGHLIGHT_TEXT = {
  tierName:     "#312e81",  // tier name, /mo period, CTA text on highlighted card
  price:        "#1e1b4b",  // large price amount ($199)
}

const WCAG_AA_NORMAL = 4.5  // ≥4.5:1 for text < 18px / non-bold < 14px
const WCAG_AA_LARGE  = 3.0  // ≥3:1 for text ≥18px or bold ≥14px; also UI components

// ---------------------------------------------------------------------------
// Highlighted Pro card — dark mode
// Card background: --np-indigo-50 = #EEF2FF (light lavender, not dark-mode-aware)
// ---------------------------------------------------------------------------
describe("pricing page — highlighted Pro card (dark mode, bg #EEF2FF)", () => {
  const bg = DARK.indigo50

  it("tier name contrast passes AA (4.5:1) — #312e81 on #EEF2FF", () => {
    expect(contrast(HIGHLIGHT_TEXT.tierName, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  it("price amount contrast passes AA large text (3:1) — #1e1b4b on #EEF2FF", () => {
    // 22px semibold qualifies as large text
    expect(contrast(HIGHLIGHT_TEXT.price, bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE)
  })

  it("price amount contrast also passes AA normal (4.5:1)", () => {
    // Belt-and-suspenders: we chose a dark enough value that it clears AA normal too
    expect(contrast(HIGHLIGHT_TEXT.price, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  it("/mo period contrast passes AA (4.5:1) — #312e81 on #EEF2FF", () => {
    expect(contrast(HIGHLIGHT_TEXT.tierName, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  it("'Current plan' / 'Switch to' CTA text passes AA (4.5:1) — #312e81 on #EEF2FF", () => {
    expect(contrast(HIGHLIGHT_TEXT.tierName, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  it("'Most popular' badge text passes AA (4.5:1) — white on indigo-600", () => {
    expect(contrast(DARK.white, DARK.indigo600)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  // Regression guard: the OLD color that caused the bug
  it("REGRESSION: old --np-text-primary (#FAFAFA) would have failed on #EEF2FF", () => {
    // This documents why the fix was needed — near-white on near-white = invisible
    expect(contrast(DARK.textPrimary, bg)).toBeLessThan(1.5)
  })

  it("REGRESSION: old --np-text-body (#A3A3A3) would have failed on #EEF2FF", () => {
    // /mo period and CTA used --np-text-body in dark mode before the fix
    expect(contrast(DARK.textBody, bg)).toBeLessThan(WCAG_AA_NORMAL)
  })
})

// ---------------------------------------------------------------------------
// Non-highlighted tier cards — dark mode
// Background: --np-surface = #0A0A0D
// ---------------------------------------------------------------------------
describe("pricing page — non-highlighted tier cards (dark mode, bg #0A0A0D)", () => {
  const bg = DARK.surface

  it("price amount passes AA normal (4.5:1) — --np-text-primary on surface", () => {
    expect(contrast(DARK.textPrimary, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  it("tier name passes AA (4.5:1) — --np-text-strong on surface", () => {
    expect(contrast(DARK.textStrong, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })

  it("CTA text passes AA (4.5:1) — --np-text-body on surface", () => {
    expect(contrast(DARK.textBody, bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })
})

// ---------------------------------------------------------------------------
// Feature comparison table — highlighted column (dark mode)
// Header bg: --np-indigo-50; cell bg: color-mix(indigo-50 40%, transparent)
// Use pure indigo-50 as worst case (more opaque = more contrast challenge)
// ---------------------------------------------------------------------------
describe("pricing page — feature table highlighted column (dark mode)", () => {
  const headerBg = DARK.indigo50

  it("column header text passes AA (4.5:1) — #312e81 on #EEF2FF", () => {
    expect(contrast(HIGHLIGHT_TEXT.tierName, headerBg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL)
  })
})
