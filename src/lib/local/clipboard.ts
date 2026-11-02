/**
 * Selecting a run of columns, and moving it around.
 *
 * The clipboard lives in the local store rather than in component state so it
 * survives navigating between parts -- copying a bar out of A and pasting it
 * into B is the main reason anyone wants this, and that is a navigation.
 *
 * Pasting reuses the ordinary insert path: fresh UUIDv7 ids and fractional
 * ranks between the two neighbours at the cursor. So a paste is just rows
 * being added, with none of the surrounding columns rewritten, and it merges
 * like anything else.
 */

import { newId } from "../ids";
import type {
  AnnotationKind,
  AnnotationRow,
  EventKind,
  EventRow,
  FretMap,
  PartRow,
  TechniqueMap,
} from "../model";
import { ranksBetween } from "../rank";
import { db as defaultDb, type StablatureDb } from "./db";
import { insertRow, mutateBatch, patchRow, type MutateContext } from "./mutate";

const CLIPBOARD_KEY = "clipboard";

/** A column stripped of everything that ties it to where it came from. */
export interface ClipboardColumn {
  kind: EventKind;
  frets: FretMap;
  techniques: TechniqueMap;
  repeat: number;
  durationHint: EventRow["durationHint"];
  /**
   * Which tuplet of the copied run this column belonged to, by position
   * rather than by id. Tuplet ids are minted fresh on paste, so copying three
   * columns of a triplet has to carry the grouping without carrying the id.
   */
  tupletGroup: number | null;
  tupletCount: number | null;
}

export interface Clipboard {
  columns: ClipboardColumn[];
  /** Chords and text, anchored by index into `columns`. */
  annotations: { columnIndex: number; kind: AnnotationKind; value: string }[];
}

/**
 * The inclusive run between two columns, in either tap order.
 *
 * Order-insensitive because a selection is made by tapping two columns and
 * nobody taps them left to right reliably.
 */
export function columnRange(
  events: readonly EventRow[],
  fromId: string,
  toId: string,
): EventRow[] {
  const a = events.findIndex((event) => event.id === fromId);
  const b = events.findIndex((event) => event.id === toId);
  if (a === -1 || b === -1) return [];
  const [start, end] = a <= b ? [a, b] : [b, a];
  return events.slice(start, end + 1);
}

/** Build a clipboard payload from a selected run. */
export function copyColumns(
  selected: readonly EventRow[],
  annotations: readonly AnnotationRow[] = [],
): Clipboard {
  const tupletGroups = new Map<string, number>();
  const indexById = new Map<string, number>();

  const columns = selected.map((event, index) => {
    indexById.set(event.id, index);

    let tupletGroup: number | null = null;
    if (event.tupletId) {
      if (!tupletGroups.has(event.tupletId)) tupletGroups.set(event.tupletId, tupletGroups.size);
      tupletGroup = tupletGroups.get(event.tupletId)!;
    }

    return {
      kind: event.kind,
      frets: { ...event.frets },
      techniques: { ...event.techniques },
      repeat: event.repeat,
      durationHint: event.durationHint,
      tupletGroup,
      tupletCount: event.tupletCount,
    } satisfies ClipboardColumn;
  });

  const carried = annotations
    .filter((annotation) => annotation.anchorEventId && indexById.has(annotation.anchorEventId))
    .map((annotation) => ({
      columnIndex: indexById.get(annotation.anchorEventId!)!,
      kind: annotation.kind,
      value: annotation.value,
    }));

  return { columns, annotations: carried };
}

export async function writeClipboard(
  clipboard: Clipboard,
  database: StablatureDb = defaultDb,
): Promise<void> {
  await database.meta.put({ key: CLIPBOARD_KEY, value: clipboard });
}

export async function readClipboard(
  database: StablatureDb = defaultDb,
): Promise<Clipboard | null> {
  const entry = await database.meta.get(CLIPBOARD_KEY);
  const value = entry?.value as Clipboard | undefined;
  return value && Array.isArray(value.columns) && value.columns.length > 0 ? value : null;
}

/**
 * Paste a clipboard in at the cursor.
 *
 * All the ranks are generated up front in one call, so the pasted run is
 * evenly spread between its two neighbours instead of each column being
 * squeezed into the gap left by the one before it -- which would make the
 * keys grow a character per column.
 */
export async function pasteClipboard(
  part: Pick<PartRow, "id" | "bandId">,
  events: readonly EventRow[],
  afterEventId: string | null,
  clipboard: Clipboard,
  ctx: MutateContext = {},
): Promise<EventRow[]> {
  if (clipboard.columns.length === 0) return [];

  const index = afterEventId ? events.findIndex((event) => event.id === afterEventId) : -1;
  const resolved = afterEventId && index === -1 ? events.length - 1 : index;
  const before = resolved >= 0 ? events[resolved] : undefined;
  const after = events[resolved + 1];

  const ranks = ranksBetween(before?.rank ?? null, after?.rank ?? null, clipboard.columns.length);
  const tupletIds = new Map<number, string>();
  const inserted: EventRow[] = [];

  await mutateBatch(async (inner) => {
    for (const [position, column] of clipboard.columns.entries()) {
      let tupletId: string | null = null;
      if (column.tupletGroup !== null) {
        // A fresh id per group, so a pasted triplet is its own tuplet rather
        // than being welded to the one it was copied from.
        if (!tupletIds.has(column.tupletGroup)) {
          tupletIds.set(column.tupletGroup, newId());
        }
        tupletId = tupletIds.get(column.tupletGroup)!;
      }

      const row = await insertRow(
        "events",
        {
          id: newId(),
          bandId: part.bandId,
          partId: part.id,
          rank: ranks[position],
          kind: column.kind,
          frets: { ...column.frets },
          techniques: { ...column.techniques },
          repeat: column.repeat,
          durationHint: column.durationHint,
          tupletId,
          tupletCount: column.tupletCount,
        },
        inner,
      );
      inserted.push(row);
    }

    for (const annotation of clipboard.annotations) {
      const anchor = inserted[annotation.columnIndex];
      if (!anchor) continue;
      await insertRow(
        "annotations",
        {
          id: newId(),
          bandId: part.bandId,
          partId: part.id,
          anchorEventId: anchor.id,
          kind: annotation.kind,
          value: annotation.value,
        },
        inner,
      );
    }
  }, ctx);

  return inserted;
}

/** Tombstone a run of columns in one batch. */
export async function deleteColumns(
  selected: readonly EventRow[],
  ctx: MutateContext = {},
): Promise<void> {
  if (selected.length === 0) return;
  await mutateBatch(async (inner) => {
    for (const event of selected) {
      // Deleting through patchRow rather than deleteRow so the whole run
      // shares one batch and cannot be left half-removed.
      await patchRow("events", event.id, { deletedAt: inner.clock.send() }, inner);
    }
  }, ctx);
}

/** Copy a run to the clipboard, then remove it. */
export async function cutColumns(
  selected: readonly EventRow[],
  annotations: readonly AnnotationRow[],
  ctx: MutateContext = {},
): Promise<Clipboard> {
  const clipboard = copyColumns(selected, annotations);
  await writeClipboard(clipboard, ctx.db ?? defaultDb);
  await deleteColumns(selected, ctx);
  return clipboard;
}
