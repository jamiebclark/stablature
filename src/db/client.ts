/**
 * Postgres connection.
 *
 * Only ever imported from server code -- route handlers and the auth config.
 * Nothing in the UI reads from here; screens read the local IndexedDB mirror,
 * which is what makes them work offline.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

function connectionString(): string {
  const url = process.env.STABLATURE_DATABASE_URL;
  if (!url) {
    throw new Error("STABLATURE_DATABASE_URL is not set. Copy .env.example to .env.local.");
  }
  return url;
}

/**
 * Reused across hot reloads in dev. Without this, every edit opens a new pool
 * and Postgres runs out of connections within a few minutes of editing.
 */
const globalForDb = globalThis as unknown as {
  stablatureSql?: ReturnType<typeof postgres>;
};

const sql = globalForDb.stablatureSql ?? postgres(connectionString(), { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.stablatureSql = sql;
}

export const db = drizzle(sql, { schema });
export { schema, sql };
