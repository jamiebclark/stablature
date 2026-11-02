/**
 * Editing operations.
 *
 * The vocabulary the UI speaks in: add a column, repeat it eight times, make
 * those three a triplet, name the chord above it. Everything here goes through
 * mutate.ts, so each operation is a local write that queues itself for sync
 * and works with no connectivity.
 *
 * Kept separate from the components because this is where the domain rules
 * live -- what the next part is called, what a variant is called, how a repeat
 * is bumped -- and those are worth testing without a browser.
 */

import { newId } from "../ids";
import type {
  AnnotationRow,
  BandRow,
  EventRow,
  FretMap,
  FretValue,
  PartRow,
  SongRow,
  TuningRow,
} from "../model";
import { rankAtEnd, rankBetween } from "../rank";
import type { TuningPreset } from "../tunings";
import { listAnnotations, listEvents, listParts } from "./queries";
import {
  deleteRow,
  insertRow,
  mutateBatch,
  patchRow,
  type MutateContext,
} from "./mutate";

/* ---------- naming ---------- */

/**
 * The next free part letter: A, B, ... Z, then AA, AB.
 *
 * Bands name parts by letter and the app should not argue with that. Variants
 * are excluded from the sequence because `A'` is a flavour of A, not a part in
 * its own right.
 */
export function nextPartLabel(existing: readonly Pick<PartRow, "label">[]): string {
  const taken = new Set(existing.map((p) => p.label));
  for (let index = 0; index < 26 * 27; index += 1) {
    const label = letterAt(index);
    if (!taken.has(label)) return label;
  }
  return newId().slice(0, 4);
}

function letterAt(index: number): string {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (index < 26) return letters[index];
  const first = Math.floor(index / 26) - 1;
  return letters[first] + letters[index % 26];
}

/**
 * Variant labels get primes: A, then A', A'', A'''.
 *
 * Reads the way a band says it out loud -- "A prime", "the A with the
 * flourish" -- and keeps the relationship to the base part visible in a list.
 */
export function nextVariantLabel(
  base: Pick<PartRow, "label">,
  existing: readonly Pick<PartRow, "label">[],
): string {
  const taken = new Set(existing.map((p) => p.label));
  for (let primes = 1; primes < 12; primes += 1) {
    const label = base.label + "'".repeat(primes);
    if (!taken.has(label)) return label;
  }
  return `${base.label}-${newId().slice(0, 3)}`;
}

/** URL-safe band slug. */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || `band-${newId().slice(0, 6)}`;
}

/* ---------- creation ---------- */

export async function createBand(name: string, ctx: MutateContext = {}): Promise<BandRow> {
  return insertRow("bands", { id: newId(), name: name.trim(), slug: slugify(name) }, ctx);
}

export async function createTuningFromPreset(
  bandId: string,
  preset: TuningPreset,
  isDefault: boolean,
  ctx: MutateContext = {},
): Promise<TuningRow> {
  return insertRow(
    "tunings",
    {
      id: newId(),
      bandId,
      name: `${preset.name} (${preset.family})`,
      strings: preset.strings,
      isDefault,
    },
    ctx,
  );
}

/**
 * Make one tuning the band's default, clearing the others.
 *
 * Done as a batch so the band can never momentarily have two defaults or none
 * -- `resolveTuning` would otherwise pick arbitrarily.
 */
export async function setDefaultTuning(
  tunings: readonly TuningRow[],
  tuningId: string,
  ctx: MutateContext = {},
): Promise<void> {
  await mutateBatch(async (inner) => {
    for (const tuning of tunings) {
      const shouldBeDefault = tuning.id === tuningId;
      if (tuning.isDefault !== shouldBeDefault) {
        await patchRow("tunings", tuning.id, { isDefault: shouldBeDefault }, inner);
      }
    }
  }, ctx);
}

export async function createSong(
  bandId: string,
  title: string,
  tuningId: string | null = null,
  ctx: MutateContext = {},
): Promise<SongRow> {
  return insertRow(
    "songs",
    { id: newId(), bandId, title: title.trim() || "Untitled", tuningId, bpm: null, notes: null },
    ctx,
  );
}

