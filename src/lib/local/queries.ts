/**
 * Reads against the local mirror.
 *
 * Kept as plain async functions rather than hooks so they can be tested in
 * node and reused outside React (the sync worker reads through these too). The
 * hooks in hooks.ts are thin wrappers that make them reactive.
 *
 * Two rules every query here follows:
 *  - tombstoned rows never escape to callers, and
 *  - anything ordered is sorted in JS by rank, not by an IndexedDB index,
 *    because fractional ranks need codepoint comparison.
 */

import { isLive, type SyncMeta } from "../model";
import { sortByRank } from "../rank";
import type {
  AnnotationRow,
  ArrangementEntryRow,
  BandRow,
  EventRow,
  PartRow,
  SongRow,
  TuningRow,
} from "../model";
import { db as defaultDb, type StablatureDb } from "./db";

function live<T extends SyncMeta>(rows: T[]): T[] {
  return rows.filter(isLive);
}

export async function listBands(database: StablatureDb = defaultDb): Promise<BandRow[]> {
  const rows = live(await database.bands.toArray());
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getBand(
  bandId: string,
  database: StablatureDb = defaultDb,
): Promise<BandRow | undefined> {
  const row = await database.bands.get(bandId);
  return row && isLive(row) ? row : undefined;
}

export async function getBandBySlug(
  slug: string,
  database: StablatureDb = defaultDb,
): Promise<BandRow | undefined> {
  const rows = live(await database.bands.where("slug").equals(slug).toArray());
  return rows[0];
}

export async function listSongs(
  bandId: string,
  database: StablatureDb = defaultDb,
): Promise<SongRow[]> {
  const rows = live(await database.songs.where("bandId").equals(bandId).toArray());
  return rows.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getSong(
  songId: string,
  database: StablatureDb = defaultDb,
): Promise<SongRow | undefined> {
  const row = await database.songs.get(songId);
  return row && isLive(row) ? row : undefined;
}

export async function listTunings(
  bandId: string,
  database: StablatureDb = defaultDb,
): Promise<TuningRow[]> {
  const rows = live(await database.tunings.where("bandId").equals(bandId).toArray());
  // Default first, then alphabetical: the picker should open on the tuning the
  // band actually plays in.
  return rows.sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * The tuning a song is actually in: its own, else the band's default.
 *
 * Songs store a null tuningId to mean "whatever the band plays in", so that
 * retuning a band does not require touching every song.
 */
export async function resolveTuning(
  song: Pick<SongRow, "bandId" | "tuningId">,
  database: StablatureDb = defaultDb,
): Promise<TuningRow | undefined> {
  if (song.tuningId) {
    const explicit = await database.tunings.get(song.tuningId);
    if (explicit && isLive(explicit)) return explicit;
  }
  const forBand = await listTunings(song.bandId, database);
  return forBand.find((t) => t.isDefault) ?? forBand[0];
}

export async function listParts(
  songId: string,
  database: StablatureDb = defaultDb,
): Promise<PartRow[]> {
  return sortByRank(live(await database.parts.where("songId").equals(songId).toArray()));
}

export async function getPart(
  partId: string,
  database: StablatureDb = defaultDb,
): Promise<PartRow | undefined> {
  const row = await database.parts.get(partId);
  return row && isLive(row) ? row : undefined;
}

/** A part's columns, in playing order. */
export async function listEvents(
  partId: string,
  database: StablatureDb = defaultDb,
): Promise<EventRow[]> {
  return sortByRank(live(await database.events.where("partId").equals(partId).toArray()));
}

export async function listAnnotations(
  partId: string,
  database: StablatureDb = defaultDb,
): Promise<AnnotationRow[]> {
  return live(await database.annotations.where("partId").equals(partId).toArray());
}

export async function listArrangement(
  songId: string,
  database: StablatureDb = defaultDb,
): Promise<ArrangementEntryRow[]> {
  return sortByRank(
    live(await database.arrangementEntries.where("songId").equals(songId).toArray()),
  );
}

/** Variants of a part -- "A with a flourish" -- offered when building a repeat. */
export async function listVariants(
  partId: string,
  songId: string,
  database: StablatureDb = defaultDb,
): Promise<PartRow[]> {
  const siblings = await listParts(songId, database);
  return siblings.filter((p) => p.variantOfPartId === partId);
}

/** How many local writes are still waiting to be pushed. */
export async function pendingWriteCount(database: StablatureDb = defaultDb): Promise<number> {
  return database.outbox.count();
}
