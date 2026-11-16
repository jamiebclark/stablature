/**
 * Spec 010 research R2/R3, second pass: the fit song in a 4-string tuning with the panels closed, laid out
 * two to a row under tighter card chrome, on both pages. measure-fit.probe.ts showed that only one-line cards
 * two to a row can fit 1280x800 (three to a row wraps every 4-bar card onto two lines). This pass measures how
 * much chrome that leaves. Records only; writes measure-fit-tight.json.
 */
import { expect, test, type Page } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { bar, n, seedSong, type Col, type EntrySpec } from "../../../e2e/reading-helpers";
import { recorder, setStoredTempo } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(300_000);

const OUT = "specs/010-wide-reading-layout/research-probes/measure-fit-tight.json";

const eighths = (frets: number[], over: Col = {}): Col[] => frets.map((f) => n(f, { d: "8", ...over }));
const barOf = (base: number): Col[] => eighths([base, base + 2, base, base + 2, base + 3, base + 2, base, base + 2]);

/** As data-model.md's fit song: single-digit frets, one chord and one plain group in A. */
const A: Col[] = [
  n(3, { d: "8", chord: "Em7" }),
  n(5, { d: "8", tupletId: "p1", tupletCount: null, groupKind: "plain" }),
  n(3, { d: "8", tupletId: "p1", tupletCount: null, groupKind: "plain" }),
  ...eighths([5, 6, 5, 3, 5]),
  bar(),
  ...barOf(3),
  bar(),
  ...barOf(5),
  bar(),
  ...barOf(3),
];
const A2: Col[] = [...A.slice(0, A.length - 8), ...barOf(4)];
const B: Col[] = [...barOf(5), bar(), ...barOf(6), bar(), ...barOf(5), bar(), ...barOf(2)];
const C: Col[] = [...barOf(2), bar(), ...barOf(3)];

const section = (label: string) => ({ kind: "section_start", label, repeat: 1 }) as unknown as EntrySpec;
const end = { kind: "section_end" } as unknown as EntrySpec;
const ENTRIES: EntrySpec[] = [
  section("Verse"),
  { part: "a", repeat: 4, last: "a2" },
  end,
  { part: "b", repeat: 2 },
  { part: "a", repeat: 2 },
  section("Outro"),
  { part: "c" },
  end,
  { part: "b" },
];
const FOLDED = [1, 2, 5, 7];

const SIZES = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
];

interface Variant {
  name: string;
  side: number;
  pad: number;
  gap: number;
  cols: number;
}
const VARIANTS: Variant[] = [];
for (const cols of [2, 3])
  for (const side of [16, 12])
    for (const pad of [12, 8, 6])
      for (const gap of [12, 8]) VARIANTS.push({ name: `${cols} cols, side ${side}, pad ${pad}, gap ${gap}`, side, pad, gap, cols });

const cssFor = (v: Variant, list: string, card: string, width: string) => `
  main { max-width: ${width} !important; padding-left: ${v.side}px !important; padding-right: ${v.side}px !important; }
  ${list} { display: grid !important; grid-template-columns: repeat(${v.cols}, minmax(0, 1fr)) !important; gap: ${v.gap}px !important; align-items: start; }
  ${card} { padding: ${v.pad}px !important; }`;

const figures = (page: Page, itemSel: string) =>
  page.evaluate((sel) => {
    const r = (x: number) => Math.round(x * 10) / 10;
    const items = [...document.querySelectorAll(sel)].filter((li) => (li as HTMLElement).style.display !== "none");
    const cards = items.map((li) => {
      const box = li.getBoundingClientRect();
      const runs = [...li.querySelectorAll(".tab-bar-run")];
      const tops = new Set(runs.map((run) => Math.round(run.getBoundingClientRect().top)));
      const scroller = li.querySelector('.tab-staff [role="group"]') as HTMLElement | null;
      return {
        top: r(box.top + scrollY),
        width: r(box.width),
        height: r(box.height),
        lines: runs.length ? tops.size : 1,
        scrolls: scroller ? scroller.scrollWidth > scroller.clientWidth + 1 : false,
        need: scroller ? scroller.scrollWidth : null,
        have: scroller ? scroller.clientWidth : null,
      };
    });
    const barEl = document.querySelector('[data-testid="click-bar"]');
    return {
      innerHeight,
      firstTop: cards.length ? cards[0].top : null,
      lastBottom: cards.length ? r(Math.max(...cards.map((c) => c.top + c.height))) : null,
      bar: barEl ? r(barEl.getBoundingClientRect().height) : null,
      cards,
    };
  }, itemSel);

