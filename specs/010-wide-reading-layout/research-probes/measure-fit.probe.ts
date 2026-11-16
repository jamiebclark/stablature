/**
 * Spec 010 research R2/R3: the fit figures, measured on the UNEDITED tree.
 *
 * Seeds the fit song (spec.md, Success Criteria), opens both pages at 1280x800 and 1440x900 with a mouse,
 * and records what today draws. For the play view it also hides the four passes FR-014 would fold away
 * and lays the six remaining cards out under candidate packings with injected CSS, so the packing choice
 * in research.md R3 rests on measured heights, not estimates. Records only; writes measure-fit.json.
 *
 * Run once against a fresh build: `npx playwright test -c specs/010-wide-reading-layout/research-probes/probe.config.ts`.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { bar, n, seedSong, type Col, type EntrySpec } from "../../../e2e/reading-helpers";
import { recorder, setStoredTempo } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(240_000);

const OUT = "specs/010-wide-reading-layout/research-probes/measure-fit.json";

const eighths = (frets: number[], over: Col = {}): Col[] => frets.map((f) => n(f, { d: "8", ...over }));
const barOf = (base: number): Col[] => eighths([base, base + 2, base, base + 2, base + 3, base + 2, base, base + 2]);

/** A: 4 bars, one chord on its first column and one plain group of two. */
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
/** A': A with its last bar different. */
const A2: Col[] = [...A.slice(0, A.length - 8), ...barOf(7)];
const B: Col[] = [...barOf(7), bar(), ...barOf(8), bar(), ...barOf(7), bar(), ...barOf(5)];
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

/** Passes FR-014 folds into the card before them: A 2nd and 3rd, B 2nd, A 2nd of the second entry. */
const FOLDED = [1, 2, 5, 7];

const SIZES = [
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
];

const PACKINGS = [
  { name: "today (one per row)", css: "" },
  ...[2, 3].flatMap((cols) =>
    [16, 12, 8].flatMap((gap) =>
      [12, 8].map((pad) => ({
        name: `${cols} columns, gap ${gap}, card padding ${pad}`,
        css: `main ol.grid { grid-template-columns: repeat(${cols}, minmax(0, 1fr)); gap: ${gap}px; align-items: start; }
              main ol.grid > li > div { padding: ${pad}px; }`,
      })),
    ),
  ),
];

const playFigures = (page: Page) =>
  page.evaluate(() => {
    const r = (x: number) => Math.round(x * 10) / 10;
    const items = [...document.querySelectorAll("main ol.grid > li")].filter(
      (li) => (li as HTMLElement).style.display !== "none",
    );
    const barEl = document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect();
    const header = document.querySelector("main header, main > div")!.getBoundingClientRect();
    const cards = items.map((li) => {
      const box = li.getBoundingClientRect();
      const runs = [...li.querySelectorAll(".tab-bar-run")];
      const tops = new Set(runs.map((run) => Math.round(run.getBoundingClientRect().top)));
      const head = li.querySelector("div > div")!.getBoundingClientRect();
      const staff = li.querySelector('[data-testid="tab-staff"]')!.getBoundingClientRect();
      return {
        top: r(box.top),
        left: r(box.left),
        width: r(box.width),
        height: r(box.height),
        lines: tops.size,
        headRow: r(head.height),
        staff: r(staff.height),
        runWidths: runs.map((run) => r(run.getBoundingClientRect().width)),
      };
    });
    return {
      innerHeight,
      innerWidth,
      scrollHeight: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollHeight - innerHeight,
      mainWidth: r(document.querySelector("main")!.getBoundingClientRect().width),
      headerBottom: r(header.bottom),
      firstCardTop: cards.length ? cards[0].top + scrollY : null,
      barHeight: r(barEl.height),
      lastCardBottom: cards.length ? Math.max(...cards.map((c) => c.top + c.height)) + scrollY : null,
      cards,
    };
  });

