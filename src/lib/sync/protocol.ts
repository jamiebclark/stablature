/**
 * The sync wire format.
 *
 * Shared by the client and the route handlers, and validated on the server
 * because every byte here arrives from a browser. The schemas are strict on
 * purpose: a row is written straight into Postgres after merging, so a bad
 * `fieldClocks` entry or an out-of-range fret is not something to find out
 * about later.
 *
 * The protocol is deliberately dull -- push a batch of whole rows, pull
 * everything above a cursor. It can afford to be, because merging is
 * commutative and idempotent (see merge.ts), so neither side has to care about
 * ordering or delivery guarantees.
 */

import { z } from "zod";
import { GROUP_KINDS, MAX_TUPLET_COLUMNS, MIN_GROUP_COLUMNS, SYNCED_TABLES } from "../model";

/** Fixed-width HLC: 15 digits, 4 hex, node id. See hlc.ts. */
const hlc = z.string().regex(/^\d{15}:[0-9a-f]{4}:[0-9a-z]{1,32}$/, "malformed HLC");

const id = z.string().uuid();
const rank = z.string().min(1).max(400);
const shortText = z.string().max(200);
const longText = z.string().max(20_000);

/**
 * Per-field clocks. Unknown field names are allowed through validation and
 * then ignored by the merge, so a client running newer code cannot be rejected
 * outright by an older server.
 */
const fieldClocks = z.record(z.string().max(64), hlc);

const syncMeta = {
  updatedAt: hlc,
  deletedAt: hlc.nullable(),
  fieldClocks,
  // Advisory on the way in: the server always assigns its own.
  serverSeq: z.number().int().nonnegative(),
};

const note = z.object({
  note: z.string().regex(/^[A-G][#b]{0,2}$/),
  octave: z.number().int().min(-1).max(9),
});

/** A fret, or a dead note. 36 is well past any real instrument. */
const fretValue = z.union([z.number().int().min(0).max(36), z.literal("x")]);

const stringIndexKey = z.string().regex(/^\d{1,2}$/);

export const bandRowSchema = z.object({
  id,
  name: shortText.min(1),
  slug: z.string().min(1).max(64),
  ...syncMeta,
});

export const tuningRowSchema = z.object({
  id,
  bandId: id,
  name: shortText.min(1),
  strings: z.array(note).min(1).max(12),
  isDefault: z.boolean(),
  ...syncMeta,
});

export const songRowSchema = z.object({
  id,
  bandId: id,
  title: shortText.min(1),
  tuningId: id.nullable(),
  bpm: z.number().int().min(1).max(999).nullable(),
  notes: longText.nullable(),
  ...syncMeta,
});

export const partRowSchema = z.object({
  id,
  bandId: id,
  songId: id,
  label: z.string().min(1).max(16),
  name: shortText.nullable(),
  rank,
  variantOfPartId: id.nullable(),
  notes: longText.nullable(),
  ...syncMeta,
});

export const eventRowSchema = z.object({
  id,
  bandId: id,
  partId: id,
  rank,
  kind: z.enum(["notes", "barline", "rest"]),
  frets: z.record(stringIndexKey, fretValue),
  techniques: z.record(stringIndexKey, z.array(z.string().max(32)).max(8)),
  // Capped so one row cannot be made to expand into a million columns and
  // wedge every client that renders it.
  repeat: z.number().int().min(1).max(512),
  durationHint: z.enum(["w", "h", "q", "8", "16", "32"]).nullable(),
  tupletId: id.nullable(),
  tupletCount: z.number().int().min(MIN_GROUP_COLUMNS).max(MAX_TUPLET_COLUMNS).nullable(),
  groupKind: z.enum(GROUP_KINDS).nullable().optional(),
  ...syncMeta,
});

export const annotationRowSchema = z.object({
  id,
  bandId: id,
  partId: id,
  anchorEventId: id.nullable(),
  kind: z.enum(["chord", "text", "dynamic"]),
  value: shortText,
  ...syncMeta,
});

export const arrangementEntryRowSchema = z.object({
  id,
  bandId: id,
  songId: id,
  rank,
  kind: z.enum(["part", "section_start", "section_end", "text"]),
  partId: id.nullable(),
  repeat: z.number().int().min(1).max(512),
  fromBar: z.number().int().min(1).max(9999).nullable(),
  toBar: z.number().int().min(1).max(9999).nullable(),
  lastRepeatPartId: id.nullable(),
  label: shortText.nullable(),
  ...syncMeta,
});

export const ROW_SCHEMAS = {
  bands: bandRowSchema,
  tunings: tuningRowSchema,
  songs: songRowSchema,
  parts: partRowSchema,
  events: eventRowSchema,
  annotations: annotationRowSchema,
  arrangementEntries: arrangementEntryRowSchema,
} as const;

export const mutationSchema = z.discriminatedUnion("table", [
  z.object({ table: z.literal("bands"), row: bandRowSchema }),
  z.object({ table: z.literal("tunings"), row: tuningRowSchema }),
  z.object({ table: z.literal("songs"), row: songRowSchema }),
  z.object({ table: z.literal("parts"), row: partRowSchema }),
  z.object({ table: z.literal("events"), row: eventRowSchema }),
  z.object({ table: z.literal("annotations"), row: annotationRowSchema }),
  z.object({ table: z.literal("arrangementEntries"), row: arrangementEntryRowSchema }),
]);

export type Mutation = z.infer<typeof mutationSchema>;

/** One push. Batched so a long offline session drains in a few round trips. */
export const pushRequestSchema = z.object({
  mutations: z.array(mutationSchema).min(1).max(500),
});

export type PushRequest = z.infer<typeof pushRequestSchema>;

/**
 * A mutation the server declined.
 *
 * Reported rather than silently dropped so the client can stop retrying it
 * forever and tell the user something true.
 */
export interface PushRejection {
  table: string;
  id: string;
  reason: "not_a_member" | "read_only" | "unknown_band" | "invalid";
  message: string;
}

export interface PushResponse {
  /** Authoritative merged rows, so the client can skip a pull round trip. */
  rows: PulledRows;
  rejected: PushRejection[];
  cursor: number;
}

export const pullQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
});

export type PulledRows = {
  [K in (typeof SYNCED_TABLES)[number]]?: unknown[];
};

export interface PullResponse {
  rows: PulledRows;
  /** Highest serverSeq included. Pass it back as `since` next time. */
  cursor: number;
  /** True when the limit was hit and another pull should follow immediately. */
  hasMore: boolean;
  /**
   * Every band the user can currently see.
   *
   * The client needs this because the cursor is global: when you are added to
   * an existing band, all of its rows already sit *below* your cursor and
   * would never arrive. Spotting a band you have not seen before is the signal
   * to reset the cursor and pull that history.
   */
  bandIds: string[];
}

/** Server-sent event telling a client that something it can see has changed. */
export interface SyncEvent {
  type: "changed";
  cursor: number;
}
