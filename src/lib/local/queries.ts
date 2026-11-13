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
import { countBars } from "../tab/layout";
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

/**
 * Every part's columns for a song, keyed by part id.
 *
 * One query instead of a live query per part: the song view renders a staff
 * for each part and needs bar counts for all of them, and hooks cannot be
 * called in a loop.
 */
export async function listEventsBySong(
  songId: string,
  database: StablatureDb = defaultDb,
): Promise<Record<string, EventRow[]>> {
  const parts = await listParts(songId, database);
  const byPart: Record<string, EventRow[]> = {};
  await Promise.all(
    parts.map(async (part) => {
      byPart[part.id] = await listEvents(part.id, database);
    }),
  );
  return byPart;
}

export async function listAnnotationsBySong(
  songId: string,
  database: StablatureDb = defaultDb,
): Promise<Record<string, AnnotationRow[]>> {
  const parts = await listParts(songId, database);
  const byPart: Record<string, AnnotationRow[]> = {};
  await Promise.all(
    parts.map(async (part) => {
      byPart[part.id] = await listAnnotations(part.id, database);
    }),
  );
  return byPart;
}

/** A song's parts with their columns and chords, read together. */
export interface SongContent {
  parts: PartRow[];
  eventsByPart: Record<string, EventRow[]>;
  annotationsByPart: Record<string, AnnotationRow[]>;
}

/**
 * Parts, columns and annotations in ONE read transaction.
 *
 * Three separate live queries can each commit on their own render, so a consumer could hold a part whose
 * columns have not arrived, or columns whose chords have not. One transaction means one answer: every part
 * has its columns and its chords, or the caller has nothing yet.
 */
export async function listSongContent(
  songId: string,
  database: StablatureDb = defaultDb,
): Promise<SongContent> {
  return database.transaction("r", [database.parts, database.events, database.annotations], async () => {
    const parts = await listParts(songId, database);
    const eventsByPart: Record<string, EventRow[]> = {};
    const annotationsByPart: Record<string, AnnotationRow[]> = {};
    for (const part of parts) {
      eventsByPart[part.id] = await listEvents(part.id, database);
      annotationsByPart[part.id] = await listAnnotations(part.id, database);
    }
    return { parts, eventsByPart, annotationsByPart };
  });
}

/** Bar count per part, which bounds the arrangement's bar-range controls. */
export async function barCountsBySong(
  songId: string,
  database: StablatureDb = defaultDb,
): Promise<Record<string, number>> {
  const byPart = await listEventsBySong(songId, database);
  return Object.fromEntries(
    Object.entries(byPart).map(([partId, events]) => [partId, countBars(events)]),
  );
}

/** How many local writes are still waiting to be pushed. */
export async function pendingWriteCount(database: StablatureDb = defaultDb): Promise<number> {
  return database.outbox.count();
}

/** Live songs per band on this device. Filters with the same `isLive` as `listSongs`, so the two agree. */
export async function songCountsByBand(
  database: StablatureDb = defaultDb,
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const song of live(await database.songs.toArray())) {
    counts[song.bandId] = (counts[song.bandId] ?? 0) + 1;
  }
  return counts;
}