const primitives = (page: Page) =>
  page.evaluate(() => {
    const r = (x: number) => Math.round(x * 100) / 100;
    const root = getComputedStyle(document.documentElement);
    const rem = parseFloat(root.fontSize);
    const tok = (name: string) => {
      const v = root.getPropertyValue(name).trim();
      return v.endsWith("rem") ? r(parseFloat(v) * rem) : v;
    };
    const columns = [...document.querySelectorAll('[data-testid="tab-column"]')] as HTMLElement[];
    const note = columns.find((c) => !c.hasAttribute("data-barline") && c.dataset.barline !== "true");
    const barline = columns.find((c) => c.dataset.barline === "true");
    const gutter = document.querySelector(".tab-gutter")?.getBoundingClientRect().width ?? null;
    return {
      stringHeight: tok("--string-height"),
      staffRow: tok("--staff-row"),
      rhythmRow: tok("--rhythm-row"),
      lineGap: tok("--line-gap"),
      noteColumn: note ? r(note.getBoundingClientRect().width) : null,
      barlineColumn: barline ? r(barline.getBoundingClientRect().width) : null,
      gutter: gutter === null ? null : r(gutter),
      strings: document.querySelector(".tab-gutter-block")?.querySelectorAll(".tab-cell").length ?? null,
    };
  });

test("measure the fit song on both pages, today and under candidate packings", async ({ page, isMobile }) => {
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
  const out: Record<string, unknown> = {};

  for (const size of SIZES) {
    for (const theme of ["dark", "light"] as const) {
      const key = `${size.width}x${size.height}-${theme}`;
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: theme });

      await page.goto(playUrl);
      await expect(page.locator("main ol.grid > li")).toHaveCount(10);
      await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
      await page.waitForTimeout(300);
      const prims = await primitives(page);
      const today = await playFigures(page);

      // The bar at rest, then running (the help line is added below the controls).
      const rest = (await page.getByTestId("click-bar").boundingBox())!.height;
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await page.waitForTimeout(200);
      const running = (await page.getByTestId("click-bar").boundingBox())!.height;
      await page.getByTestId("click-stop").click();
      await expect(page.getByTestId("click-start")).toBeVisible();

      await page.evaluate((folded) => {
        const items = [...document.querySelectorAll("main ol.grid > li")] as HTMLElement[];
        for (const i of folded) items[i].style.display = "none";
        const style = document.createElement("style");
        style.id = "probe-packing";
        document.head.appendChild(style);
      }, FOLDED);
      const packings: Record<string, unknown> = {};
      for (const packing of PACKINGS) {
        await page.evaluate((css) => {
          document.getElementById("probe-packing")!.textContent = css;
          window.scrollTo(0, 0);
        }, packing.css);
        await page.waitForTimeout(150);
        packings[packing.name] = await playFigures(page);
      }

      await page.goto(songUrl);
      await expect(page.getByTestId("tab-staff")).toHaveCount(4);
      await page.waitForTimeout(300);
      const song = await page.evaluate(() => {
        const r = (x: number) => Math.round(x * 10) / 10;
        const main = document.querySelector("main")!;
        const sections = [...main.querySelectorAll(":scope > section")].map((s) => r(s.getBoundingClientRect().height));
        const cards = [...main.querySelectorAll("ul.grid > li")].map((li) => {
          const box = li.getBoundingClientRect();
          const head = li.querySelector("div > div")!.getBoundingClientRect();
          const staff = li.querySelector('[data-testid="tab-staff"]')!.getBoundingClientRect();
          const scroller = li.querySelector('[role="group"]') as HTMLElement;
          return {
            height: r(box.height),
            width: r(box.width),
            headRow: r(head.height),
            staff: r(staff.height),
            oneLineWidth: scroller ? scroller.scrollWidth : null,
          };
        });
        const arrangement = main.querySelectorAll(":scope > section")[0]?.getBoundingClientRect();
        const parts = main.querySelectorAll(":scope > section")[1]?.getBoundingClientRect();
        return {
          mainWidth: r(main.getBoundingClientRect().width),
          scrollHeight: document.documentElement.scrollHeight,
          innerHeight,
          arrangementTop: arrangement ? r(arrangement.top) : null,
          arrangementHeight: arrangement ? r(arrangement.height) : null,
          partsTop: parts ? r(parts.top) : null,
          sections,
          cards,
        };
      });

      out[key] = { primitives: prims, play: { today, barRest: rest, barRunning: running, packings }, song };
    }
  }

  mkdirSync("specs/010-wide-reading-layout/research-probes", { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
});
