/** Spec 013 US5 probes: INV-012 (a chord symbol prints whole, or breaks inside its card) and INV-013 (print cards: whole, ordered, greedy-ish). */
import { expect, test, type Page } from "@playwright/test";
import { seedLongChord, seedManyChord } from "./cards-helpers";
import { bar, n, seedSong, type Col } from "./reading-helpers";
import { drawn, greedy, measure, own, settle } from "./cards-print-measure";
import { FOLD, seedFitSong, seedFold, seedWideSong } from "./wide-helpers";

test.setTimeout(300_000);

const PRN = [718, 1047];
const THEMES = ["dark", "light"] as const;
type Urls = { songUrl: string; playUrl: string };
const F5 = FOLD.find((r) => r.id === "F5")!;

async function printAt(page: Page, url: string, theme: "dark" | "light", width: number) {
  await page.emulateMedia({ colorScheme: theme });
  await page.setViewportSize({ width, height: 900 });
  await page.goto(url);
  await page.waitForLoadState("load");
  await page.evaluate(() => document.fonts.ready);
  await page.emulateMedia({ media: "print", colorScheme: theme });
  await page.waitForTimeout(250);
}

/** Every chord symbol's line count and whether it stays inside its card and the paper. */
const chords = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="tab-column"] > div.text-accent')]
      .filter((e) => (e.textContent ?? "").trim() !== "")
      .map((e) => {
        const card = e.closest("li") ?? e.closest(".reading-card") ?? document.body;
        const range = document.createRange();
        range.selectNodeContents(e);
        const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
        return {
          text: (e.textContent ?? "").trim(),
          lines: tops.size,
          left: e.getBoundingClientRect().left,
          right: e.getBoundingClientRect().right,
          limit: Math.min(card.getBoundingClientRect().right, innerWidth),
          // The song page keeps a scrolling staff (spec 010); paper clips it there, so a symbol is judged against the clip too.
          clip: (e.closest<HTMLElement>(".overflow-x-auto")?.getBoundingClientRect().right ?? Infinity),
        };
      }),
  );

for (const theme of THEMES) {
  for (const width of PRN) {
    for (const pg of ["songUrl", "playUrl"] as const) {
      test(`INV-012: fit chords print whole: ${theme} ${width} ${pg}`, async ({ page }) => {
        const urls = (await seedManyChord(page)) as unknown as Urls;
        await printAt(page, urls[pg], theme, width);
        const cs = await chords(page);
        expect(cs.length).toBeGreaterThan(0);
        expect(cs.some((c) => c.text === "Em7")).toBe(true);
        for (const c of cs.filter((x) => x.left < x.clip)) {
          expect(c.lines, `${c.text} on one line`).toBeLessThanOrEqual(1.05);
          expect(c.right, `${c.text} inside`).toBeLessThanOrEqual(c.limit + 0.5);
        }
      });
      test(`INV-012: a 40-character symbol breaks inside its card: ${theme} ${width} ${pg}`, async ({ page }) => {
        const urls = (await seedLongChord(page)) as unknown as Urls;
        await printAt(page, urls[pg], theme, width);
        const cs = await chords(page);
        expect(cs.length).toBeGreaterThan(0);
        for (const c of cs.filter((x) => x.left < x.clip)) expect(c.right, `${c.text} inside`).toBeLessThanOrEqual(c.limit + 0.5);
      });
    }
  }
}

for (const theme of THEMES) {
  for (const song of ["fit", "short", "F5"] as const) {
    test(`INV-013: print cards whole and in order: ${song} ${theme}`, async ({ page }) => {
      const urls = (song === "fit" ? await seedFitSong(page) : song === "F5" ? await seedFold(page, F5) : await seedWideSong(page, "short")) as unknown as Urls;
      for (const width of PRN) {
        await printAt(page, urls.playUrl, theme, width);
        await expect(page.locator("ol.reading-cards > li").first()).toBeAttached();
        const info = await page.evaluate(() => {
          const lis = [...document.querySelectorAll<HTMLElement>("ol.reading-cards > li")];
          const shown = (li: Element, sel: string) => {
            const t = li.querySelector(sel);
            return t ? getComputedStyle(t).display !== "none" && getComputedStyle(t).visibility !== "hidden" : null;
          };
          const rects = lis.map((li) => li.getBoundingClientRect());
          return {
            n: lis.length,
            avoid: lis.every((li) => getComputedStyle(li).breakInside === "avoid"),
            numbers: lis.every((li) => shown(li, '[data-testid="card-number"]')),
            rest: lis.map((li) => shown(li, '[data-testid="card-passes-rest"]')).filter((v) => v !== null),
            ordered: rects.every((r, i) => i === 0 || r.top > rects[i - 1].top + 0.5 || r.left >= rects[i - 1].right - 0.5),
            right: Math.max(...rects.map((r) => r.right)),
            scroll: document.documentElement.scrollWidth,
            vw: innerWidth,
          };
        });
        const where = `${song} ${theme} @${width}`;
        expect(info.avoid, where).toBe(true);
        expect(info.numbers, where).toBe(true);
        expect(info.rest.every(Boolean), where).toBe(true);
        expect(info.ordered, where).toBe(true);
        expect(info.right, where).toBeLessThanOrEqual(info.vw);
        expect(info.scroll, where).toBeLessThanOrEqual(info.vw);
      }
    });
  }
}

