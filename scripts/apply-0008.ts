import { db } from "@/db/client"
import { sql } from "drizzle-orm"
import fs from "fs"
import path from "path"

async function main() {
  const sqlFile = path.join(__dirname, "../drizzle/0008_digest_leads.sql")
  const q = fs.readFileSync(sqlFile, "utf8")
  await db.execute(sql.raw(q))
  console.log("Migration 0008 applied ok")
}

main().catch(err => { console.error(err); process.exit(1) }).then(() => process.exit(0))
