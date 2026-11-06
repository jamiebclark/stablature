/**
 * What the plan tried before promising it, with a style tag and no source change. It measures and
 * writes, like candidate.audit.ts, and asserts nothing. Run with AUDIT_MATCH=plan-candidate.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { addChord, columns } from "../../../e2e/capture-surface-helpers";
import { addRests, selectColumns, selectionBar, startWith } from "../../../e2e/probe-helpers";
import { bar, n, seedSong, type Col } from "../../../e2e/reading-helpers";

const OUT = path.join(__dirname, "results");
const write = (name: string, data: unknown) => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify(data, null, 1));
};

/** The recovered rows from candidate.audit.ts, with every control on them at its touch floor. */
const FLOORS = `
  .h-dvh > header { height: 45px; padding-top: 0; padding-bottom: 0; }
  .h-dvh > header + div { display: none !important; }
  [data-testid="toolbar-stable"] { height: 46px; padding: 0 8px; }
  [data-testid="toolbar-contextual"], .h-dvh > .h-14 { height: 46px !important; padding: 0 8px !important; }
  [data-testid="toolbar-selection"] { height: 46px !important; padding: 0 4px !important; }
  .h-dvh > div.overflow-hidden.whitespace-nowrap, .h-dvh > div.flex-wrap.border-t { height: 26px; padding-top: 0; padding-bottom: 0; }
  .h-dvh > div.overflow-y-auto { padding-top: 4px; padding-bottom: 0; }
  [data-testid="toolbar-stable"] button, [data-testid="toolbar-contextual"] button, [data-testid="toolbar-selection"] button { height: 44px !important; min-height: 44px !important; }
  [data-testid="toolbar-stable"] button:last-child { margin-left: 4px; }
  [data-testid="toolbar-contextual"] > div { height: 44px; }
  [data-testid="toolbar-contextual"] > div > button { width: 32px; padding: 0; }
  [data-testid="toolbar-contextual"] > div > span { min-width: 36px; }
  [data-testid="toolbar-contextual"] > button { padding-left: 8px; padding-right: 8px; min-width: 44px; }
  [data-testid="toolbar-selection"] button[aria-label="Make a tuplet of 3"], [data-testid="toolbar-selection"] button[aria-label="Group with no number"] { min-width: 36px; }
  [data-testid="toolbar-selection"] button.text-danger { margin: 0 4px; }
`;

const rowFit = (page: Page, testId: string) =>
  page.getByTestId(testId).evaluate((el) => ({
    client: el.clientWidth,
    scroll: el.scrollWidth,
    height: Math.round(el.getBoundingClientRect().height * 10) / 10,
    kids: [...el.children].map((c) => {
      const r = c.getBoundingClientRect();
      return {
        n: c.getAttribute("aria-label") ?? c.textContent,
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        right: Math.round(r.right * 10) / 10,
      };
    }),
  }));

const fits = (page: Page) =>
  page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    const band = staff.parentElement!.parentElement!;
    return {
      band: Math.round(band.getBoundingClientRect().height * 10) / 10,
      staff: Math.round(staff.getBoundingClientRect().height * 10) / 10,
      overflow: band.scrollHeight - band.clientHeight,
      page: document.documentElement.scrollHeight - innerHeight,
    };
  });

const SIX = { family: "Guitar 6", preset: "E Standard", strings: 6 } as const;

test("rows at their floors, six strings", async ({ page }) => {
  await startWith(page, SIX);
  await page.setViewportSize({ width: 375, height: 667 });
  await addRests(page, 8);
  await selectColumns(page, 1, 3);
  await selectionBar(page).getByRole("button", { name: "Group with no number" }).click();
  await page.waitForTimeout(150);
  await addChord(page, 2, "Cmaj7");
  await page.addStyleTag({ content: FLOORS });
  await page.waitForTimeout(150);
  // The contextual row shows only with the cursor on a playable column that is not a rest group edge.
  const stable = await rowFit(page, "toolbar-stable");
  const contextual = (await page.getByTestId("toolbar-contextual").count()) ? await rowFit(page, "toolbar-contextual") : null;
  const atRest = await fits(page);
  await selectColumns(page, 1, 3);
  await page.waitForTimeout(150);
  write("plan-rows", { stable, contextual, atRest, selection: await rowFit(page, "toolbar-selection"), selecting: await fits(page) });
});