/** INV-012 / FR-017, FR-018 (review F1): an 80-character symbol prints without cutting its bar run or leaving its card. */
const q80 = (fret: number, over: Col = {}) => n(fret, { d: "q", ...over });
for (const theme of THEMES) {
  for (const width of [375, 820, 1280]) {
    for (const pg of ["songUrl", "playUrl"] as const) {
      test(`INV-012: an 80-character chord prints inside its run and card: ${theme} ${width} ${pg}`, async ({ page }) => {
        const urls = (await seedSong(
          page,
          [{ key: "a", label: "A", columns: [q80(3, { chord: "Cmaj7".repeat(16) }), q80(5), q80(3), q80(5), bar(), q80(3), q80(5), q80(3), q80(5)] }],
          [{ part: "a" }],
        )) as unknown as Urls;
        await printAt(page, urls[pg], theme, width);
        const r = await page.evaluate(() => {
          const runs = [...document.querySelectorAll<HTMLElement>(".tab-bar-run")];
          const past: string[] = [];
          for (const e of document.querySelectorAll<HTMLElement>('[data-testid="tab-column"]')) {
            // The narrow song page keeps spec 010's scrolling staff, which paper clips to its own box inside the card (FU6).
            if (e.closest(".overflow-x-auto")) continue;
            const card = e.closest("li") ?? e.closest(".reading-card") ?? document.body;
            const limit = Math.min(card.getBoundingClientRect().right, innerWidth);
            const chord = e.querySelector<HTMLElement>("div.text-accent");
            for (const el of [e, chord]) {
              if (!el) continue;
              if (el.getBoundingClientRect().right > limit + 0.5) past.push(`${el === e ? "column" : "chord"} ${Math.round(el.getBoundingClientRect().right)} > ${Math.round(limit)}`);
            }
          }
          return { cut: runs.filter((x) => x.scrollWidth > x.clientWidth + 1 && !x.closest(".overflow-x-auto")).length, past };
        });
        expect(r.cut, "runs cut").toBe(0);
        expect(r.past).toEqual([]);
      });
    }
  }
}

/** INV-013 / FR-019 (review F2): print draws FR-007's greedy rows of FR-003's own widths, one line wherever a card's own width fits the row. */
const seeds: Record<string, (p: Page) => Promise<unknown>> = {
  fit: seedFitSong,
  short: (p) => seedWideSong(p, "short"),
  long: (p) => seedWideSong(p, "long"),
  F5: (p) => seedFold(p, F5),
};
for (const [song, seed] of Object.entries(seeds)) {
  for (const theme of THEMES) {
    test(`INV-013: print rows are greedy, one line where it fits: ${song} ${theme}`, async ({ page }) => {
      const urls = (await seed(page)) as Urls;
      const bad: string[] = [];
      for (const pg of ["songUrl", "playUrl"] as const) {
        for (const width of PRN) {
          await page.emulateMedia({ media: "screen", colorScheme: theme });
          await page.setViewportSize({ width, height: 900 });
          await page.goto(urls[pg]);
          await page.waitForLoadState("load");
          await page.evaluate(() => document.fonts.ready);
          await page.waitForTimeout(400);
          await page.emulateMedia({ media: "print", colorScheme: theme });
          await page.waitForTimeout(400);
          const m = await measure(page);
          if (m.cards.length === 0 || m.display !== "flex") continue; // below 768 printable width the list is spec 010's grid, one a row
          const w = own(m);
          const g = greedy(w, m.row, m.gap);
          const where = `${song} ${pg === "playUrl" ? "play" : "song"} ${theme} @${width}`;
          if (!g.tie && JSON.stringify(drawn(m.cards)) !== JSON.stringify(g.rows)) bad.push(`rows ${where}: drawn ${JSON.stringify(drawn(m.cards))} greedy ${JSON.stringify(g.rows)}`);
          m.cards.forEach((c, i) => {
            if (w[i] <= m.row - 1 && c.runs > 0 && c.lines > 1) bad.push(`wrapped though own ${w[i].toFixed(0)} fits row ${m.row.toFixed(0)}: ${where} card ${i + 1} (${c.lines} lines)`);
          });
        }
      }
      expect(bad).toEqual([]);
    });
  }
}

