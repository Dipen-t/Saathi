import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });

import { sql } from "drizzle-orm";

async function main() {
  // Import db dynamically so dotenv runs first
  const { db } = await import("../db/index");
  try {
    console.log("Enabling Realtime for messages table...");
    await db.execute(sql`ALTER PUBLICATION supabase_realtime ADD TABLE messages;`);
    console.log("Successfully enabled Realtime for messages.");
  } catch (error) {
    console.error("Error (might already be added):", error);
  } finally {
    process.exit(0);
  }
}

main();
