const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const postgres = require('postgres');

async function run() {
  const sql = postgres(process.env.DATABASE_URL);
  try {
    await sql`ALTER TABLE participants ADD COLUMN IF NOT EXISTS last_read_at timestamp NOT NULL DEFAULT NOW();`;
    console.log("Success");
  } catch (err) {
    console.error(err);
  } finally {
    await sql.end();
  }
}
run();