/** The status row's words, each measured in the row's own type. */
test("status words at 375", async ({ page }) => {
  await startWith(page, SIX);
  await page.setViewportSize({ width: 375, height: 667 });
  await addRests(page, 2);
  const widths = await page.evaluate(() => {
    const measure = (text: string, mono: boolean) => {
      const s = document.createElement("span");
      s.textContent = text;
      s.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-size:11.2px;${mono ? "font-family:var(--font-mono-face),monospace" : ""}`;
      document.body.append(s);
      const w = s.getBoundingClientRect().width;
      s.remove();
      return Math.round(w * 10) / 10;
    };
    const statuses = [
      "adding at the end", "adding at the start", "adding after the marked column", "stacking onto the marked column",
      "next note: hammer-on", "next note: pull-off", "next note: slide up", "next note: slide down",
      "stack + hammer-on", "stack + slide down", "a triplet needs three columns in one bar",
    ];
    return {
      statuses: Object.fromEntries(statuses.map((s) => [s, measure(s, false)])),
      chord10: measure("F#m7b5/Bb9", true),
      durations: Object.fromEntries(["quarter", "eighth", "sixteenth", "thirty-second", "dotted quarter", "dotted sixteenth"].map((d) => [d, measure(d, true)])),
    };
  });
  write("plan-status", widths);
});

const FONT = ".tab-staff { font-family: var(--font-mono-face), ui-monospace, monospace; }";

/** Which real font each thing draws in: `document.fonts.check` cannot fail, this can. */
async function platformFonts(page: Page, selectors: string[]) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const out: Record<string, string[]> = {};
  for (const selector of selectors) {
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    if (!nodeId) continue;
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    out[selector] = fonts.map((f) => f.familyName);
  }
  return out;
}

const long = (): Col[] =>
  Array.from({ length: 16 }, (_, i) => [
    n(3 + (i % 5), { d: "8", chord: i % 4 === 0 ? "Am7" : undefined }), n(5, { d: "8" }), n(7, { d: "8" }), n(5, { d: "8" }),
    n(3, { d: "8" }), n(5, { d: "8" }), n(7, { d: "8" }), n(8, { d: "8" }), bar(),
  ]).flat().slice(0, -1);

const tops = (page: Page) =>
  page.evaluate(() => {
    const y = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().top + scrollY) : null);
    const h = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().height) : null);
    const main = document.querySelector("main")!;
    return {
      main: y(main),
      header: h(main.querySelector("header")),
      sections: [...main.children].map((c) => ({ tag: c.tagName, y: y(c), h: h(c) })),
      firstStaff: y(document.querySelector('[data-testid="tab-staff"]')),
      staffHeight: h(document.querySelector('[data-testid="tab-staff"]')),
      topBar: h(document.body.querySelector("div.border-b")),
    };
  });

test("fonts, and where the reading views spend the screen, phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const { songUrl, playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: long() }], [{ part: "a", repeat: 2 }]);
  await page.goto(songUrl);
  await expect(page.getByTestId("tab-column").first()).toBeVisible();
  const song = await tops(page);
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-column").first()).toBeVisible();
  const play = await tops(page);
  const before = await platformFonts(page, ["body", "h1", ".tab-cell > span", ".font-mono"]);
  const column = () => page.getByTestId("tab-column").first().evaluate((el) => el.getBoundingClientRect().width);
  const widthBefore = await column();
  await page.addStyleTag({ content: FONT });
  await page.waitForTimeout(300);
  write("plan-fonts-tops", { song, play, before, after: await platformFonts(page, [".tab-cell > span"]), widthBefore, widthAfter: await column() });
});

const DENSE = `
  ${FONT}
  .tab-staff { font-size: 0.875rem; }
  .tab-staff [data-testid="tab-column"] { width: calc(1ch + 0.5rem) !important; }
  :root { --string-height: 1.3rem; }
`;

test.describe("mouse", () => {
  test.use({ hasTouch: false, isMobile: false, deviceScaleFactor: 1, viewport: { width: 1280, height: 800 } });
  test("density", async ({ page }) => {
    const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: long() }], [{ part: "a" }]);
    await page.goto(playUrl);
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    await page.addStyleTag({ content: FONT });
    await page.waitForTimeout(200);
    const read = () =>
      page.evaluate(() => ({
        fine: matchMedia("(pointer: fine)").matches,
        column: document.querySelector('[data-testid="tab-column"]')!.getBoundingClientRect().width,
        cell: document.querySelector(".tab-cell")!.getBoundingClientRect().height,
        strings: document.querySelector('[data-testid="tab-staff"]')!.getBoundingClientRect().height,
      }));
    const touch = await read();
    await page.addStyleTag({ content: DENSE });
    await page.waitForTimeout(200);
    write("plan-density", { touch, mouse: await read() });
  });
});

/** Wrapping with no script: bars in a wrapping flex row, and a clipped gutter of repeated labels. */
const WRAP = (bars: number, wide: boolean) => `<!doctype html><meta name="viewport" content="width=device-width"><style>
  * { box-sizing: border-box; min-width: 0; }
  body { margin: 0; font: 16px/1 monospace; }
  .staff { position: relative; padding-left: 20px; }
  .gutter { position: absolute; inset: 0 auto 0 0; width: 20px; overflow: hidden; }
  .gutter > div { margin-bottom: 8px; }
  .lines { display: flex; flex-wrap: wrap; row-gap: 8px; }
  .bar { display: flex; flex: 1 0 auto; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
  .filler { flex: 9999 0 0; }
  .col { flex: 1 0 auto; }
  .chord { height: 1.1rem; font-size: .7rem; white-space: nowrap; }
  .cell { height: 1.55rem; border-top: 1px solid #888; }
  </style><div class="staff" data-testid="staff"><div class="gutter" aria-hidden="true">${Array.from(
    { length: bars },
    () => `<div class="labels"><div class="chord"></div>${"<div class=cell>E</div>".repeat(6)}</div>`,
  ).join("")}</div><div class="lines">${Array.from(
    { length: bars },
    (_, b) =>
      `<div class="bar">${Array.from(
        { length: wide && b === 3 ? 90 : 8 },
        (_, c) => `<div class="col" style="width:19.2px"><div class="chord">${c === 0 ? "Am7" : ""}</div>${"<div class=cell>5</div>".repeat(6)}</div>`,
      ).join("")}</div>`,
  ).join("")}<div class="filler"></div></div></div>`;

for (const [width, wide] of [[375, false], [1280, false], [375, true], [1280, true]] as const) {
  test(`wrapping with no script at ${width}, ${wide ? "one wide bar" : "even bars"}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.setContent(WRAP(16, wide));
    const read = await page.evaluate(() => {
      const bars = [...document.querySelectorAll(".bar")].map((b) => b.getBoundingClientRect());
      const labels = [...document.querySelectorAll(".labels")].map((l) => l.getBoundingClientRect());
      const staff = document.querySelector(".staff")!.getBoundingClientRect();
      const lineTops = [...new Set(bars.map((b) => Math.round(b.top * 10) / 10))];
      const gaps = lineTops.map((y, i) => Math.abs(y - labels[i].top));
      const lastFill = bars.filter((b) => Math.round(b.top * 10) / 10 === lineTops.at(-1)).at(-1)!.right;
      const firstFill = bars.filter((b) => Math.round(b.top * 10) / 10 === lineTops[0]).at(-1)!.right;
      return {
        lines: lineTops.length,
        worstLabelOffset: Math.max(...gaps),
        pageScroll: document.documentElement.scrollWidth - innerWidth,
        staffBottom: staff.bottom,
        lastBarBottom: Math.max(...bars.map((b) => b.bottom)),
        visibleLabelBlocks: labels.filter((l) => l.top < staff.bottom - 1).length,
        firstLineRight: firstFill,
        lastLineRight: lastFill,
        wideBar: [...document.querySelectorAll(".bar")].map((b) => b.scrollWidth - b.clientWidth).filter((d) => d > 0),
      };
    });
    write(`plan-wrap-${width}-${wide ? "wide" : "even"}`, read);
  });
}

test("keeps the columns helper honest", async ({ page }) => {
  await startWith(page, SIX);
  await addRests(page, 1);
  await expect(columns(page)).toHaveCount(1);
});
