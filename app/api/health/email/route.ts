import { NextRequest, NextResponse } from "next/server"
import { sendTestEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  const { to } = await req.json()
  if (!to) return NextResponse.json({ error: "Missing `to`" }, { status: 400 })

  try {
    const result = await sendTestEmail(to)
    return NextResponse.json({ ok: true, id: result.data?.id })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
