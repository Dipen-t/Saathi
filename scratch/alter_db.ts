import * as dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
import { db } from "../db/index";
import { sql } from "drizzle-orm";

async function run() {
  await db.execute(sql`ALTER TABLE participants ADD COLUMN IF NOT EXISTS last_read_at timestamp NOT NULL DEFAULT NOW();`);
  console.log("Success");
  process.exit(0);
}
run();
