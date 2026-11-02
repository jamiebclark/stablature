/**
 * Postgres connection.
 *
 * Only ever imported from server code -- route handlers and the auth config.
 * Nothing in the UI reads from here; screens read the local IndexedDB mirror,
 * which is what makes them work offline.
 *
 * The connection is created on first *use*, not on import. Next imports every
 * route module during the build to collect page data, so anything that reaches
 * for a database at module scope makes the build itself require a running
 * Postgres -- which it did, and which broke the container image. Deferring
 * also keeps the clear "you forgot to set the URL" error, instead of trading
 * it for a confusing connection failure later.
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
 * Hands out a stand-in that builds the real object on first property access.
 *
 * A proxy rather than a `getDb()` function because the Better Auth adapter
 * takes the database instance when the config object is constructed, which is
 * itself at module scope -- so there is no call site late enough to defer at.
 */
function lazy<T extends object>(factory: () => T): T {
  let instance: T | undefined;
  const resolve = (): T => (instance ??= factory());

  // The target is an arrow function so the proxy is callable -- the postgres.js
  // client is used as a tagged template -- and because arrow functions have no
  // `prototype`, which would otherwise violate the ownKeys proxy invariant.
  const target = (() => undefined) as unknown as T;

  return new Proxy(target, {
    get(_target, property) {
      const resolved = resolve();
      const value = Reflect.get(resolved as object, property);
      // Bind methods to the real object; passing the proxy as `this` would
      // make internal private-field access throw.
      return typeof value === "function" ? value.bind(resolved) : value;
    },
    has: (_target, property) => Reflect.has(resolve() as object, property),
    ownKeys: () => Reflect.ownKeys(resolve() as object),
    getOwnPropertyDescriptor: (_target, property) => {
      const descriptor = Reflect.getOwnPropertyDescriptor(resolve() as object, property);
      // Proxy invariants require reported properties to be configurable.
      return descriptor ? { ...descriptor, configurable: true } : undefined;
    },
    apply(_target, thisArg, args) {
      return Reflect.apply(resolve() as unknown as (...a: unknown[]) => unknown, thisArg, args);
    },
  });
}

/**
 * Reused across hot reloads in dev. Without this, every edit opens a new pool
 * and Postgres runs out of connections within a few minutes of editing.
 */
const globalForDb = globalThis as unknown as {
  stablatureSql?: ReturnType<typeof postgres>;
};

function createSql(): ReturnType<typeof postgres> {
  const existing = globalForDb.stablatureSql;
  if (existing) return existing;

  const created = postgres(connectionString(), { max: 10 });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.stablatureSql = created;
  }
  return created;
}

/**
 * The postgres.js client. Also used directly for LISTEN/NOTIFY, which Drizzle
 * does not wrap.
 *
 * Callable as a tagged template (`sql\`select 1\``), so the proxy forwards
 * `apply` as well as property access.
 */
export const sql = lazy(createSql);

export const db = lazy(() => drizzle(createSql(), { schema }));

export { schema };
