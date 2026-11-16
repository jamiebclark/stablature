/**
 * INV-004 over the part of the plan's Corpus that `stream.test.ts` S4 does not run: notation-oracle section G's 6000
 * seeded arrangements through the real expansion and bar slicing. For every column the click's notation reading
 * times (`notationColumns`), the play timeline's hit with the same (pass, eventId, repetition) starts on the same
 * tick. Also: the timeline never drops a column the click times.
 */
import { describe, expect, it } from "vitest";
import { expandArrangement, parseArrangement } from "@/lib/arrangement/expand";
import { drawnPasses } from "@/lib/arrangement/passes";
import { playTimeline } from "@/lib/playback/timeline";
import { notationColumns } from "@/lib/rhythm/notation";
import { presetById } from "@/lib/tunings";
import { buildSong } from "./seeded-songs";

const bass = presetById("bass4-e")!;

describe("INV-004 notes start on the click's tick, notation-oracle G", () => {
  it("6000 seeded arrangements", { timeout: 120_000 }, () => {
    let timedColumns = 0;
    for (let seed = 1; seed <= 6000; seed++) {
      const { entries, byPart } = buildSong(seed);
      const passes = drawnPasses(expandArrangement(parseArrangement(entries)), byPart);
      const hits = new Map(playTimeline(passes, bass).hits.map((h) => [`${h.pass}:${h.eventId}:${h.repetition}`, h.tick]));
      for (const c of notationColumns(passes)) {
        const key = `${c.pass}:${c.eventId}:${c.repetition}`;
        expect(hits.has(key), `seed ${seed} ${key} missing`).toBe(true);
        expect(hits.get(key), `seed ${seed} ${key}`).toBe(c.tick);
        timedColumns++;
      }
    }
    expect(timedColumns).toBeGreaterThan(10_000);
  });
});
