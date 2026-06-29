import "server-only"
import { db } from "@/db/client"
import { extractionFeedback } from "@/db/schema"
import { and, eq } from "drizzle-orm"
import type { FeedbackItemType } from "./ref"

// item_refs the user has already flagged for a given type — used to render the
// "reported" marker on items that stay visible (deadlines/facts). Returns a
// plain string[] so it serializes across the server/client boundary.
export async function getReportedRefs(
  userId: string,
  itemType: FeedbackItemType,
): Promise<string[]> {
  try {
    const rows = await db
      .select({ ref: extractionFeedback.itemRef })
      .from(extractionFeedback)
      .where(and(eq(extractionFeedback.userId, userId), eq(extractionFeedback.itemType, itemType)))
    return rows.map(r => r.ref)
  } catch {
    return []
  }
}
