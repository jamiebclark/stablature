/**
 * Round 2. INV-018's mix member at FR-026's own worst case: "A column of up to seven notes, with let-ring notes still
 * sounding beneath, MUST NOT clip or distort." `e2e/play-mix.spec.ts` measures part T's three-note chord on four
 * strings only (T065 also asked for "a let-ring chord on every string of the seeded tuning, plus an accent click").
 *
 * 120 bpm, part playback (Notes, Click and Loop on). Three bars of four let-ring chords on every string, one per beat,
 * so every chord lands on a click and each bar's first on an accent, and each new chord attacks while the last one's
 * 5 ms release is still sounding. Voicings:
 *   - Guitar 7 unison: six strings on E4 and the seventh on E3, all picked at one time, so their waves add in phase;
 *   - Guitar 7 open: an ordinary seven-string E chord;
 *   - Guitar 6 open: the open E chord every guitarist plays;
 *   - Bass 4 open: all four strings (T065's "every string of the seeded tuning").
 * Click-off controls separate the notes' own peak from the click's. The destination analyser is read in the page every
 * 10 ms from the tap for 9.5 s (count-in plus three bars).
 */
import { expect, test, type Page } from "@playwright/test";
import { installPlayRecorder, textToCols } from "../../../e2e/play-helpers";
import { seedSong } from "../../../e2e/reading-helpers";
import { setStoredTempo } from "../../../e2e/rhythm-probe-helpers";
import { openCluster } from "../../../e2e/usability-helpers";

const ring = (frets: number[]) => frets.map((f, s) => `${s}:${f}[let_ring]`).join("+");
const G7 = { family: "Guitar 7", preset: "B Standard" };
const G6 = { family: "Guitar 6", preset: "E Standard" };
const B4 = { family: "Bass 4", preset: "E Standard" };
const CASES = [
  { name: "guitar 7 unison", tuning: G7, chord: ring([0, 5, 9, 14, 19, 24, 17]), click: true },
  { name: "guitar 7 open", tuning: G7, chord: ring([0, 0, 1, 2, 2, 0, 5]), click: true },
  { name: "guitar 6 open", tuning: G6, chord: ring([0, 0, 1, 2, 2, 0]), click: true },
  { name: "bass 4 open", tuning: B4, chord: ring([0, 0, 0, 0]), click: true },
  { name: "guitar 7 unison, Click off", tuning: G7, chord: ring([0, 5, 9, 14, 19, 24, 17]), click: false },
  { name: "guitar 7 open, Click off", tuning: G7, chord: ring([0, 0, 1, 2, 2, 0, 5]), click: false },
  { name: "guitar 6 open, Click off", tuning: G6, chord: ring([0, 0, 1, 2, 2, 0]), click: false },
];

async function useTuning(page: Page, songUrl: string, tuning: { family: string; preset: string }) {
  await page.goto(songUrl);
  await page.getByRole("link", { name: "Band" }).first().click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}/tunings`);
  await page.getByRole("button", { name: tuning.family, exact: true }).click();
  await page.getByRole("button", { name: `Add ${tuning.preset}` }).first().click();
  await page.waitForTimeout(300);
  await page.goto(songUrl);
  const tools = page.getByTestId("panel-song-tools");
  if ((await tools.getAttribute("aria-expanded")) !== "true") await tools.click();
  const select = page.locator("select").first();
  const want = `${tuning.preset} (${tuning.family})`;
  const value = await select.evaluate(
    (el, w) => [...(el as HTMLSelectElement).options].find((o) => o.textContent === w)?.value ?? "",
    want,
  );
  expect(value, `a ${want} tuning to choose`).not.toBe("");
  await select.selectOption(value);
  await page.waitForTimeout(300);
}

for (const { name, tuning, chord, click } of CASES) {
  test(`let-ring chord on every string (${name}) on every beat: no sample over 1.0`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the mix is measured once, on desktop");
    test.setTimeout(90_000);
    await installPlayRecorder(page);
    const strings = chord.split("+").length;
    const barText = `${chord} ${chord} ${chord} ${chord} |`;
    const s = await seedSong(page, [{ key: "s", label: "S", columns: textToCols(`${barText} ${barText} ${barText}`) }], [
      { part: "s" },
    ]);
    await setStoredTempo(page, 120);
    await useTuning(page, s.songUrl, tuning);
    await page.goto(`${s.songUrl}/play/${s.parts.s}`);
    await expect(page.getByTestId("click-start")).toHaveText("Play");
    await expect(page.getByTestId("click-start")).toBeEnabled();
    if (!click) {
      await openCluster(page);
      await page.getByTestId("play-click").click();
      await expect(page.getByTestId("play-click")).toHaveAttribute("aria-pressed", "false");
    }
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
    await page.waitForTimeout(9_500);
    const peaks = await page.evaluate(() => (window as unknown as { __peaks: [number, number][] }).__peaks);
    const rec = await page.evaluate(() => (window as unknown as { __play: { osc: { type: string; hz: number }[] } }).__play);
    await page.getByTestId("click-stop").click();
    const notes = rec.osc.filter((o) => o.type === "custom");
    const max = peaks.reduce((m, [, v]) => Math.max(m, v), 0);
    const over = peaks.filter(([, v]) => v > 1).map(([t, v]) => `${t.toFixed(2)} s: ${v.toFixed(3)}`);
    // The loudest read in each half second, so the report shows the count-in apart from the chords.
    const halves = new Map<number, number>();
    for (const [t, v] of peaks) halves.set(Math.floor(t * 2) / 2, Math.max(halves.get(Math.floor(t * 2) / 2) ?? 0, v));
    const line = [...halves].map(([t, v]) => `${t.toFixed(1)}:${v.toFixed(2)}`).join(" ");
    console.log(`MIX ${name}: ${notes.length} note sources, ${peaks.length} reads, peak ${max.toFixed(3)}\n  ${line}`);
    expect(notes.length, `${strings} notes a chord were played`).toBeGreaterThanOrEqual(strings * 8);
    expect(peaks.length, "the run was read").toBeGreaterThan(300);
    expect({ peak: Number(max.toFixed(3)), over: over.slice(0, 12) }).toEqual({ peak: Math.min(Number(max.toFixed(3)), 1), over: [] });
  });
}
