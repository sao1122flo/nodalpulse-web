import postgres from "postgres"
const sql = postgres(process.env.DATABASE_URL, { ssl: "require" })
const rows = await sql`SELECT id, email FROM users LIMIT 5`
console.log(JSON.stringify(rows, null, 2))
await sql.end()