/** INV-013 / FR-019: nothing is cut at the right edge for long and a single bar wider than any line (the narrow song page's scrolling staff is FU6). */
for (const name of ["long", "wide-bar"] as const) {
  test(`INV-013: print cuts nothing: ${name}`, async ({ page }) => {
    const urls = (await seedWideSong(page, name)) as unknown as Urls;
    const bad: string[] = [];
    for (const pg of ["songUrl", "playUrl"] as const) {
      for (const width of PRN) {
        await printAt(page, urls[pg], "dark", width);
        const r = await page.evaluate(() => {
          const lis = [...document.querySelectorAll<HTMLElement>(".reading-cards > li")];
          return {
            scroll: document.documentElement.scrollWidth,
            vw: innerWidth,
            cards: lis.map((li) => {
              const card = li.getBoundingClientRect();
              const runs = [...li.querySelectorAll<HTMLElement>(".tab-bar-run, .overflow-x-auto")];
              const cols = [...li.querySelectorAll<HTMLElement>('[data-testid="tab-column"]')];
              return {
                right: card.right,
                overflow: Math.max(0, ...runs.map((e) => e.scrollWidth - e.clientWidth)),
                colPast: cols.filter((c) => c.getBoundingClientRect().right > card.right + 0.5).length,
              };
            }),
          };
        });
        const where = `${name} ${pg === "playUrl" ? "play" : "song"} @${width}`;
        if (r.scroll > r.vw) bad.push(`${where}: page ${r.scroll} > ${r.vw}`);
        if (pg === "songUrl" && width < 768) continue;
        r.cards.forEach((c, i) => {
          if (c.right > r.vw + 0.5) bad.push(`${where}: card ${i + 1} right ${c.right}`);
          if (c.overflow > 1) bad.push(`${where}: card ${i + 1} staff overflows its box by ${c.overflow}px`);
          if (c.colPast > 0) bad.push(`${where}: card ${i + 1} has ${c.colPast} columns past the card`);
        });
      }
    }
    expect(bad).toEqual([]);
  });
}

/**
 * INV-013 / FR-019 (review round 2 F1): a real print fires only `beforeprint`/`afterprint`, under screen styles, and runs no
 * ResizeObserver, so paper's own widths must already be on each card. Under print media, put each card's screen-measured inline
 * `--own-*` back and lay out synchronously, so no observer can re-measure; the rows must be FR-007's greedy rows.
 */
const ownStyles = (page: Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".reading-cards > li")].map((li) => li.getAttribute("style") ?? ""));

const REAL_PRINT_SEEDS: Record<string, (p: Page) => Promise<unknown>> = {
  fit: seedFitSong,
  short: (p) => seedWideSong(p, "short"),
  long: (p) => seedWideSong(p, "long"),
  F5: (p) => seedFold(p, F5),
};

