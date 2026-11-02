/**
 * Arrangement editing.
 *
 * Entries are stored flat with explicit section markers (see
 * src/lib/arrangement/expand.ts for why), so adding a section means writing a
 * matched pair of marker rows. Doing that in one batch matters: a start
 * without its end would leave the song reading as "everything after this
 * repeats", which is a confusing thing to see appear on someone else's phone.
 */

import { newId } from "../ids";
import type { ArrangementEntryRow, PartRow, SongRow } from "../model";
import { rankAtEnd, rankBetween, rankForMove } from "../rank";
import { insertRow, mutateBatch, patchRow, type MutateContext } from "./mutate";
import { listArrangement } from "./queries";
import { deleteRow } from "./mutate";

type SongRef = Pick<SongRow, "id" | "bandId">;

/** Add a part to the end of the arrangement. */
export async function appendPartEntry(
  song: SongRef,
  partId: string,
  options: { repeat?: number } = {},
  ctx: MutateContext = {},
): Promise<ArrangementEntryRow> {
  const existing = await listArrangement(song.id, ctx.db);
  return insertRow(
    "arrangementEntries",
    {
      id: newId(),
      bandId: song.bandId,
      songId: song.id,
      rank: rankAtEnd(existing),
      kind: "part",
      partId,
      repeat: Math.max(1, options.repeat ?? 1),
      fromBar: null,
      toBar: null,
      lastRepeatPartId: null,
      label: null,
    },
    ctx,
  );
}

/** Add a free-text cue, e.g. "build slowly" or "drums only". */
export async function appendTextEntry(
  song: SongRef,
  label: string,
  ctx: MutateContext = {},
): Promise<ArrangementEntryRow | undefined> {
  const trimmed = label.trim();
  if (!trimmed) return undefined;
  const existing = await listArrangement(song.id, ctx.db);
  return insertRow(
    "arrangementEntries",
    {
      id: newId(),
      bandId: song.bandId,
      songId: song.id,
      rank: rankAtEnd(existing),
      kind: "text",
      partId: null,
      repeat: 1,
      fromBar: null,
      toBar: null,
      lastRepeatPartId: null,
      label: trimmed,
    },
    ctx,
  );
}

/**
 * Add an empty section, as a matched start/end pair.
 *
 * Written as a batch so the arrangement is never momentarily unbalanced, and
 * so a bandmate pulling mid-write cannot see a dangling section.
 */
export async function appendSection(
  song: SongRef,
  label: string,
  repeat = 2,
  ctx: MutateContext = {},
): Promise<void> {
  const existing = await listArrangement(song.id, ctx.db);
  const startRank = rankAtEnd(existing);
  const endRank = rankBetween(startRank, null);

  await mutateBatch(async (inner) => {
    const base = {
      bandId: song.bandId,
      songId: song.id,
      partId: null,
      fromBar: null,
      toBar: null,
      lastRepeatPartId: null,
    };
    await insertRow(
      "arrangementEntries",
      {
        ...base,
        id: newId(),
        rank: startRank,
        kind: "section_start",
        repeat: Math.max(1, repeat),
        label: label.trim() || null,
      },
      inner,
    );
    await insertRow(
      "arrangementEntries",
      { ...base, id: newId(), rank: endRank, kind: "section_end", repeat: 1, label: null },
      inner,
    );
  }, ctx);
}

export async function setEntryRepeat(
  entryId: string,
  repeat: number,
  ctx: MutateContext = {},
): Promise<void> {
  await patchRow(
    "arrangementEntries",
    entryId,
    { repeat: Math.max(1, Math.round(repeat)) },
    ctx,
  );
}

export async function bumpEntryRepeat(
  entry: Pick<ArrangementEntryRow, "id" | "repeat">,
  delta: number,
  ctx: MutateContext = {},
): Promise<void> {
  await setEntryRepeat(entry.id, Math.max(1, entry.repeat + delta), ctx);
}

/**
 * Set the variant played on the final pass -- "flourish on the 4th".
 *
 * Pass null to clear it.
 */
