/**
 * INV-018: never is a tuning offered under which a stored note changes pitch or loses its string,
 *          and never a merely close one.
 * INV-019: never does taking an offer change anything but this song's tuning, and never is a
 *          tuning made from labels.
 * Each pair is committed through `importTab`, then read back and pitched.
 */
import { describe, expect, it } from "vitest";
import { createPart, createSong, createTuningFromPreset, createVariant } from "@/lib/local/editing";
import { importTab } from "@/lib/local/importing";
import { deleteRow, insertRow, patchRow } from "@/lib/local/mutate";
import { listParts, listTunings, resolveTuning } from "@/lib/local/queries";
import { newId } from "@/lib/ids";
import { noteToMidi } from "@/lib/pitch";
import { pitchClass } from "@/lib/tab/parse";
import { TUNING_PRESETS, fretToMidi, presetById } from "@/lib/tunings";
import {
  contextOf,
  dump,
  eventsOf,
  holdNotes,
  imported,
  reading,
  staff,
  world,
  type World,
} from "./unit-helpers";

const label = (name: string) => name.padEnd(2);
const pasteOf = (preset: { strings: { note: string }[] }, fret = 5) =>
  preset.strings.map((s) => `${label(s.note)} |-${fret}-|`).join("\n");

async function pitches(w: World) {
  const song = (await w.db.songs.get(w.song.id))!;
  const tuning = (await resolveTuning(song, w.db))!;
  const parts = await listParts(song.id, w.db);
  const out: Record<string, number> = {};
  for (const part of parts) {
    for (const event of await eventsOf(w, part.id)) {
      for (const [key, fret] of Object.entries(event.frets)) {
        if (fret === "x") {
          out[`${event.id}:${key}`] = tuning.strings[Number(key)] ? -1 : Number.NaN;
        } else {
          out[`${event.id}:${key}`] = fretToMidi(tuning, Number(key), fret as number);
        }
      }
    }
  }
  return out;
}

describe("INV-018 every preset pair, committed", () => {
  for (const song of TUNING_PRESETS) {
    it(`a song in ${song.id}, every paste, a note on each string in turn and empty`, async () => {
      let offers = 0;
      for (const paste of TUNING_PRESETS) {
        for (let used = -1; used < song.strings.length; used += 1) {
          const w = await world(song.id);
          if (used >= 0) await holdNotes(w, [used]);
          const before = await pitches(w);
          const r = await reading(w, pasteOf(paste));
          if (r.kind !== "ready") continue;
          if (r.fit.kind === "offer") {
            offers += 1;
            expect(r.tuning.strings.map((s) => pitchClass(s.note))).toEqual(
              paste.strings.map((s) => pitchClass(s.note)),
            );
          }
          await imported(w, pasteOf(paste));
          const after = await pitches(w);
          for (const [key, midi] of Object.entries(before)) expect(after[key], key).toBe(midi);
          // Whatever was written sits on a string of the same name at that position.
          const stored = (await w.db.songs.get(w.song.id))!;
          const tuning = (await resolveTuning(stored, w.db))!;
          const parts = await listParts(stored.id, w.db);
          for (const event of await eventsOf(w, parts[parts.length - 1].id)) {
            for (const key of Object.keys(event.frets)) {
              expect(pitchClass(tuning.strings[Number(key)].note)).toBe(
                pitchClass(paste.strings[Number(key)].note),
              );
            }
          }
        }
      }
      expect(offers).toBeGreaterThan(0);
    });
  }
});

describe("INV-018 the song's own shape", () => {
  const b5 = presetById("bass5-b")!;
  const a5 = presetById("bass5-a")!;

  it("dead notes count as notes on their string", async () => {
    const w = await world("bass4-e");
    await holdNotes(w, [0], "x");
    expect((await reading(w, pasteOf(presetById("bass4-d")!))).kind).toBe("refused");
    const ok = await world("bass4-e");
    await holdNotes(ok, [0], "x");
    const r = await reading(ok, pasteOf(b5));
    expect(r.kind === "ready" && r.fit.kind).toBe("offer");
  });

  it("two parts: a note on the second counts", async () => {
    const w = await world("bass5-b");
    await createPart(w.song, w.ctx);
    await holdNotes(w, [0]);
    expect((await reading(w, pasteOf(a5))).kind).toBe("refused");
  });

  it("a variant's notes count", async () => {
    const w = await world("bass5-b");
    const part = await holdNotes(w, [0]);
    await createVariant(part, w.ctx);
    const parts = await listParts(w.song.id, w.db);
    expect(parts).toHaveLength(2);
    expect((await reading(w, pasteOf(a5))).kind).toBe("refused");
  });

  it("a deleted part's notes do not", async () => {
    const w = await world("bass5-b");
    const part = await holdNotes(w, [0]);
    await deleteRow("parts", part.id, w.ctx);
    const r = await reading(w, pasteOf(a5));
    expect(r.kind === "ready" && r.fit.kind).toBe("offer");
  });

  it("no tuning: labelled offers, unlabelled refuses", async () => {
    const w = await world(null);
    const r = await reading(w, pasteOf(b5));
    expect(r.kind === "ready" && r.fitKey).toBe("preset:bass5-b");
    const u = await reading(w, "|-5-|\n|---|\n|---|\n|---|");
    expect(u.kind === "refused" && u.refusals[0].code).toBe("unlabelled-no-tuning");
  });

  it("labels matching nothing: refused, and never a close match", async () => {
    const w = await world("bass4-e");
    for (const names of ["CFAD", "GDAB", "ADGC"]) {
      const r = await reading(w, staff(names, ["-5-", "-5-", "-5-", "-5-"]));
      expect(r.kind, names).toBe("refused");
    }
  });

  it("a reversed paste is named as such, for every preset", async () => {
    for (const preset of TUNING_PRESETS) {
      const names = preset.strings.map((s) => s.note).reverse();
      const palindrome = names.join() === preset.strings.map((s) => s.note).join();
      if (palindrome) continue;
      const w = await world(preset.id);
      const text = names.map((n) => `${label(n)} |-5-|`).join("\n");
      const r = await reading(w, text);
      if (r.kind === "ready") {
        // A reversal that is itself another real tuning is an offer of that tuning.
        expect(r.fit.kind, preset.id).toBe("offer");
      } else {
        expect(r.kind === "refused" && r.refusals[0].code, preset.id).toBe("rows-lowest-first");
      }
    }
  });
});

