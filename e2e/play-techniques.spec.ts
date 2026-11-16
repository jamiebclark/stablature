/**
 * Spec 011 US5, INV-005 (e2e): part T's techniques sound as the table says. Every column is a quarter at 120 bpm, so
 * column `i` of the part (bars are not columns) sounds `0.5 × i` s after the first note.
 */
import { expect, test } from "@playwright/test";
import { installPlayRecorder, noteStarts, playRecord, seedPlaybackSong } from "./play-helpers";

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const COLUMN_S = 0.5;
/** Part T's columns: hammer-on 1, slide up 3, pull-off 7, vibrato 8, bend 20, taps 21 and 22. */
const CONNECTED = [1, 3, 7];

test("part T's techniques reach the audio graph as the table says", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "INV-005 runs on desktop");
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(`${s.songUrl}/play/${s.parts.t}`);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.getByTestId("click-start").click();
  await page.waitForTimeout(15000);
  const rec = await playRecord(page);
  const notes = noteStarts(rec);
  expect(notes.length).toBeGreaterThan(10);
  const t0 = notes[0].when;
  const at = (col: number) => t0 + col * COLUMN_S;
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02;

  // Hammer-on, slide and pull-off join the sounding string: no new pitched start.
  for (const col of CONNECTED) expect(notes.some((n) => near(n.when, at(col)))).toBe(false);
  // The slide's glide is a ramp that ends at the target's start.
  expect(rec.freq.some((f) => f.kind === "ramp" && near(f.when, at(3)) && Math.abs(f.value - hz(37)) < 0.01)).toBe(true);
  // Vibrato is a sine LFO on top of the pitched voice.
  expect(rec.osc.some((o) => o.type === "sine" && near(o.when, at(8)))).toBe(true);
  // The two x columns, the muted x and the dead note are buffer sources, not oscillators.
  expect(rec.thuds.length).toBeGreaterThanOrEqual(4);
  for (const col of [11, 12, 24, 25]) expect(rec.thuds.some((t) => near(t.when, at(col)))).toBe(true);
  // Bend and tap are plain: the frequency set at each is a plain 7's (B1, midi 35).
  for (const col of [20, 21, 22]) {
    const sets = rec.freq.filter((f) => f.kind === "set" && near(f.when, at(col)));
    expect(sets.length).toBeGreaterThan(0);
    for (const f of sets) expect(f.value).toBeCloseTo(hz(35), 2);
    expect(rec.freq.some((f) => f.kind === "ramp" && near(f.when, at(col)))).toBe(false);
  }
});
