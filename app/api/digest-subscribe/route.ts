import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/db/client"
import { digestLeads } from "@/db/schema"
import { sendDigestSubscribeConfirmation } from "@/lib/email"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(req: NextRequest) {
  let email: unknown
  try {
    ;({ email } = await req.json())
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400, headers: CORS_HEADERS })
  }

  if (!email || typeof email !== "string" || !email.includes("@") || email.length > 254) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400, headers: CORS_HEADERS })
  }

  const normalised = email.trim().toLowerCase()

  const [row] = await db
    .insert(digestLeads)
    .values({ email: normalised, source: req.headers.get("origin") ?? "digest_page" })
    .onConflictDoNothing()
    .returning({ id: digestLeads.id })

  if (row) {
    sendDigestSubscribeConfirmation(normalised).catch(err =>
      console.error("[digest-subscribe] confirmation email error:", err),
    )
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS })
}