/** Add a part, lettered after whatever is already there. */
export async function createPart(
  song: Pick<SongRow, "id" | "bandId">,
  ctx: MutateContext = {},
): Promise<PartRow> {
  const existing = await listParts(song.id, ctx.db);
  return insertRow(
    "parts",
    {
      id: newId(),
      bandId: song.bandId,
      songId: song.id,
      label: nextPartLabel(existing),
      name: null,
      rank: rankAtEnd(existing),
      variantOfPartId: null,
      notes: null,
    },
    ctx,
  );
}

/**
 * Create a variant of a part, copying its columns.
 *
 * Copying rather than referencing is deliberate: a variant exists precisely
 * because it diverges -- "A but with a flourish on the last bar" -- so it needs
 * its own editable columns. The link back to the base part is kept so the
 * arrangement can say "A x4, flourish on the 4th".
 */
export async function createVariant(
  base: PartRow,
  ctx: MutateContext = {},
): Promise<PartRow> {
  const siblings = await listParts(base.songId, ctx.db);
  const sourceEvents = await listEvents(base.id, ctx.db);
  const sourceAnnotations = await listAnnotations(base.id, ctx.db);

  let variant!: PartRow;
  await mutateBatch(async (inner) => {
    variant = await insertRow(
      "parts",
      {
        id: newId(),
        bandId: base.bandId,
        songId: base.songId,
        label: nextVariantLabel(base, siblings),
        name: base.name,
        rank: rankAtEnd(siblings),
        variantOfPartId: base.id,
        notes: base.notes,
      },
      inner,
    );

    // Keep a map from old column to new, so copied chords stay anchored.
    const idMap = new Map<string, string>();
    for (const event of sourceEvents) {
      const copy = await insertRow(
        "events",
        {
          id: newId(),
          bandId: event.bandId,
          partId: variant.id,
          rank: event.rank,
          kind: event.kind,
          frets: { ...event.frets },
          techniques: { ...event.techniques },
          repeat: event.repeat,
          durationHint: event.durationHint,
          tupletId: event.tupletId,
          tupletCount: event.tupletCount,
        },
        inner,
      );
      idMap.set(event.id, copy.id);
    }

    for (const annotation of sourceAnnotations) {
      await insertRow(
        "annotations",
        {
          id: newId(),
          bandId: annotation.bandId,
          partId: variant.id,
          anchorEventId: annotation.anchorEventId
            ? idMap.get(annotation.anchorEventId) ?? null
            : null,
          kind: annotation.kind,
          value: annotation.value,
        },
        inner,
      );
    }
  }, ctx);

  return variant;
}

/* ---------- capture ---------- */

/**
 * Insert a column at a cursor position.
 *
 * `afterEventId` names the column to insert *after*; null means the very
 * start. This is what makes it possible to capture the root notes of a riff
 * first and flesh the rest out afterwards, which is how people actually work
 * when someone is playing at them.
 *
 * Nothing after the insertion point is rewritten. Fractional ranks mean the
 * new column simply gets a key between its two neighbours, so inserting into
 * the middle of a part is one row written, not a renumbering of the rest --
 * and two people inserting into the same gap offline still merge cleanly.
 */
export async function insertColumn(
  part: Pick<PartRow, "id" | "bandId">,
  events: readonly EventRow[],
  afterEventId: string | null,
  frets: FretMap,
  options: { repeat?: number; kind?: EventRow["kind"] } = {},
  ctx: MutateContext = {},
): Promise<EventRow> {
  const index = afterEventId ? events.findIndex((event) => event.id === afterEventId) : -1;

  // An unknown id means the column was deleted on another device mid-edit.
  // Appending is the safe reading of "after something that is gone".
  const resolved = afterEventId && index === -1 ? events.length - 1 : index;

  const before = resolved >= 0 ? events[resolved] : undefined;
  const after = events[resolved + 1];

  return insertRow(
    "events",
    {
      id: newId(),
      bandId: part.bandId,
      partId: part.id,
      rank: rankBetween(before?.rank ?? null, after?.rank ?? null),
      kind: options.kind ?? "notes",
      frets,
      techniques: {},
      repeat: Math.max(1, options.repeat ?? 1),
      durationHint: null,
      tupletId: null,
      tupletCount: null,
    },
    ctx,
  );
}

