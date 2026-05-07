import { NextResponse } from "next/server"
import { db } from "@/db/client"
import { healthChecks } from "@/db/schema"

export async function GET() {
  const checks: Record<string, string> = {}

  try {
    await db.insert(healthChecks).values({})
    checks.db = "ok"
  } catch (e) {
    checks.db = `error: ${e}`
  }

  const ok = Object.values(checks).every((v) => v === "ok")

  return NextResponse.json(
    { status: ok ? "ok" : "degraded", ...checks },
    { status: ok ? 200 : 503 }
  )
}
