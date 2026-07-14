// Root OAuth Authorization Server discovery (RFC 8414). MCP clients probe the
// SITE ROOT for this — better-auth serves the plugin's own copy under /api/auth,
// but Claude/ChatGPT look here. Must be reachable with NO cookie (see middleware).
import { auth } from "@/lib/auth"
import { oAuthDiscoveryMetadata } from "better-auth/plugins"

export const GET = oAuthDiscoveryMetadata(auth)
