require("dotenv").config({ path: ".env" });

import { db } from "../db/index";
import { sql } from "drizzle-orm";

async function main() {
  try {
    console.log("Altering table users...");
    await db.execute(sql`ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;`);
    await db.execute(sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_unique;`);
    await db.execute(sql`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_phone_key;`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;`);
    console.log("Successfully altered users table.");
  } catch (error) {
    console.error(error);
  } finally {
    process.exit(0);
  }
}
main();
