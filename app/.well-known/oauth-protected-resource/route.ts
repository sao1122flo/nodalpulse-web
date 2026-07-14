// Root OAuth Protected-Resource discovery (RFC 9728). Points the client at the
// authorization server for the /api/mcp resource. Must be reachable with NO
// cookie (see middleware bypass).
import { auth } from "@/lib/auth"
import { oAuthProtectedResourceMetadata } from "better-auth/plugins"

export const GET = oAuthProtectedResourceMetadata(auth)
