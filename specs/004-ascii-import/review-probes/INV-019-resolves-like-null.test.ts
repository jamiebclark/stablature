/**
 * Round 2. INV-019: never does taking an offer change anything but this song's tuning.
 *
 * F10 asked that after a preset offer every other live song resolves to what it resolved to before.
 * `resolveTuning` treats a song on a deleted tuning the way it treats null, and deleting a tuning
 * leaves the song's `tuningId` in place (TuningsView.tsx:69, a plain deleteRow). So "sits on null"
 * is one member of the set, and "sits on a tuning that is gone" is the other.
 */
import { describe, expect, it } from "vitest";
import { createSong, createTuningFromPreset } from "@/lib/local/editing";
import { importTab } from "@/lib/local/importing";
import { deleteRow } from "@/lib/local/mutate";
import { listSongs, listTunings, resolveTuning } from "@/lib/local/queries";
import { othersOnNull, readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";
import { contextOf, staff, world } from "./unit-helpers";

describe("INV-019 a song on a deleted tuning follows the band, like a song on null", () => {
  it("does not move when another song takes a preset offer", async () => {
    // No band default, B Standard left, and another song stranded on a deleted tuning.
    const w = await world("bass5-b", { onSong: false, isDefault: false });
    const gone = await createTuningFromPreset(w.bandId, presetById("bass4-e")!, false, w.ctx);
    const other = await createSong(w.bandId, "Other", gone.id, w.ctx);
    await deleteRow("tunings", gone.id, w.ctx);
    const before = (await resolveTuning(other, w.db))!;

    // Five rows naming A Standard, which the band lacks and whose name sorts ahead of B Standard.
    const text = staff("FCGDA", ["-5-", "---", "---", "---", "-3-"]);
    const song = (await w.db.songs.get(w.song.id))!;
    const context = {
      ...(await contextOf(w)),
      othersOnNull: othersOnNull(song, await listSongs(w.bandId, w.db), await listTunings(w.bandId, w.db)),
    };
    const r = readTab(text, context);
    if (r.kind === "ready") await importTab(w.song, text, r.fitKey, w.ctx);

    expect((await resolveTuning(other, w.db))!.id).toBe(before.id);
  });
});