for (const [song, seed] of Object.entries(REAL_PRINT_SEEDS)) {
  for (const theme of THEMES) {
    test(`INV-013: real-print layout is greedy over the printed own widths, every member: ${song} ${theme}`, async ({ page }) => {
      test.setTimeout(600_000);
      const urls = (await seed(page)) as Urls;
      const bad: string[] = [];
      for (const [pg, url] of [["song", urls.songUrl], ["play", urls.playUrl]] as const) {
        for (const screen of [1047, 1280, 1920]) {
          for (const paper of PRN) {
            await page.emulateMedia({ media: "screen", colorScheme: theme });
            await page.setViewportSize({ width: screen, height: 900 });
            await page.goto(url);
            await expect(page.locator(".reading-cards > li").first()).toBeVisible();
            await settle(page);
            const kept = await ownStyles(page);
            await page.setViewportSize({ width: paper, height: 900 });
            await page.emulateMedia({ media: "print", colorScheme: theme });
            await settle(page);
            const m = await measure(page);
            const where = `${song} ${pg} ${theme} screen ${screen} → paper ${paper}`;
            if (m.display !== "flex") {
              if (paper >= 768) bad.push(`${where}: list display ${m.display}`);
              if (drawn(m.cards).some((r) => r.length > 1)) bad.push(`${where}: narrow paper has a row of more than one`);
              continue;
            }
            const g = greedy(own(m), m.row, m.gap);
            const res = await page.evaluate((styles) => {
              const lis = [...document.querySelectorAll<HTMLElement>(".reading-cards > li")];
              const now = lis.map((li) => li.getAttribute("style") ?? "");
              lis.forEach((li, i) => li.setAttribute("style", styles[i]));
              const t = lis.map((li) => li.getBoundingClientRect().top);
              const lines = lis.map((li) => new Set([...li.querySelectorAll(".tab-bar-run")].map((e) => Math.round(e.getBoundingClientRect().top))).size);
              lis.forEach((li, i) => li.setAttribute("style", now[i]));
              return { t, lines };
            }, kept);
            const d = drawn(res.t.map((top) => ({ top })));
            if (!g.tie && JSON.stringify(d) !== JSON.stringify(g.rows)) bad.push(`${where}: real-print rows ${JSON.stringify(d)} vs greedy ${JSON.stringify(g.rows)}`);
            own(m).forEach((w, i) => {
              if (w <= m.row - 1 && res.lines[i] > 1) bad.push(`${where}: card ${i + 1} prints on ${res.lines[i]} lines though its own ${w.toFixed(0)} fits ${m.row.toFixed(0)}`);
            });
          }
        }
      }
      expect(bad).toEqual([]);
    });
  }
}

for (const song of ["short", "fit"] as const) {
  test(`INV-013/INV-009: screen to print to screen leaves every card's own widths as they were: ${song}`, async ({ page }, info) => {
    test.skip(info.project.name === "mobile", "viewport is set here; desktop and firefox only");
    const urls = (song === "fit" ? await seedFitSong(page) : await seedWideSong(page, "short")) as unknown as Urls;
    const bad: string[] = [];
    for (const [pg, url] of [["song", urls.songUrl], ["play", urls.playUrl]] as const) {
      await page.emulateMedia({ media: "screen" });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(url);
      await expect(page.locator(".reading-cards > li").first()).toBeVisible();
      await settle(page);
      const before = await ownStyles(page);
      await page.emulateMedia({ media: "print" });
      await settle(page);
      await page.emulateMedia({ media: "screen" });
      await settle(page);
      const after = await ownStyles(page);
      if (JSON.stringify(before) !== JSON.stringify(after)) bad.push(`${song} ${pg}: ${after.join("|")} vs ${before.join("|")}`);
    }
    expect(bad).toEqual([]);
  });
}

/**
 * INV-012 / FR-017, FR-018 (review round 2): a printed chord symbol stays in its line wherever it sits, not only on a line's
 * first column. The 40-character symbol in bar 4 at 375 is MINOR F2 (review FU1) and stays in the probe, not here.
 */
