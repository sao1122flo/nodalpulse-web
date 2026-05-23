import { NextResponse } from "next/server"
import { sql } from "drizzle-orm"
import { db } from "@/db/client"

export async function GET() {
  const checks: Record<string, string> = {}

  try {
    await db.execute(sql`SELECT 1`)
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
