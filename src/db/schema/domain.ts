/**
 * Domain schema.
 *
 * Postgres is a sync target, not the source of truth the UI reads from. Every
 * table here is therefore shaped for merging rather than for querying:
 *
 *  - `id` is a client-minted UUIDv7, so offline inserts never collide.
 *  - `rank` is a fractional index string, so offline reorders never collide.
 *    Any ORDER BY on it MUST say COLLATE "C" -- see src/lib/rank.ts.
 *  - `updatedAt` / `deletedAt` are HLC strings, not timestamps. Merges keep the
 *    larger value. Deletes are tombstones, because a hard delete cannot merge
 *    against a concurrent edit.
 *  - `bandId` is denormalised onto every row so authorisation and the pull
 *    query are each a single predicate rather than a chain of joins.
 *  - `serverSeq` comes from one shared sequence, giving pull a single
 *    monotonic cursor across every table.
 *
 * Foreign keys are kept (they catch real bugs) and remain safe despite offline
 * inserts because push applies mutations in a fixed topological table order,
 * and within a table in id order -- which, UUIDv7 being time-sortable, is
 * creation order.
 */

import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { FieldClocks, FretMap, TechniqueMap } from "@/lib/model";
import type { Note } from "@/lib/pitch";
import { user } from "./auth";

/** One sequence for the whole database, so `pull?since=N` is a single cursor. */
export const globalSeq = pgSequence("global_seq", { startWith: 1, increment: 1 });

export const bandRole = pgEnum("band_role", ["owner", "editor", "viewer"]);

/** Tab columns. Most are `notes`; barlines are explicit, never computed. */
export const eventKind = pgEnum("event_kind", ["notes", "barline", "rest"]);

/**
 * Optional, advisory rhythm. The model is positional -- a column with no hint
 * is perfectly valid and is the common case during fast capture. Hints exist
 * so a part can be made precise later without migrating anything.
 */
export const durationHint = pgEnum("duration_hint", ["w", "h", "q", "8", "16", "32"]);

export const annotationKind = pgEnum("annotation_kind", ["chord", "text", "dynamic"]);

/**
 * Arrangement entries are a flat list with explicit section markers rather
 * than a tree, which keeps fractional ranks and row-level merging applicable
 * to the arrangement itself.
 */
export const arrangementEntryKind = pgEnum("arrangement_entry_kind", [
  "part",
  "section_start",
  "section_end",
  "text",
]);

/** Columns every synced row carries. Spread into each table below. */
const sync = {
  /** Max of every field clock: the row's "last touched". Not used for merging. */
  updatedAt: text("updated_at").notNull(),
  /** HLC tombstone. Non-null means deleted. */
  deletedAt: text("deleted_at"),
  /**
   * One HLC per mergeable field, which is what makes merging field-level
   * rather than row-level. See the SyncMeta docs in src/lib/model.ts for why a
   * single row clock silently loses non-conflicting concurrent edits.
   */
  fieldClocks: jsonb("field_clocks").$type<FieldClocks>().notNull().default({}),
  serverSeq: bigint("server_seq", { mode: "number" }).notNull(),
};

