import { forbidden } from "next/navigation"
import type { Metadata } from "next"
import { requireAdmin } from "@/lib/auth/require-admin"
import { logAdminAction } from "@/lib/auth/log-admin-action"
import { RefreshForm } from "./RefreshForm"

export const metadata: Metadata = { title: "Extractions — Admin — NodalPulse" }

export default async function AdminExtractionsPage() {
  const admin = await requireAdmin()
  if (!admin.ok) return forbidden()

  await logAdminAction({ action: "admin.viewed_extractions" })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[var(--np-text-primary)] text-xl font-semibold tracking-tight">
          Refresh extraction
        </h1>
        <p className="text-[var(--np-text-muted)] text-[12px] mt-0.5">
          Re-run the extraction pipeline for a single filing by ID.
        </p>
      </div>
      <RefreshForm />
    </div>
  )
}
