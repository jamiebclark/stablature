/**
 * Canonical row shapes, shared by the IndexedDB mirror, the sync protocol and
 * the UI.
 *
 * These are declared here rather than inferred from the Drizzle schema so that
 * client code never has to import Drizzle. The two are kept honest by
 * src/db/schema/assert-model.ts, which fails to compile if the SQL schema
 * drifts away from these types.
 */

import type { Hlc } from "./hlc";
import type { Note } from "./pitch";
import type { Rank } from "./rank";

/** One HLC per mergeable field. Absent means "never written on this replica". */
export type FieldClocks = Record<string, Hlc>;

/** Metadata every synced row carries. See src/db/schema/domain.ts for why. */
export interface SyncMeta {
  /**
   * Max of every field clock -- the row's "last touched", used for display and
   * for cheap staleness checks. NOT what merging compares; see fieldClocks.
   */
  updatedAt: Hlc;
  /** HLC tombstone. Non-null means deleted; rows are never removed. */
  deletedAt: Hlc | null;
  /**
   * Per-field HLCs, which is what makes merging actually field-level.
   *
   * A single row-level clock cannot do this: if one person edits a song's
   * title offline and another sets its BPM, whichever patch the server applies
   * second would be rejected wholesale for being "older", silently losing an
   * edit that never conflicted. Clocking each field independently makes the
   * two patches commute, so both survive and only genuine same-field conflicts
   * fall back to last-write-wins.
   */
  fieldClocks: FieldClocks;
  /** Server-assigned cursor. 0 locally until the row has been pushed. */
  serverSeq: number;
}

/** A fret number, or a dead/muted note -- which this music uses constantly. */
export type FretValue = number | "x";

/**
 * One tab column, keyed by string index as a string (0 = highest string).
 * String keys because that is what JSON round-trips to; use `fretAt` rather
 * than indexing with a number.
 */
export type FretMap = Record<string, FretValue>;

export type Technique =
  | "palm_mute"
  | "dead_note"
  | "slide_up"
  | "slide_down"
  | "hammer_on"
  | "pull_off"
  | "bend"
  | "harmonic"
  | "vibrato"
  | "tap"
  | "let_ring";

/** Per-string articulations, e.g. { "3": ["palm_mute"] }. */
export type TechniqueMap = Record<string, Technique[]>;

export type EventKind = "notes" | "barline" | "rest";

/** Advisory rhythm. Null is valid and is the common case during fast capture. */
export type DurationHint = "w" | "h" | "q" | "8" | "16" | "32";

export type AnnotationKind = "chord" | "text" | "dynamic";

export type ArrangementEntryKind = "part" | "section_start" | "section_end" | "text";

export type BandRole = "owner" | "editor" | "viewer";

export interface BandRow extends SyncMeta {
  id: string;
  name: string;
  slug: string;
}

export interface TuningRow extends SyncMeta {
  id: string;
  bandId: string;
  name: string;
  /** Highest-pitched string first. The length is the string count. */
  strings: Note[];
  isDefault: boolean;
}

export interface SongRow extends SyncMeta {
  id: string;
  bandId: string;
  title: string;
  /** Null falls back to the band's default tuning. */
  tuningId: string | null;
  bpm: number | null;
  notes: string | null;
}

export interface PartRow extends SyncMeta {
  id: string;
  bandId: string;
  songId: string;
  /** The letter the band calls it: A, B, C. */
  label: string;
  name: string | null;
  rank: Rank;
  /** Set when this part is a variant of another -- "A with a flourish". */
  variantOfPartId: string | null;
  notes: string | null;
}

export interface EventRow extends SyncMeta {
  id: string;
  bandId: string;
  partId: string;
  rank: Rank;
  kind: EventKind;
  frets: FretMap;
  techniques: TechniqueMap;
  /** Identical hits stored compressed: eight of the same note is repeat = 8. */
  repeat: number;
  durationHint: DurationHint | null;
  /** Shared across every event in one tuplet; null means not in a tuplet. */
  tupletId: string | null;
  /** 3 for a triplet, 5 for a quintuplet. */
  tupletCount: number | null;
}

export interface AnnotationRow extends SyncMeta {
  id: string;
  bandId: string;
  partId: string;
  anchorEventId: string | null;
  kind: AnnotationKind;
  value: string;
}

export interface ArrangementEntryRow extends SyncMeta {
  id: string;
  bandId: string;
  songId: string;
  rank: Rank;
  kind: ArrangementEntryKind;
  partId: string | null;
  repeat: number;
  /** 1-indexed bar range for "C, first half". Null means the whole part. */
  fromBar: number | null;
  toBar: number | null;
  /** Variant for the final pass: "A x4, flourish on the 4th". */
  lastRepeatPartId: string | null;
  label: string | null;
}

/** Every synced table, keyed by the name used in the sync protocol. */
export interface SyncedRows {
  bands: BandRow;
  tunings: TuningRow;
  songs: SongRow;
  parts: PartRow;
  events: EventRow;
  annotations: AnnotationRow;
  arrangementEntries: ArrangementEntryRow;
}

export type SyncedTable = keyof SyncedRows;
export type SyncedRow = SyncedRows[SyncedTable];

/**
 * Topological order. Push applies mutations in this sequence so a batch
 * containing a parent and its children satisfies foreign keys regardless of
 * the order the client queued them.
 */
export const SYNCED_TABLES = [
  "bands",
  "tunings",
  "songs",
  "parts",
  "events",
  "annotations",
  "arrangementEntries",
] as const satisfies readonly SyncedTable[];

/**
 * Fields that participate in merging, per table.
 *
 * Everything omitted is structural and set once at creation (`id`, `bandId`,
 * and parent keys like `songId`/`partId`). Treating those as immutable is what
 * lets a merge be a pure field-wise comparison -- a row never changes which
 * song or part it belongs to, so there is nothing to disagree about.
 *
 * `deletedAt` is listed as an ordinary field so a delete is just another
 * clocked write, which means an undelete works too.
 */
export const MERGEABLE_FIELDS = {
  bands: ["name", "slug", "deletedAt"],
  tunings: ["name", "strings", "isDefault", "deletedAt"],
  songs: ["title", "tuningId", "bpm", "notes", "deletedAt"],
  parts: ["label", "name", "rank", "variantOfPartId", "notes", "deletedAt"],
  events: [
    "rank",
    "kind",
    "frets",
    "techniques",
    "repeat",
    "durationHint",
    "tupletId",
    "tupletCount",
    "deletedAt",
  ],
  annotations: ["anchorEventId", "kind", "value", "deletedAt"],
  arrangementEntries: [
    "rank",
    "kind",
    "partId",
    "repeat",
    "fromBar",
    "toBar",
    "lastRepeatPartId",
    "label",
    "deletedAt",
  ],
} as const satisfies { [K in SyncedTable]: readonly (keyof SyncedRows[K])[] };

export type MergeableField<K extends SyncedTable> = (typeof MERGEABLE_FIELDS)[K][number];

/** Read a string's fret out of a column, handling the string-keyed map. */
export function fretAt(frets: FretMap, stringIndex: number): FretValue | undefined {
  return frets[String(stringIndex)];
}

/** True when a column has nothing on any string. */
export function isEmptyColumn(frets: FretMap): boolean {
  return Object.keys(frets).length === 0;
}

/** Live rows only. Tombstones stay in the store but never reach the UI. */
export function isLive<T extends SyncMeta>(row: T): boolean {
  return row.deletedAt === null;
}
