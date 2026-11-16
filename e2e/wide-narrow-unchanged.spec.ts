/**
 * INV-001 (spec 010): below 768px both pages draw as on `main`. Held to e2e/fixtures/narrow-before.json, which
 * wide-narrow-record.ts wrote from the unedited build. Never edit the fixture to make this pass.
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { seedSong, type EntrySpec, type PartSpec } from "./reading-helpers";
import { cols, seed } from "./rhythm-probe-helpers";
import { plainBars as bars, FIT_PARTS, seedFitSong } from "./wide-helpers";

test.setTimeout(600_000);

type Rects = Record<string, number[][]>;
const FIXTURE = JSON.parse(readFileSync("e2e/fixtures/narrow-before.json", "utf8")) as Record<
  string,
  { html: string; rects: Rects }
>;

/** Same four songs as the recorder. */
const SONGS: Record<string, { parts: PartSpec[]; entries: EntrySpec[] }> = {
  one: { parts: [{ key: "a", label: "A", columns: bars(3) }], entries: [{ part: "a" }] },
  "fit-once": { parts: FIT_PARTS, entries: [{ part: "a" }, { part: "a2" }, { part: "b" }, { part: "c" }] },
  variant: {
    parts: [
      { key: "a", label: "A", columns: bars(3) },
      { key: "a2", label: "A'", variantOf: "a", columns: bars(3, 4) },
    ],
    entries: [{ part: "a" }, { part: "a2" }],
  },
  sliced: { parts: [{ key: "a", label: "A", columns: bars(4) }], entries: [{ part: "a", fromBar: 2, toBar: 3 }] },
};

const SIZES = [
  { name: "375x667-touch", width: 375, height: 667, touch: true },
  { name: "412x915-touch", width: 412, height: 915, touch: true },
  { name: "767x1024-mouse", width: 767, height: 1024, touch: false },
];

const context = (browser: Browser, baseURL: string, s: { width: number; height: number; touch: boolean }) =>
  browser.newContext({ baseURL, viewport: { width: s.width, height: s.height }, hasTouch: s.touch, isMobile: s.touch });

/** Strips what spec 010 lists as additions from a markup string, and per-run identifiers; applied to both sides. */
const normalize = (page: Page, html: string) =>
  page.evaluate((src) => {
    const doc = new DOMParser().parseFromString(`<body>${src}</body>`, "text/html");
    const drop = '[data-testid="card-number"], [data-testid^="card-passes"], [data-testid="card-bars"], [data-testid="tab-ruler"], [data-testid="click-bar"]';
    doc.querySelectorAll(drop).forEach((el) => el.remove());
    doc.querySelectorAll("*").forEach((el) => {
      for (const a of ["id", "for", "aria-controls", "aria-labelledby", "aria-describedby", "data-card", "data-first-pass", "data-last-pass"]) {
        el.removeAttribute(a);
      }
      const keep = [...el.classList].filter((c) => c !== "reading-cards" && c !== "reading-card" && !c.startsWith("wide:"));
      if (keep.length) el.setAttribute("class", keep.join(" "));
      else el.removeAttribute("class");
    });
    return doc.body.innerHTML.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "UUID");
  }, html);

const liveMarkup = (page: Page) => page.evaluate(() => document.querySelector("main")!.outerHTML);

const rects = (page: Page) =>
  page.evaluate(() => {
    const r = (x: number) => Math.round(x * 10) / 10;
    const out: Record<string, number[][]> = {};
    const groups: Record<string, string> = {
      card: "main ol.grid > li, main ul.grid > li",
      staff: ".tab-staff",
      column: '[data-testid="tab-column"]',
      run: ".tab-bar-run",
    };
    for (const [name, sel] of Object.entries(groups)) {
      out[name] = [...document.querySelectorAll(sel)].map((el) => {
        const b = el.getBoundingClientRect();
        return [r(b.left + scrollX), r(b.top + scrollY), r(b.width), r(b.height)];
      });
    }
    return out;
  });

