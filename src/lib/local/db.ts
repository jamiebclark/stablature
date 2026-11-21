/**
 * The local mirror.
 *
 * This is what every screen reads from, which is the single decision that
 * makes the app work at band practice: rendering a song never waits on the
 * network, because the network is not in the read path at all. Postgres is
 * downstream of this store, not upstream of it.
 *
 * Indexes here exist to serve the actual queries -- events by part, parts by
 * song -- and nothing else. Ordering is done in JS by rank, not by an index,
 * because fractional ranks need codepoint comparison and IndexedDB's own
 * ordering is not worth relying on for it.
 */

import Dexie, { type Table } from "dexie";
import type { Hlc } from "../hlc";
import type { RefusalCode } from "../memos/refusals";
import type { EndingKind } from "../memos/words";
import type {
  AnnotationRow,
  ArrangementEntryRow,
  BandRow,
  EventRow,
  MemoRow,
  PartRow,
  SongRow,
  SyncedRow,
  SyncedTable,
  TuningRow,
} from "../model";

/**
 * A local write waiting to be pushed.
 *
 * It holds the full row rather than just the changed fields: the row already
 * carries per-field clocks, so sending the whole thing is self-describing and
 * lets push merge it exactly the way a replica would. It also means a retry
 * can never apply a patch against the wrong base.
 */
export interface OutboxEntry {
  seq?: number;
  table: SyncedTable;
  rowId: string;
  row: SyncedRow;
  /** Clock of the write that produced this entry, for debugging ordering. */
  hlc: Hlc;
  /** Bumped on each failed push, so a poison entry can be spotted. */
  attempts: number;
}

/** Small key/value store for the sync cursor and similar local state. */
export interface MetaEntry {
  key: string;
  value: unknown;
}

/** A clip this device holds. Exists exactly when the device has the bytes. */
export interface MemoAudioEntry {
  memoId: string;
  bytes: ArrayBuffer;
  format: string;
  size: number;
}

/** The upload queue: one entry per memo recorded on this device. */
export interface MemoUploadEntry {
  memoId: string;
  bandId: string;
  /** Network/5xx failures so far. */
  attempts: number;
  /** Ms epoch; 0 means now. */
  nextAt: number;
  refusal: { code: RefusalCode | "unknown_band" | "not_a_member"; message: string } | null;
  /** The user id the refusal was received under. */
  account: string | null;
}

/** This device's fetch state for a memo recorded elsewhere. */
export interface MemoFetchEntry {
  memoId: string;
  status: "waiting" | "failed" | "full" | "erased";
  attempts: number;
  nextAt: number;
}

/** A recording in progress, kept so a crash does not lose it. */
export interface MemoDraft {
  id: string;
  memoId: string;
  partId: string;
  bandId: string;
  songId: string;
  format: string;
  startedAt: number;
}

export interface MemoDraftChunk {
  draftId: string;
  index: number;
  bytes: ArrayBuffer;
}

/** A line shown on a part's card about how a recording ended. */
export interface MemoNotice {
  id: string;
  partId: string;
  kind: EndingKind | "persist" | "saved";
  words: string;
  at: number;
}

export class StablatureDb extends Dexie {
  bands!: Table<BandRow, string>;
  tunings!: Table<TuningRow, string>;
  songs!: Table<SongRow, string>;
  parts!: Table<PartRow, string>;
  events!: Table<EventRow, string>;
  annotations!: Table<AnnotationRow, string>;
  arrangementEntries!: Table<ArrangementEntryRow, string>;
  memos!: Table<MemoRow, string>;
  memoAudio!: Table<MemoAudioEntry, string>;
  memoUploads!: Table<MemoUploadEntry, string>;
  memoFetches!: Table<MemoFetchEntry, string>;
  memoDrafts!: Table<MemoDraft, string>;
  memoDraftChunks!: Table<MemoDraftChunk, [string, number]>;
  outbox!: Table<OutboxEntry, number>;
  meta!: Table<MetaEntry, string>;

  constructor(name = "stablature") {
    super(name);
    this.version(1).stores({
      bands: "id, slug, serverSeq",
      tunings: "id, bandId, serverSeq",
      songs: "id, bandId, serverSeq",
      parts: "id, songId, bandId, serverSeq",
      events: "id, partId, bandId, serverSeq",
      annotations: "id, partId, anchorEventId, bandId, serverSeq",
      arrangementEntries: "id, songId, bandId, serverSeq",
      outbox: "++seq, table, rowId",
      meta: "key",
    });
    // Version 1's stores are untouched, so no existing data moves.
    this.version(2).stores({
      memos: "id, partId, bandId, serverSeq",
      memoAudio: "memoId",
      memoUploads: "memoId",
      memoFetches: "memoId",
      memoDrafts: "id",
      memoDraftChunks: "[draftId+index], draftId",
    });
  }
}

/**
 * Process-wide handle. Constructing a Dexie instance does not touch
 * IndexedDB -- that happens on first query -- so this is safe to evaluate
 * during SSR as long as nothing queries it on the server.
 */
export const db = new StablatureDb();

/** Table handle by sync-protocol name, for code that is generic over tables. */
export function tableFor(name: SyncedTable): Table<never, string> {
  return db[name] as unknown as Table<never, string>;
}

const META_SYNC_CURSOR = "syncCursor";

/** Highest serverSeq this device has pulled. */
export async function getSyncCursor(database: StablatureDb = db): Promise<number> {
  const entry = await database.meta.get(META_SYNC_CURSOR);
  return typeof entry?.value === "number" ? entry.value : 0;
}

export async function setSyncCursor(cursor: number, database: StablatureDb = db): Promise<void> {
  await database.meta.put({ key: META_SYNC_CURSOR, value: cursor });
}
