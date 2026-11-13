"use client";

/**
 * Reactive reads.
 *
 * `useLiveQuery` re-runs its query whenever the underlying IndexedDB tables
 * change, so a write anywhere in the app updates every screen showing that
 * data without any store, context or invalidation logic. Pulling new rows down
 * from sync is an ordinary local write, which means remote edits light up the
 * UI through exactly the same path as local ones.
 *
 * Every hook returns `undefined` on the very first render, before the query
 * has resolved. Callers should treat that as "loading", distinct from an empty
 * array, which means "loaded, nothing there".
 */

import { useLiveQuery } from "dexie-react-hooks";
import { readClipboard, type Clipboard } from "./clipboard";
import type {
  AnnotationRow,
  ArrangementEntryRow,
  BandRow,
  EventRow,
  PartRow,
  SongRow,
  TuningRow,
} from "../model";
import {
  barCountsBySong,
  getBand,
  getPart,
  getSong,
  listAnnotationsBySong,
  listEventsBySong,
  listAnnotations,
  listArrangement,
  listBands,
  listEvents,
  listParts,
  listSongContent,
  listSongs,
  listTunings,
  pendingWriteCount,
  resolveTuning,
  songCountsByBand,
  type SongContent,
} from "./queries";

export function useBands(): BandRow[] | undefined {
  return useLiveQuery(() => listBands(), []);
}

export function useBand(bandId: string | undefined): BandRow | undefined {
  return useLiveQuery(() => (bandId ? getBand(bandId) : undefined), [bandId]);
}

export function useSongCounts(): Record<string, number> | undefined {
  return useLiveQuery(() => songCountsByBand(), []);
}

export function useSongs(bandId: string | undefined): SongRow[] | undefined {
  return useLiveQuery(() => (bandId ? listSongs(bandId) : undefined), [bandId]);
}

export function useSong(songId: string | undefined): SongRow | undefined {
  return useLiveQuery(() => (songId ? getSong(songId) : undefined), [songId]);
}

export function useTunings(bandId: string | undefined): TuningRow[] | undefined {
  return useLiveQuery(() => (bandId ? listTunings(bandId) : undefined), [bandId]);
}

/** The tuning a song is really in, following the band-default fallback. */
export function useSongTuning(song: SongRow | undefined): TuningRow | undefined {
  return useLiveQuery(
    () => (song ? resolveTuning(song) : undefined),
    [song?.bandId, song?.tuningId],
  );
}

export function useParts(songId: string | undefined): PartRow[] | undefined {
  return useLiveQuery(() => (songId ? listParts(songId) : undefined), [songId]);
}

export function usePart(partId: string | undefined): PartRow | undefined {
  return useLiveQuery(() => (partId ? getPart(partId) : undefined), [partId]);
}

/** A part's tab columns, in playing order. */
export function useEvents(partId: string | undefined): EventRow[] | undefined {
  return useLiveQuery(() => (partId ? listEvents(partId) : undefined), [partId]);
}

export function useAnnotations(partId: string | undefined): AnnotationRow[] | undefined {
  return useLiveQuery(() => (partId ? listAnnotations(partId) : undefined), [partId]);
}

export function useArrangement(songId: string | undefined): ArrangementEntryRow[] | undefined {
  return useLiveQuery(() => (songId ? listArrangement(songId) : undefined), [songId]);
}

/** Every part's columns for a song, keyed by part id. */
export function useSongEvents(songId: string | undefined): Record<string, EventRow[]> | undefined {
  return useLiveQuery(() => (songId ? listEventsBySong(songId) : undefined), [songId]);
}

export function useSongAnnotations(
  songId: string | undefined,
): Record<string, AnnotationRow[]> | undefined {
  return useLiveQuery(() => (songId ? listAnnotationsBySong(songId) : undefined), [songId]);
}

/** Parts, columns and chords of a song from one read, so a render never sees them out of step. */
export function useSongContent(songId: string | undefined): SongContent | undefined {
  return useLiveQuery(() => (songId ? listSongContent(songId) : undefined), [songId]);
}

/** Bar count per part, used to bound the arrangement bar-range controls. */
export function useBarCounts(songId: string | undefined): Record<string, number> | undefined {
  return useLiveQuery(() => (songId ? barCountsBySong(songId) : undefined), [songId]);
}

/** What is on the clipboard, if anything. Survives moving between parts. */
export function useClipboard(): Clipboard | null | undefined {
  return useLiveQuery(() => readClipboard(), []);
}

/**
 * Unpushed local writes. Drives the "N changes waiting" indicator, which is
 * the honest way to show sync state instead of a spinner that lies.
 */
export function usePendingWrites(): number | undefined {
  return useLiveQuery(() => pendingWriteCount(), []);
}