/** Insert a single note at the cursor. The common gesture while editing. */
export async function insertNote(
  part: Pick<PartRow, "id" | "bandId">,
  events: readonly EventRow[],
  afterEventId: string | null,
  stringIndex: number,
  fret: FretValue,
  ctx: MutateContext = {},
): Promise<EventRow> {
  return insertColumn(part, events, afterEventId, { [String(stringIndex)]: fret }, {}, ctx);
}

/**
 * Insert a space: a column with nothing on any string.
 *
 * In a positional model this is how time passes without a note -- a pause, or
 * a note left to ring. Those are the same thing on a page of tab, which is
 * why there is one button rather than two: the difference between silence and
 * sustain is an articulation on the note before it, not a separate column.
 *
 * Worth knowing: `repeat` works on these like any other column, so a long
 * hold is one space with a count rather than six empty columns.
 */
export async function insertRest(
  part: Pick<PartRow, "id" | "bandId">,
  events: readonly EventRow[],
  afterEventId: string | null,
  ctx: MutateContext = {},
): Promise<EventRow> {
  return insertColumn(part, events, afterEventId, {}, { kind: "rest" }, ctx);
}

/** Insert a barline at the cursor. */
export async function insertBarline(
  part: Pick<PartRow, "id" | "bandId">,
  events: readonly EventRow[],
  afterEventId: string | null,
  ctx: MutateContext = {},
): Promise<EventRow> {
  return insertColumn(part, events, afterEventId, {}, { kind: "barline" }, ctx);
}

/** Append a column of tab to a part. */
export async function appendColumn(
  part: Pick<PartRow, "id" | "bandId">,
  frets: FretMap,
  options: { repeat?: number } = {},
  ctx: MutateContext = {},
): Promise<EventRow> {
  const existing = await listEvents(part.id, ctx.db);
  return insertRow(
    "events",
    {
      id: newId(),
      bandId: part.bandId,
      partId: part.id,
      rank: rankAtEnd(existing),
      kind: "notes",
      frets,
      techniques: {},
      repeat: Math.max(1, options.repeat ?? 1),
      durationHint: null,
      tupletId: null,
      tupletCount: null,
    },
    ctx,
  );
}

/** Append a single note, the overwhelmingly common capture gesture. */
export async function appendNote(
  part: Pick<PartRow, "id" | "bandId">,
  stringIndex: number,
  fret: FretValue,
  ctx: MutateContext = {},
): Promise<EventRow> {
  return appendColumn(part, { [String(stringIndex)]: fret }, {}, ctx);
}

/**
 * Add a note to an existing column, making it a chord.
 *
 * Separate from `appendNote` because during capture a tap has to mean "next
 * note" by default -- that is the fast path -- and stacking is the deliberate
 * exception.
 */
export async function stackNote(
  event: EventRow,
  stringIndex: number,
  fret: FretValue,
  ctx: MutateContext = {},
): Promise<EventRow> {
  return patchRow(
    "events",
    event.id,
    {
      frets: { ...event.frets, [String(stringIndex)]: fret },
      // A space with a note on it is no longer a space. Leaving the kind alone
      // would give a column that renders as notes but reads as a rest to
      // anything inspecting it later.
      ...(event.kind === "rest" ? { kind: "notes" as const } : {}),
    },
    ctx,
  );
}

/** Remove one string from a column, deleting the column if it empties. */
export async function unstackNote(
  event: EventRow,
  stringIndex: number,
  ctx: MutateContext = {},
): Promise<void> {
  const frets = { ...event.frets };
  delete frets[String(stringIndex)];
  if (Object.keys(frets).length === 0) {
    await deleteRow("events", event.id, ctx);
    return;
  }
  await patchRow("events", event.id, { frets }, ctx);
}

export async function setColumnRepeat(
  eventId: string,
  repeat: number,
  ctx: MutateContext = {},
): Promise<void> {
  await patchRow("events", eventId, { repeat: Math.max(1, Math.round(repeat)) }, ctx);
}

