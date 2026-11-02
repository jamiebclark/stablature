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
import type {
  AnnotationRow,
  ArrangementEntryRow,
  BandRow,
  EventRow,
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

export class StablatureDb extends Dexie {
  bands!: Table<BandRow, string>;
  tunings!: Table<TuningRow, string>;
  songs!: Table<SongRow, string>;
  parts!: Table<PartRow, string>;
  events!: Table<EventRow, string>;
  annotations!: Table<AnnotationRow, string>;
  arrangementEntries!: Table<ArrangementEntryRow, string>;
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
