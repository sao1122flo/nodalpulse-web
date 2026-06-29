import { NextRequest, NextResponse } from "next/server"

const PUBLIC = ["/login", "/api/auth", "/api/health", "/api/stripe-webhook", "/_next", "/favicon.ico"]

// Static assets (by extension) must never bounce to /login. Browsers fetch the
// manifest + icons WITHOUT credentials, so they always look unauthenticated —
// redirecting them made the browser parse HTML as a manifest ("Manifest: Syntax
// error") on every render, and PWA icons (served from /public at the root path)
// 307'd too. Matching by extension keeps auth on every real page — including
// dotted docket IDs, which never end in one of these — while letting assets pass.
// (robots.txt / sitemap.xml are deliberately NOT included — they're crawler
// routes, not page assets, and have their own handling.)
const STATIC_ASSET =
  /\.(?:png|jpe?g|gif|svg|ico|webmanifest|webp|avif|woff2?|ttf|otf|eot|map)$/i

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (STATIC_ASSET.test(pathname)) return NextResponse.next()
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
