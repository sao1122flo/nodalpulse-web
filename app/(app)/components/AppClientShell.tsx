"use client"

import { Suspense } from "react"
import { DocketSidePanel } from "./DocketSidePanel"
import { CommandPalette } from "./CommandPalette"

// DocketSidePanel uses useSearchParams() — must be inside <Suspense>
export function AppClientShell() {
  return (
    <Suspense>
      <DocketSidePanel />
      <CommandPalette />
    </Suspense>
  )
}