describe("INV-019 taking an offer touches this song only", () => {
  const a5 = presetById("bass5-a")!;
  const text = pasteOf(a5);

  async function otherRows(w: World, skipSongId: string) {
    const songs = (await w.db.songs.toArray()).filter((s) => s.id !== skipSongId);
    return JSON.stringify(songs);
  }

  it.each([
    ["the song names its tuning", { onSong: true }],
    ["the song is on the band default", { onSong: false }],
  ])("%s, with other songs on null", async (_name, options) => {
    const w = await world("bass5-b", options);
    const other = await createSong(w.bandId, "Other", null, w.ctx);
    await holdNotes({ ...w, song: other }, [0]);
    const before = await otherRows(w, w.song.id);
    const defaults = JSON.stringify((await listTunings(w.bandId, w.db)).map((t) => [t.id, t.isDefault]));
    const resolved = (await resolveTuning(other, w.db))!.id;
    const outbox = await w.db.outbox.count();

    await imported(w, text);

    expect(await otherRows(w, w.song.id)).toBe(before);
    expect((await resolveTuning(other, w.db))!.id).toBe(resolved);
    const tunings = await listTunings(w.bandId, w.db);
    expect(tunings).toHaveLength(2);
    const added = tunings.find((t) => !defaults.includes(t.id))!;
    expect(added.strings).toEqual(a5.strings);
    expect(added.isDefault).toBe(false);
    expect(JSON.stringify(tunings.filter((t) => t.id !== added.id).map((t) => [t.id, t.isDefault]))).toBe(defaults);
    const fresh = (await w.db.outbox.toArray()).slice(outbox);
    expect(fresh.filter((o) => o.table === "songs").map((o) => o.rowId)).toEqual([w.song.id]);
  });

  it("a band already holding the tuning adds no duplicate", async () => {
    const w = await world("bass5-b");
    await createTuningFromPreset(w.bandId, a5, false, w.ctx);
    await imported(w, text);
    expect(await listTunings(w.bandId, w.db)).toHaveLength(2);
  });

  it("a tuning is never made from labels: a tuning row always equals a preset", async () => {
    const w = await world(null);
    await imported(w, text);
    const tunings = await w.db.tunings.toArray();
    for (const t of tunings) {
      expect(TUNING_PRESETS.some((p) => JSON.stringify(p.strings) === JSON.stringify(t.strings))).toBe(true);
      expect(t.isDefault).toBe(false);
    }
  });

  /**
   * `resolveTuning` falls back to the band's FIRST tuning when none is default, and `listTunings`
   * sorts by name. So a tuning the import adds can become what every null song resolves to.
   */
  describe("other songs on null, in a band with no default", () => {
    it("a band with no tunings at all: refused, and another song does not gain one", async () => {
      const w = await world(null);
      const other = await createSong(w.bandId, "Other", null, w.ctx);
      expect(await resolveTuning(other, w.db)).toBeUndefined();
      const r = await reading(w, text);
      expect(r.kind === "refused" && r.refusals[0].code).toBe("tuning-notes-change");
      const before = await dump(w);
      expect((await importTab(w.song, text, "preset:bass5-a", w.ctx)).kind).toBe("changed");
      expect(await dump(w)).toBe(before);
      expect(await resolveTuning(other, w.db), "FR-025: not any other song").toBeUndefined();
    });

    it("a band whose default was deleted: refused, and another song's notes keep their pitch", async () => {
      const w = await world("bass5-b", { isDefault: false });
      const other = await createSong(w.bandId, "Other", null, w.ctx);
      await holdNotes({ ...w, song: other }, [4]);
      const before = (await resolveTuning(other, w.db))!;
      const r = await reading(w, text);
      expect(r.kind === "refused" && r.refusals[0].code).toBe("tuning-notes-change");
      expect((await resolveTuning(other, w.db))!.id).toBe(before.id);
    });

    it("a one-song band with no tunings keeps its offer", async () => {
      const w = await world(null);
      const r = await reading(w, text);
      expect(r.kind === "ready" && r.fit.kind).toBe("offer");
    });
  });
});

describe("INV-019 undo: a deleted part leaves the song on the new tuning", () => {
  it("as the plan decides", async () => {
    const w = await world("bass5-b");
    const { part } = await imported(w, pasteOf(presetById("bass5-a")!));
    const tuningId = (await w.db.songs.get(w.song.id))!.tuningId;
    await patchRow("parts", part.id, { name: "x" }, w.ctx);
    await deleteRow("parts", part.id, w.ctx);
    expect((await w.db.songs.get(w.song.id))!.tuningId).toBe(tuningId);
    await insertRow(
      "parts",
      {
        id: newId(),
        bandId: w.bandId,
        songId: w.song.id,
        label: "Z",
        name: null,
        rank: "z0",
        variantOfPartId: null,
        notes: null,
      },
      w.ctx,
    );
    expect(await dump(w)).toContain('"Z"');
    expect(((await contextOf(w)).tuning as { id?: string } | null)?.id).toBe(tuningId);
  });
});
