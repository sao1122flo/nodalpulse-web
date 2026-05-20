import { auth } from "@/lib/auth"
import { NextRequest, NextResponse } from "next/server"

// POST /api/magic-link-confirm
// Receives the magic-link token from the confirm page form and proxies it
// through Better Auth's verify endpoint server-side. This prevents M365 Safe
// Links (and other pre-fetchers) from consuming the token via GET on the email
// link — the token is only consumed when the user explicitly clicks "Sign in".
export async function POST(req: NextRequest) {
  const data = await req.formData()
  const token = data.get("token")?.toString() ?? ""
  const callbackURL = data.get("callbackURL")?.toString() ?? "/dashboard"

  // Reject missing tokens immediately.
  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_link", req.nextUrl.origin))
  }

  // Validate callbackURL: relative paths only.
  const safeCallback =
    callbackURL.startsWith("/") && !callbackURL.includes("//") ? callbackURL : "/dashboard"

  // Reconstruct BA's verify URL. BETTER_AUTH_URL is the configured base, e.g.
  // https://app.nodalpulse.com. auth.handler() matches against this base.
  const baseUrl = process.env.BETTER_AUTH_URL ?? req.nextUrl.origin
  const verifyUrl = new URL(`${baseUrl}/api/auth/magic-link/verify`)
  verifyUrl.searchParams.set("token", token)
  verifyUrl.searchParams.set("callbackURL", safeCallback)

  // Proxy through auth.handler() — consumes the token and creates the session.
  const baReq = new NextRequest(verifyUrl.toString(), { method: "GET" })
  let baRes: Response
  try {
    baRes = await auth.handler(baReq)
  } catch {
    return NextResponse.redirect(new URL("/login?error=sign_in_failed", req.nextUrl.origin))
  }

  // BA returns 302 on success with Set-Cookie (session) and Location headers.
  // On failure (expired / already used) it typically returns 302 to an error path.
  const location = baRes.headers.get("location")

  // If BA redirected to its own error page, send user back to login.
  const isErrorRedirect =
    !location ||
    location.includes("/api/auth/error") ||
    location.includes("error=")

  const destination = isErrorRedirect
    ? new URL("/login?error=expired_link", req.nextUrl.origin).toString()
    : location.startsWith("http")
      ? location
      : new URL(location, req.nextUrl.origin).toString()

  const response = new NextResponse(null, {
    status: 302,
    headers: { location: destination },
  })

  // Forward ALL Set-Cookie headers from BA, preserving cookie attributes
  // (Path, SameSite, Secure, HttpOnly) exactly as BA emits them.
  const cookies = baRes.headers.getSetCookie?.() ?? []
  for (const cookie of cookies) {
    response.headers.append("set-cookie", cookie)
  }

  return response
}