async function addFourString(page: Page, songUrl: string) {
  await page.goto(songUrl);
  await page.getByRole("link", { name: "Band" }).first().click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  await page.goto(`${page.url()}/tunings`);
  await page.getByRole("button", { name: "Bass 4", exact: true }).click();
  await page.getByRole("button", { name: "Add E Standard" }).first().click();
  await page.waitForTimeout(300);
  await page.goto(songUrl);
  const tools = page.getByTestId("panel-song-tools");
  if ((await tools.getAttribute("aria-expanded")) !== "true") await tools.click();
  const select = page.locator("select").first();
  const value = await select.evaluate((el) =>
    [...(el as HTMLSelectElement).options].find((o) => /E Standard/.test(o.textContent ?? ""))?.value ?? "",
  );
  await select.selectOption(value);
  await page.waitForTimeout(300);
  await tools.click();
  await expect(tools).toHaveAttribute("aria-expanded", "false");
}

test("measure the 4-string fit song two to a row under tighter chrome", async ({ page, isMobile }) => {
  test.skip(isMobile, "the fit target is measured with a mouse");
  await recorder(page);
  const { songUrl, playUrl } = await seedSong(
    page,
    [
      { key: "a", label: "A", columns: A },
      { key: "a2", label: "A'", variantOf: "a", columns: A2 },
      { key: "b", label: "B", columns: B },
      { key: "c", label: "C", columns: C },
    ],
    ENTRIES,
  );
  await setStoredTempo(page, 120);
  await addFourString(page, songUrl);
  const out: Record<string, unknown> = {};

  for (const size of SIZES) {
    await page.setViewportSize(size);
    const key = `${size.width}x${size.height}`;

    await page.goto(playUrl);
    await expect(page.locator("main ol.grid > li")).toHaveCount(10);
    await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
    await page.waitForTimeout(300);
    const strings = await page.evaluate(() => document.querySelector(".tab-gutter-block")?.querySelectorAll(".tab-cell").length);
    const header = await page.evaluate(() => ({
      topBar: Math.round(document.querySelector("main")!.getBoundingClientRect().top),
      header: Math.round(document.querySelector("main header")!.getBoundingClientRect().height),
    }));
    await page.evaluate((folded) => {
      const items = [...document.querySelectorAll("main ol.grid > li")] as HTMLElement[];
      for (const i of folded) items[i].style.display = "none";
      const style = document.createElement("style");
      style.id = "probe";
      document.head.appendChild(style);
    }, FOLDED);
    const play: Record<string, unknown> = {};
    for (const v of VARIANTS) {
      await page.evaluate((css) => {
        document.getElementById("probe")!.textContent = css;
        window.scrollTo(0, 0);
      }, cssFor(v, "main ol.grid", "main ol.grid > li > div", "96rem"));
      await page.waitForTimeout(120);
      play[v.name] = await figures(page, "main ol.grid > li");
    }

    await page.goto(songUrl);
    await expect(page.getByTestId("tab-staff")).toHaveCount(4);
    await page.waitForTimeout(300);
    const chrome = await page.evaluate(() => {
      const r = (x: number) => Math.round(x * 10) / 10;
      const main = document.querySelector("main")!;
      const [arr, parts] = [...main.querySelectorAll(":scope > section")];
      return {
        tools: r(document.querySelector('[data-testid="panel-song-tools"]')!.getBoundingClientRect().height),
        arrangementHeight: r(arr.getBoundingClientRect().height),
        partsTop: r(parts.getBoundingClientRect().top + scrollY),
      };
    });
    await page.evaluate(() => {
      const style = document.createElement("style");
      style.id = "probe";
      document.head.appendChild(style);
    });
    const song: Record<string, unknown> = {};
    for (const v of VARIANTS) {
      await page.evaluate((css) => {
        document.getElementById("probe")!.textContent = css;
        window.scrollTo(0, 0);
      }, cssFor(v, "main ul.grid", "main ul.grid > li > div", "96rem"));
      await page.waitForTimeout(120);
      const f = await figures(page, "main ul.grid > li");
      const extra = await page.evaluate(() => {
        const r = (x: number) => Math.round(x * 10) / 10;
        const main = document.querySelector("main")!;
        const [arr, parts] = [...main.querySelectorAll(":scope > section")];
        return {
          arrangementHeight: r(arr.getBoundingClientRect().height),
          partsTop: r(parts.getBoundingClientRect().top + scrollY),
          scrollHeight: document.documentElement.scrollHeight,
        };
      });
      song[v.name] = { ...f, ...extra };
    }
    out[key] = { strings, header, play, songChrome: chrome, song };
  }
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
});
