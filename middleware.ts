import { NextRequest, NextResponse } from "next/server"

const PUBLIC = ["/login", "/api/auth", "/api/stripe-webhook", "/_next", "/favicon.ico"]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()

  const session =
    req.cookies.get("__Secure-better-auth.session_token") ??
    req.cookies.get("better-auth.session_token")
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|public/).*)"],
}