for (const size of SIZES) {
  for (const colorScheme of ["dark", "light"] as const) {
    test(`narrow layout equals main ${size.name} ${colorScheme}`, async ({ browser, baseURL }) => {
      for (const [song, spec] of Object.entries(SONGS)) {
        const ctx = await context(browser, baseURL!, size);
        const page = await ctx.newPage();
        await page.emulateMedia({ colorScheme });
        const { songUrl, playUrl } = await seedSong(page, spec.parts, spec.entries);
        for (const [pageName, url] of [["song", songUrl], ["play", playUrl]] as const) {
          const key = `${song} | ${size.name} | ${pageName}`;
          const before = FIXTURE[key];
          expect(before, key).toBeTruthy();
          await page.goto(url);
          await expect(page.getByTestId("tab-staff").first()).toBeVisible();
          await page.waitForTimeout(300);

          // (a) geometry
          const now = await rects(page);
          for (const name of Object.keys(before.rects)) {
            expect(now[name].length, `${key} ${name} count`).toBe(before.rects[name].length);
            now[name].forEach((rect, i) =>
              rect.forEach((v, j) => expect(Math.abs(v - before.rects[name][i][j]), `${key} ${name}[${i}][${j}]`).toBeLessThanOrEqual(0.5)),
            );
          }
          // (b) markup
          expect(await normalize(page, await liveMarkup(page)), `${key} markup`).toBe(await normalize(page, before.html));
          // (c) no wrapped staff on the song page; each li spans its list
          if (pageName === "song") {
            await expect(page.locator(".tab-staff-wrapped")).toHaveCount(0);
            const spans = await page.evaluate(() => {
              const ul = document.querySelector("main ul.grid")!.getBoundingClientRect();
              return [...document.querySelectorAll("main ul.grid > li")].map((li) => {
                const b = li.getBoundingClientRect();
                return [Math.abs(b.left - ul.left), Math.abs(b.right - ul.right)];
              });
            });
            for (const s of spans) s.forEach((d) => expect(d).toBeLessThanOrEqual(0.5));
          }
        }
        await ctx.close();
      }
    });
  }
}

test("no wrapped staff at 320 or 767 on the song page", async ({ browser, baseURL }) => {
  for (const width of [320, 767]) {
    const ctx = await context(browser, baseURL!, { width, height: 800, touch: width === 320 });
    const page = await ctx.newPage();
    const { songUrl } = await seedSong(page, SONGS.one.parts, SONGS.one.entries);
    await page.goto(songUrl);
    await expect(page.getByTestId("tab-staff").first()).toBeVisible();
    await expect(page.locator(".tab-staff-wrapped")).toHaveCount(0);
    await ctx.close();
  }
});

/** The held bar height (C2): the tallest state the bar can show, measured here once; main drew 93 running and 57 idle. */
const HELD: Record<number, number> = { 375: 97, 412: 97 };

test("click bar height unchanged below 768", async ({ browser, baseURL }) => {
  const recorded = (FIXTURE as unknown as Record<string, Record<string, { idle: number; running: number }>>).bar;
  for (const width of [375, 412]) {
    const ctx = await context(browser, baseURL!, { width, height: 900, touch: true });
    const page = await ctx.newPage();
    const { playUrl } = await seed(page, cols("q", "q", "|", "q", "q"), { bpm: 120 });
    await page.goto(playUrl);
    const bar = page.getByTestId("click-bar");
    await expect(bar).toBeVisible();
    await page.waitForTimeout(300);
    // C2 (plan.md Existing tests, spec 010 R11): the bar now holds one height, so idle is no longer the recorded
    // 57 but equals the bar's own running height, which is held to what main drew.
    const idle = (await bar.boundingBox())!.height;
    expect(idle).toBeGreaterThanOrEqual(44);
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await page.waitForTimeout(300);
    const running = (await bar.boundingBox())!.height;
    expect(Math.abs(idle - running)).toBeLessThanOrEqual(0.5);
    expect(running).toBe(HELD[width]);
    await ctx.close();
  }
});

// --- INV-001 the structural checks at sizes narrow-before.json has no recording for (review round 1) ---
for (const width of [320, 375, 767]) {
  test(`INV-001 one column and no wrap on the song page at ${width}`, async ({ page }) => {
    const { songUrl, playUrl } = await seedFitSong(page);
    await page.setViewportSize({ width, height: 800 });
    const bad: string[] = [];
    for (const [which, url] of [["song", songUrl], ["play", playUrl]] as const) {
      await page.goto(url);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const list = document.querySelector<HTMLElement>(".reading-cards")!;
        const lr = list.getBoundingClientRect();
        return {
          spans: [...list.children].map((li) => {
            const b = li.getBoundingClientRect();
            return Math.max(Math.abs(b.left - lr.left), Math.abs(b.right - lr.right));
          }),
          wrapped: document.querySelectorAll(".tab-staff-wrapped").length,
          line: list.style.getPropertyValue("--staff-line"),
          sideways: document.documentElement.scrollWidth - innerWidth,
          mainPadX: getComputedStyle(document.querySelector("main")!).paddingLeft,
        };
      });
      const at = `${which} ${width}`;
      if (m.spans.some((d) => d > 0.5)) bad.push(`${at}: a card does not span the list (${m.spans.join(",")})`);
      if (which === "song" && m.wrapped > 0) bad.push(`${at}: song page staff wraps`);
      if (m.line !== "") bad.push(`${at}: --staff-line written below 768 (${m.line})`);
      if (m.sideways > 0) bad.push(`${at}: page scrolls sideways by ${m.sideways}`);
      if (m.mainPadX !== "16px") bad.push(`${at}: main side padding ${m.mainPadX}, main drew 16px`);
    }
    expect(bad).toEqual([]);
  });
}
