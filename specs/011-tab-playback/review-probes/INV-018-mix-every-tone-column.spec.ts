/**
 * Round 3. INV-018's mix member over every tone the synth makes, not only `plain`. FR-026: "A column of up to seven
 * notes, with let-ring notes still sounding beneath, MUST NOT clip or distort." Round 2's probe (and the adopted
 * `e2e/play-mix.spec.ts`) chord the `plain` tone only. The other three tones have higher peaks in `synth.ts`'s `PEAK`
 * (`muted` 0.5, `harmonic` 0.5, `dead` 0.6 against `plain` 0.45). Every thud also plays the one shared noise buffer from
 * offset 0. On a six-string bass, three strings clamp their band to 150 Hz, so those three thuds are the same signal
 * and add in phase.
 *
 * 120 bpm, part playback. Three bars of one column on every string, on every beat:
 *   - dead: `x` on every string (the rhythm-guitar chug), guitar 7 with Click on and off, and bass 6 with Click off;
 *   - muted: `0[palm_mute]` on every string, guitar 7, Click off;
 *   - harmonic: `12[harmonic]` on every string, guitar 7, Click off (a harmonic sustains until the next note on its
 *     string);
 *   - mixed: a let-ring chord on beats 1 and 3 and a dead chug on beats 2 and 4, guitar 7, Click on.
 * The destination analyser is read in the page every 10 ms for 9.5 s from the tap.
 */
import { expect, test, type Page } from "@playwright/test";
import { installPlayRecorder, textToCols } from "../../../e2e/play-helpers";
import { seedSong } from "../../../e2e/reading-helpers";
import { setStoredTempo } from "../../../e2e/rhythm-probe-helpers";
import { openCluster } from "../../../e2e/usability-helpers";

const every = (n: number, cell: (s: number) => string) => Array.from({ length: n }, (_, s) => `${s}:${cell(s)}`).join("+");
const G7 = { family: "Guitar 7", preset: "B Standard", strings: 7 };
const B6 = { family: "Bass 6", preset: "B Standard", strings: 6 };
const ring7 = every(7, (s) => `${[0, 0, 1, 2, 2, 0, 5][s]}[let_ring]`);
const dead7 = every(7, () => "x");
const bar = (beats: string[]) => `${beats.join(" ")} |`;
const CASES = [
  { name: "guitar 7 dead chug", tuning: G7, bar: bar(Array(4).fill(dead7)), click: true, sources: "buffer" },
  { name: "guitar 7 dead chug, Click off", tuning: G7, bar: bar(Array(4).fill(dead7)), click: false, sources: "buffer" },
  { name: "bass 6 dead chug, Click off", tuning: B6, bar: bar(Array(4).fill(every(6, () => "x"))), click: false, sources: "buffer" },
  { name: "guitar 7 palm-muted, Click off", tuning: G7, bar: bar(Array(4).fill(every(7, () => "0[palm_mute]"))), click: false, sources: "custom" },
  { name: "guitar 7 harmonics, Click off", tuning: G7, bar: bar(Array(4).fill(every(7, () => "12[harmonic]"))), click: false, sources: "custom" },
  { name: "guitar 7 let-ring then chug", tuning: G7, bar: bar([ring7, dead7, ring7, dead7]), click: true, sources: "custom" },
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

for (const { name, tuning, bar: barText, click, sources } of CASES) {
  test(`a column on every string (${name}) on every beat: no sample over 1.0`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the mix is measured once, on desktop");
    test.setTimeout(90_000);
    await installPlayRecorder(page);
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
    const rec = await page.evaluate(
      () => (window as unknown as { __play: { osc: { type: string }[]; buffers?: unknown[] } }).__play,
    );
    await page.getByTestId("click-stop").click();
    const custom = rec.osc.filter((o) => o.type === "custom").length;
    const max = peaks.reduce((m, [, v]) => Math.max(m, v), 0);
    const over = peaks.filter(([, v]) => v > 1).map(([t, v]) => `${t.toFixed(2)} s: ${v.toFixed(3)}`);
    const halves = new Map<number, number>();
    for (const [t, v] of peaks) halves.set(Math.floor(t * 2) / 2, Math.max(halves.get(Math.floor(t * 2) / 2) ?? 0, v));
    const line = [...halves].map(([t, v]) => `${t.toFixed(1)}:${v.toFixed(2)}`).join(" ");
    console.log(`MIX ${name}: ${custom} custom sources, ${peaks.length} reads, peak ${max.toFixed(3)}\n  ${line}`);
    if (sources === "custom") expect(custom, "the pitched notes were played").toBeGreaterThanOrEqual(tuning.strings * 4);
    expect(peaks.length, "the run was read").toBeGreaterThan(300);
    expect(max, "the notes sounded").toBeGreaterThan(0.05);
    expect({ peak: Number(max.toFixed(3)), over: over.slice(0, 12) }).toEqual({ peak: Math.min(Number(max.toFixed(3)), 1), over: [] });
  });
}
