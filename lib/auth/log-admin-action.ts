import "server-only"
import { createHash } from "crypto"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { db } from "@/db/client"
import { adminActions } from "@/db/schema"

interface LogAdminActionArgs {
  action: string
  targetType?: string
  targetId?: string
  metadata?: Record<string, unknown>
}

export async function logAdminAction({
  action,
  targetType,
  targetId,
  metadata,
}: LogAdminActionArgs): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() })
  const email = session?.user?.email ?? "unknown"
  const actorEmailHash = createHash("sha256").update(email).digest("hex")

  await db.insert(adminActions).values({
    actorEmailHash,
    action,
    targetType: targetType ?? null,
    targetId: targetId ?? null,
    metadata: metadata ?? {},
  })
}