export const bands = pgTable(
  "bands",
  {
    id: uuid("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    ...sync,
  },
  (t) => [uniqueIndex("bands_slug_idx").on(t.slug), index("bands_seq_idx").on(t.serverSeq)],
);

/**
 * Membership is an authorisation fact the server owns, not a mergeable row, so
 * it deliberately has no bandId/HLC/serverSeq columns.
 */
export const bandMembers = pgTable(
  "band_members",
  {
    id: uuid("id").primaryKey(),
    bandId: uuid("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: bandRole("role").notNull().default("editor"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("band_members_unique_idx").on(t.bandId, t.userId),
    index("band_members_user_idx").on(t.userId),
  ],
);

/**
 * Invites, so a bandmate can join without the owner knowing their email.
 *
 * Multi-use until revoked or expired, rather than one-shot: the realistic
 * gesture is pasting one link into the band chat, not minting four codes.
 * Server-owned like membership, so no HLC or sync columns.
 */
export const bandInvites = pgTable(
  "band_invites",
  {
    id: uuid("id").primaryKey(),
    bandId: uuid("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    /** Short, unguessable, and safe to read aloud. */
    code: text("code").notNull(),
    /** Role granted on acceptance. Lets you invite someone read-only. */
    role: bandRole("role").notNull().default("editor"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("band_invites_code_idx").on(t.code),
    index("band_invites_band_idx").on(t.bandId),
  ],
);

export const tunings = pgTable(
  "tunings",
  {
    id: uuid("id").primaryKey(),
    bandId: uuid("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Highest-pitched string first -- see src/lib/tunings.ts for why. */
    strings: jsonb("strings").$type<Note[]>().notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    ...sync,
  },
  (t) => [index("tunings_band_idx").on(t.bandId), index("tunings_seq_idx").on(t.serverSeq)],
);

export const songs = pgTable(
  "songs",
  {
    id: uuid("id").primaryKey(),
    bandId: uuid("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    /** Null falls back to the band's default tuning. */
    tuningId: uuid("tuning_id").references(() => tunings.id, { onDelete: "set null" }),
    bpm: integer("bpm"),
    notes: text("notes"),
    ...sync,
  },
  (t) => [index("songs_band_idx").on(t.bandId), index("songs_seq_idx").on(t.serverSeq)],
);

export const parts = pgTable(
  "parts",
  {
    id: uuid("id").primaryKey(),
    bandId: uuid("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    /** The letter the band calls it: A, B, C. */
    label: text("label").notNull(),
    /** Optional human name, e.g. "main riff". */
    name: text("name"),
    rank: text("rank").notNull(),
    /**
     * Set when this part is a variant of another -- A with a flourish. The
     * arrangement references it as the final pass of a repeat, which is how
     * "A x4, flourish on the 4th" is expressed without duplicating the riff.
     */
    variantOfPartId: uuid("variant_of_part_id").references((): AnyPgColumn => parts.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    ...sync,
  },
  (t) => [
    index("parts_song_idx").on(t.songId),
    index("parts_band_idx").on(t.bandId),
    index("parts_seq_idx").on(t.serverSeq),
  ],
);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey(),
    bandId: uuid("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    partId: uuid("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    rank: text("rank").notNull(),
    kind: eventKind("kind").notNull().default("notes"),
    /**
     * One column of tab, keyed by string index (0 = highest string). A chord
     * is several entries in one event. "x" is a dead/muted note, which this
     * music uses constantly.
     */
    frets: jsonb("frets").$type<FretMap>().notNull().default({}),
    /** Per-string articulations, e.g. { "3": ["palm_mute", "slide"] }. */
    techniques: jsonb("techniques").$type<TechniqueMap>().notNull().default({}),
    /**
     * Stored rather than expanded: eight identical hits are one row with
     * repeat = 8. That is the common case here, and it is what lets the
     * compact view render "-7x8-" without re-parsing anything.
     */
    repeat: integer("repeat").notNull().default(1),
    durationHint: durationHint("duration_hint"),
    /** Shared by every event in one tuplet; null means not in a tuplet. */
    tupletId: uuid("tuplet_id"),
    /** 3 for a triplet, 5 for a quintuplet. */
    tupletCount: integer("tuplet_count"),
    ...sync,
  },
  (t) => [
    index("events_part_idx").on(t.partId),
    index("events_band_idx").on(t.bandId),
    index("events_seq_idx").on(t.serverSeq),
  ],
);

/** Chord symbols and text above the staff -- "what notes are available here". */
export const annotations = pgTable(
  "annotations",
  {
    id: uuid("id").primaryKey(),
    bandId: uuid("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    partId: uuid("part_id")
      .notNull()
      .references(() => parts.id, { onDelete: "cascade" }),
    /** Anchored to a column, so it survives edits either side of it. */
    anchorEventId: uuid("anchor_event_id").references(() => events.id, { onDelete: "cascade" }),
    kind: annotationKind("kind").notNull().default("chord"),
    value: text("value").notNull(),
    ...sync,
  },
  (t) => [
    index("annotations_part_idx").on(t.partId),
    index("annotations_band_idx").on(t.bandId),
    index("annotations_seq_idx").on(t.serverSeq),
  ],
);

export const arrangementEntries = pgTable(
  "arrangement_entries",
  {
    id: uuid("id").primaryKey(),
    bandId: uuid("band_id")
      .notNull()
      .references(() => bands.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    rank: text("rank").notNull(),
    kind: arrangementEntryKind("kind").notNull().default("part"),
    /** Set when kind is "part". */
    partId: uuid("part_id").references(() => parts.id, { onDelete: "cascade" }),
    /** Pass count for a part, or for everything inside a section. */
    repeat: integer("repeat").notNull().default(1),
    /**
     * Play only some of a part -- "C, first half". 1-indexed bar numbers
     * counted from the part's explicit barline events; null means the whole
     * part. Bars rather than event ids, so the reference survives editing the
     * notes inside a bar.
     */
    fromBar: integer("from_bar"),
    toBar: integer("to_bar"),
    /** Swap in a variant for the final pass: "A x4, flourish on the 4th". */
    lastRepeatPartId: uuid("last_repeat_part_id").references((): AnyPgColumn => parts.id, {
      onDelete: "set null",
    }),
    /** Section name, or the body of a "text" entry. */
    label: text("label"),
    ...sync,
  },
  (t) => [
    index("arrangement_song_idx").on(t.songId),
    index("arrangement_band_idx").on(t.bandId),
    index("arrangement_seq_idx").on(t.serverSeq),
  ],
);

/**
 * Push applies mutations in this order so a batch containing a parent and its
 * children satisfies foreign keys regardless of the order the client queued
 * them. Pull uses it too, so a client never briefly sees an orphan.
 */
export const SYNC_TABLE_ORDER = [
  "bands",
  "tunings",
  "songs",
  "parts",
  "events",
  "annotations",
  "arrangementEntries",
] as const;

export type SyncTableName = (typeof SYNC_TABLE_ORDER)[number];
