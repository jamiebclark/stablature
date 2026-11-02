/**
 * Ids are minted on the client, never by the database.
 *
 * That is what lets capture work offline: a new part gets a real, permanent id
 * the instant it is tapped into existence, so everything that references it
 * (events, annotations, arrangement entries) can be written immediately
 * without waiting to hear back from a server that may be unreachable.
 *
 * UUIDv7 rather than v4 because the first 48 bits are a timestamp, so ids sort
 * roughly by creation time. That keeps Postgres index inserts local to the end
 * of the btree instead of scattering them, and makes raw rows readable when
 * debugging a sync problem.
 */

import { uuidv7 } from "uuidv7";

export function newId(): string {
  return uuidv7();
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards the sync endpoints: ids arrive from clients and are used in queries. */
export function isValidId(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
