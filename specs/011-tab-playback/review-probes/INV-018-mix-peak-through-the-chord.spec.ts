/**
 * INV-018's mix member: "during part T's let-ring chord plus three more notes plus an accent click, the analyser's
 * peak sample is <= 1.0". `e2e/play-mix.spec.ts` samples the first 4 s only, and part T's chord (column 13) sounds at
 * count-in 2 s + 6.5 s. This reads the destination analyser in the page every 10 ms (its 2048-sample window is
 * ~43 ms, so the reads overlap) from the tap until column 22, and reports the peak inside the chord window
 * (columns 13 to 19) and over the whole stretch.
 */
import { expect, test } from "@playwright/test";
import { installPlayRecorder, noteStarts, playRecord, seedPlaybackSong } from "../../../e2e/play-helpers";

test("part T: no sample over 1.0 from the first note through the let-ring chord and the harmonics", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the mix is measured once, on desktop");
  test.setTimeout(60_000);
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await page.goto(`${s.songUrl}/play/${s.parts.t}`);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.evaluate(() => {
    const w = window as unknown as { __peaks: [number, number][]; __analysers?: AnalyserNode[] };
    w.__peaks = [];
    const buf = new Float32Array(2048);
    setInterval(() => {
      const a = w.__analysers?.[0];
      if (!a || a.context.state !== "running") return;
      a.getFloatTimeDomainData(buf);
      let m = 0;
      for (const v of buf) m = Math.max(m, Math.abs(v));
      w.__peaks.push([a.context.currentTime, m]);
    }, 10);
  });
  await page.getByTestId("click-start").click();
  await page.waitForTimeout(13_500);
  const peaks = await page.evaluate(() => (window as unknown as { __peaks: [number, number][] }).__peaks);
  const t0 = noteStarts(await playRecord(page))[0].when;
  await page.getByTestId("click-stop").click();
  const inChord = peaks.filter(([t]) => t >= t0 + 13 * 0.5 && t <= t0 + 20 * 0.5);
  const max = (xs: [number, number][]) => xs.reduce((m, [, v]) => Math.max(m, v), 0);
  expect(inChord.length, "the chord window was read").toBeGreaterThan(100);
  // Every read over 1.0, as "column c: peak", so the report shows where the mix clips and by how much.
  const over = peaks
    .filter(([, v]) => v > 1)
    .map(([t, v]) => `column ${Math.floor((t - t0) / 0.5)}: ${v.toFixed(3)}`)
    .filter((x, i, xs) => xs.indexOf(x) === i);
  expect({ chordPeak: Number(max(inChord).toFixed(3)), over }).toEqual({
    chordPeak: Math.min(Number(max(inChord).toFixed(3)), 1),
    over: [],
  });
});
