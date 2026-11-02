import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read .env.local on its own. `override` matters: ambient
// shell variables otherwise win, which is how a migration can silently run
// against a different project's database.
loadEnv({ path: ".env.local", override: true, quiet: true });

const url = process.env.STABLATURE_DATABASE_URL;
if (!url) {
  // No default on purpose. A fallback URL here is how you end up migrating
  // something you did not mean to.
  throw new Error("STABLATURE_DATABASE_URL is not set. Copy .env.example to .env.local.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: { url },
  verbose: true,
  strict: true,
});