/** Nudge a repeat up or down, never below 1. */
export async function bumpColumnRepeat(
  event: Pick<EventRow, "id" | "repeat">,
  delta: number,
  ctx: MutateContext = {},
): Promise<void> {
  await setColumnRepeat(event.id, Math.max(1, event.repeat + delta), ctx);
}

export async function appendBarline(
  part: Pick<PartRow, "id" | "bandId">,
  ctx: MutateContext = {},
): Promise<EventRow> {
  const existing = await listEvents(part.id, ctx.db);
  return insertRow(
    "events",
    {
      id: newId(),
      bandId: part.bandId,
      partId: part.id,
      rank: rankAtEnd(existing),
      kind: "barline",
      frets: {},
      techniques: {},
      repeat: 1,
      durationHint: null,
      tupletId: null,
      tupletCount: null,
    },
    ctx,
  );
}

export async function deleteColumn(eventId: string, ctx: MutateContext = {}): Promise<void> {
  await deleteRow("events", eventId, ctx);
}

/** Undo the last thing captured. The main way a mistake gets fixed. */
export async function deleteLastColumn(
  partId: string,
  ctx: MutateContext = {},
): Promise<EventRow | undefined> {
  const events = await listEvents(partId, ctx.db);
  const last = events[events.length - 1];
  if (!last) return undefined;
  await deleteRow("events", last.id, ctx);
  return last;
}

/**
 * Mark a run of columns as a tuplet.
 *
 * A tuplet is a grouping over columns rather than a change to any column's
 * duration, which is what lets the positional model express triplets at all.
 */
export async function groupAsTuplet(
  events: readonly EventRow[],
  count = 3,
  ctx: MutateContext = {},
): Promise<string | undefined> {
  const playable = events.filter((event) => event.kind !== "barline");
  if (playable.length < 2) return undefined;

  const tupletId = newId();
  await mutateBatch(async (inner) => {
    for (const event of playable) {
      await patchRow("events", event.id, { tupletId, tupletCount: count }, inner);
    }
  }, ctx);
  return tupletId;
}

export async function ungroupTuplet(
  events: readonly EventRow[],
  ctx: MutateContext = {},
): Promise<void> {
  await mutateBatch(async (inner) => {
    for (const event of events) {
      if (event.tupletId === null) continue;
      await patchRow("events", event.id, { tupletId: null, tupletCount: null }, inner);
    }
  }, ctx);
}

/** Group the last `count` playable columns -- the capture-screen triplet button. */
export async function tripletFromTail(
  partId: string,
  count = 3,
  ctx: MutateContext = {},
): Promise<string | undefined> {
  const events = (await listEvents(partId, ctx.db)).filter((e) => e.kind !== "barline");
  return groupAsTuplet(events.slice(-count), count, ctx);
}

/* ---------- annotations ---------- */

/**
 * Set or replace the chord above a column.
 *
 * Upsert rather than insert, because the gesture is "the chord here is Am" and
 * doing it twice should not leave two symbols stacked on one column.
 */
export async function setChord(
  part: Pick<PartRow, "id" | "bandId">,
  eventId: string,
  value: string,
  ctx: MutateContext = {},
): Promise<void> {
  const trimmed = value.trim();
  const existing = (await listAnnotations(part.id, ctx.db)).find(
    (a) => a.kind === "chord" && a.anchorEventId === eventId,
  );

  if (!trimmed) {
    if (existing) await deleteRow("annotations", existing.id, ctx);
    return;
  }
  if (existing) {
    await patchRow("annotations", existing.id, { value: trimmed }, ctx);
    return;
  }
  await insertRow(
    "annotations",
    {
      id: newId(),
      bandId: part.bandId,
      partId: part.id,
      anchorEventId: eventId,
      kind: "chord",
      value: trimmed,
    },
    ctx,
  );
}

export async function chordFor(
  annotations: readonly AnnotationRow[],
  eventId: string,
): Promise<string | null> {
  return annotations.find((a) => a.kind === "chord" && a.anchorEventId === eventId)?.value ?? null;
}
