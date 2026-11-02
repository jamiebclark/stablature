/**
 * Applies pending migrations, then exits. Run on container boot so deploying
 * a new image to Unraid never needs a manual migration step.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.STABLATURE_DATABASE_URL;
if (!url) {
  console.error("STABLATURE_DATABASE_URL is not set");
  process.exit(1);
}

// max: 1 because migrations must run on a single connection, in order.
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("migrations up to date");
} catch (error) {
  console.error("migration failed:", error);
  process.exit(1);
} finally {
  await sql.end();
}