const q = (fret: number, over: Col = {}): Col => n(fret, { d: "q", ...over });
const C80 = "Cmaj7".repeat(16);
const C30 = "Cmaj7#11b9/G#sus4add13omit5xx".slice(0, 30);
const C12 = "Cmaj7#11/G#b";
const SHAPES: Record<string, Col[]> = {
  "80 mid-bar": [q(3), q(5), q(3, { chord: C80 }), q(5), bar(), q(3), q(5), q(3), q(5)],
  "80 end of bar": [q(3), q(5), q(3), q(5, { chord: C80 }), bar(), q(3), q(5), q(3), q(5)],
  "80 first of bar 2": [q(3), q(5), q(3), q(5), bar(), q(3, { chord: C80 }), q(5), q(3), q(5)],
  "30 mid-bar": [q(3), q(5), q(3, { chord: C30 }), q(5), bar(), q(3), q(5), q(3), q(5)],
  "12 end of a line": [q(3), q(5), q(3), q(5, { chord: C12 })],
};
for (const [name, columns] of Object.entries(SHAPES)) {
  test(`INV-012: a printed chord stays in its line wherever it sits: ${name}`, async ({ page }, info) => {
    test.skip(info.project.name === "mobile", "viewport is set here; desktop and firefox only");
    const { songUrl, playUrl } = await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
    const bad: string[] = [];
    for (const [pg, url] of [["song", songUrl], ["play", playUrl]] as const) {
      for (const width of [375, 718, 820, 1047, 1280]) {
        await page.emulateMedia({ media: "screen" });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url);
        await expect(page.getByTestId("tab-staff").first()).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(300);
        await page.emulateMedia({ media: "print" });
        await page.waitForTimeout(300);
        const r = await page.evaluate(() => {
          const out: string[] = [];
          for (const e of document.querySelectorAll<HTMLElement>('[data-testid="tab-column"] > div.text-accent')) {
            const text = (e.textContent ?? "").trim();
            if (!text || e.closest(".overflow-x-auto")) continue;
            const card = (e.closest("li") ?? e.closest(".reading-card") ?? document.body).getBoundingClientRect();
            const line = e.closest<HTMLElement>(".tab-lines");
            const lineW = line ? line.clientWidth : innerWidth;
            const clone = e.cloneNode(true) as HTMLElement;
            clone.style.cssText = "position:absolute;visibility:hidden;white-space:nowrap;width:max-content;max-width:none";
            e.parentElement!.appendChild(clone);
            const natural = clone.getBoundingClientRect().width;
            clone.remove();
            const range = document.createRange();
            range.selectNodeContents(e);
            const lines = new Set([...range.getClientRects()].map((x) => Math.round(x.top))).size;
            const b = e.getBoundingClientRect();
            const limit = Math.min(card.right, innerWidth);
            const tag = `${text.slice(0, 12)} (${text.length})`;
            if (b.right > limit + 0.5) out.push(`${tag} right ${b.right.toFixed(1)} past card/paper ${limit.toFixed(1)}`);
            if (natural <= lineW - 1 && lines > 1) out.push(`${tag} ${natural.toFixed(0)}px fits its ${lineW}px line but prints on ${lines} lines`);
          }
          const cut = [...document.querySelectorAll<HTMLElement>(".tab-bar-run")].filter((x) => !x.closest(".overflow-x-auto") && x.scrollWidth > x.clientWidth + 1);
          if (cut.length) out.push(`${cut.length} runs cut`);
          if (document.documentElement.scrollWidth > innerWidth) out.push(`page ${document.documentElement.scrollWidth} > ${innerWidth}`);
          return out;
        });
        bad.push(...r.map((x) => `${pg} @${width}: ${x}`));
      }
    }
    expect(bad).toEqual([]);
  });
}

/**
 * INV-013 / FR-019 through Chromium's real print path: `page.pdf()` onto 1047px paper from a 412 and a 1280 screen. Each part
 * label's `/capture/<part>` link rect in the PDF gives where its card's head printed; both screens draw FR-007's rows.
 */
test("INV-013: real print (page.pdf) at 1047 from a 412 and a 1280 screen: fit song page", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium" || info.project.name !== "desktop", "page.pdf is Chromium headless; one project is enough");
  const urls = (await seedFitSong(page)) as unknown as Urls;
  const out: Record<string, number[][]> = {};
  for (const width of [412, 1280]) {
    await page.emulateMedia({ media: "screen" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(urls.songUrl);
    await expect(page.locator(".reading-cards > li").first()).toBeVisible();
    await settle(page);
    const pdf = (await page.pdf({ width: "1047px", height: "1400px", margin: { top: "0", right: "0", bottom: "0", left: "0" } })).toString("latin1");
    const rects: { y: number; uri: string }[] = [];
    for (const m of pdf.matchAll(/\/Rect \[([-\d. ]+)\][^]*?\/URI \(([^)]*)\)/g)) {
      const [, y1] = m[1].trim().split(/\s+/).map(Number);
      if (/\/capture\/[0-9a-f-]+$/.test(m[2])) rects.push({ y: Math.round(y1), uri: m[2] });
    }
    const seen = new Set<string>();
    const heads = rects.filter((r) => (seen.has(r.uri) ? false : (seen.add(r.uri), true)));
    const rows: number[][] = [];
    let y = NaN;
    heads.forEach((r, i) => {
      if (rows.length && Math.abs(r.y - y) <= 2) rows[rows.length - 1].push(i);
      else {
        rows.push([i]);
        y = r.y;
      }
    });
    out[width] = rows;
  }
  expect(out[1280]).toEqual([[0], [1], [2, 3]]);
  expect(out[412]).toEqual(out[1280]);
});
