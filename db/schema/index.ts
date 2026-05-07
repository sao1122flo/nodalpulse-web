import { pgTable, uuid, timestamp } from "drizzle-orm/pg-core"

export const healthChecks = pgTable("health_checks", {
  id: uuid("id").defaultRandom().primaryKey(),
  checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow().notNull(),
})
