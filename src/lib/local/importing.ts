/**
 * Importing pasted tab as a new part.
 *
 * One transaction: the song is re-read, the text is read again against what
 * the store holds now, and only if that still matches what the button
 * promised is anything written. A throw anywhere rolls the tuning, the part
 * and its columns back together (contracts/writes.md "The write").
 */

import type { PartRow, SongRow } from "../model";
import { presetById } from "../tunings";
import { othersOnNull, readTab, type TabReading } from "../tab/reading";
import { pasteClipboard } from "./clipboard";
import { createPart, createTuningFromPreset } from "./editing";
import { mutateBatch, patchRow, type MutateContext } from "./mutate";
import { getSong, listEventsBySong, listSongs, listTunings, resolveTuning } from "./queries";

export type ImportResult =
  | { kind: "imported"; part: PartRow }
  | { kind: "changed"; reading: TabReading };

export async function importTab(
  song: Pick<SongRow, "id" | "bandId">,
  text: string,
  expected: string,
  ctx: MutateContext = {},
): Promise<ImportResult> {
  let result: ImportResult | null = null;

  await mutateBatch(async (inner) => {
    const database = inner.db;
    const current = await getSong(song.id, database);
    if (!current) {
      result = { kind: "changed", reading: { kind: "idle" } };
      return;
    }
    const tuning = await resolveTuning(current, database);
    const bandTunings = await listTunings(song.bandId, database);
    const byPart = await listEventsBySong(song.id, database);

    const reading = readTab(text, {
      tuning: tuning ?? null,
      bandTunings,
      songEvents: Object.values(byPart).flat(),
      othersOnNull: othersOnNull(current, await listSongs(song.bandId, database), bandTunings),
    });
    if (reading.kind !== "ready" || reading.fitKey !== expected) {
      result = { kind: "changed", reading };
      return;
    }

    const { fit } = reading;
    if (fit.kind === "offer") {
      let tuningId: string;
      if ("tuningId" in fit.source) {
        tuningId = fit.source.tuningId;
      } else {
        const preset = presetById(fit.source.presetId);
        if (!preset) throw new Error(`Unknown tuning preset ${fit.source.presetId}`);
        tuningId = (await createTuningFromPreset(song.bandId, preset, false, inner)).id;
      }
      await patchRow("songs", song.id, { tuningId }, inner);
    }

    const part = await createPart(song, inner);
    await pasteClipboard(part, [], null, reading.clipboard, inner);
    result = { kind: "imported", part };
  }, ctx);

  return result ?? { kind: "changed", reading: { kind: "idle" } };
}