export async function setEntryVariant(
  entryId: string,
  variantPartId: string | null,
  ctx: MutateContext = {},
): Promise<void> {
  await patchRow("arrangementEntries", entryId, { lastRepeatPartId: variantPartId }, ctx);
}

/**
 * Narrow an entry to some bars of its part -- "C, first half".
 *
 * Bars are 1-indexed and inclusive; nulls mean open ends. Reversed bounds are
 * normalised rather than rejected, since a bar stepper can easily be dragged
 * past itself.
 */
export async function setEntryBars(
  entryId: string,
  fromBar: number | null,
  toBar: number | null,
  ctx: MutateContext = {},
): Promise<void> {
  let from = fromBar;
  let to = toBar;
  if (from !== null && to !== null && from > to) [from, to] = [to, from];
  await patchRow("arrangementEntries", entryId, { fromBar: from, toBar: to }, ctx);
}

export async function deleteEntry(entryId: string, ctx: MutateContext = {}): Promise<void> {
  await deleteRow("arrangementEntries", entryId, ctx);
}

/**
 * Delete a section along with its matching end marker.
 *
 * Removing the start alone would leave a stray end, which parses as a no-op
 * but shows up as an orphan if anyone later inspects the list.
 */
export async function deleteSection(
  entries: readonly ArrangementEntryRow[],
  startEntryId: string,
  ctx: MutateContext = {},
): Promise<void> {
  const startIndex = entries.findIndex((e) => e.id === startEntryId);
  if (startIndex < 0) return;

  // Walk forward tracking depth to find this section's own end marker, rather
  // than the first one we happen to meet.
  let depth = 0;
  let endId: string | null = null;
  for (let i = startIndex; i < entries.length; i += 1) {
    const entry = entries[i];
    if (entry.kind === "section_start") depth += 1;
    else if (entry.kind === "section_end") {
      depth -= 1;
      if (depth === 0) {
        endId = entry.id;
        break;
      }
    }
  }

  await mutateBatch(async (inner) => {
    await deleteRow("arrangementEntries", startEntryId, inner);
    if (endId) await deleteRow("arrangementEntries", endId, inner);
  }, ctx);
}

/**
 * Move an entry to sit between two others.
 *
 * Only the moved row is written -- the whole point of fractional ranks -- and
 * a no-op move writes nothing at all, so it cannot win a merge against
 * someone's real edit.
 */
export async function moveEntry(
  entries: readonly ArrangementEntryRow[],
  entryId: string,
  toIndex: number,
  ctx: MutateContext = {},
): Promise<void> {
  const moving = entries.find((e) => e.id === entryId);
  if (!moving) return;

  const without = entries.filter((e) => e.id !== entryId);
  const clamped = Math.max(0, Math.min(toIndex, without.length));
  const before = without[clamped - 1] ?? null;
  const after = without[clamped] ?? null;

  const rank = rankForMove(before, after, moving);
  if (rank === null) return;
  await patchRow("arrangementEntries", entryId, { rank }, ctx);
}

/**
 * Seed an arrangement from the parts that exist, in order.
 *
 * Offered on an empty arrangement because "play each part once" is the right
 * starting point far more often than a blank list, and it is quicker to delete
 * from than to build up.
 */
export async function seedArrangementFromParts(
  song: SongRef,
  parts: readonly PartRow[],
  ctx: MutateContext = {},
): Promise<void> {
  // Variants are reached through their base part's final pass, so they should
  // not each get their own entry.
  const playable = parts.filter((part) => part.variantOfPartId === null);
  if (playable.length === 0) return;

  await mutateBatch(async (inner) => {
    let rank: string | null = null;
    for (const part of playable) {
      rank = rankBetween(rank, null);
      await insertRow(
        "arrangementEntries",
        {
          id: newId(),
          bandId: song.bandId,
          songId: song.id,
          rank,
          kind: "part",
          partId: part.id,
          repeat: 1,
          fromBar: null,
          toBar: null,
          lastRepeatPartId: null,
          label: null,
        },
        inner,
      );
    }
  }, ctx);
}
