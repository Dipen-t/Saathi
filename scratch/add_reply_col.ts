import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { sql } from "drizzle-orm";

async function main() {
  const { db } = await import("../db/index");
  try {
    console.log("Adding reply_to_id column to messages table...");
    await db.execute(sql`ALTER TABLE messages ADD COLUMN reply_to_id integer REFERENCES messages(id);`);
    console.log("Successfully added reply_to_id column.");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

main();
