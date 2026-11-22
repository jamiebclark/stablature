/**
 * Spec 013 US1 probes: INV-001..003 (order, rows, widths), INV-006 (minimums), INV-007 (fit and short), INV-014 (narrow style).
 * US2 probes: INV-004, INV-005 (regression guard, may pass before the change), INV-007 long half.
 * The pointer is the project's: `mobile` is touch, `desktop` is a mouse.
 */
import { expect, test, type Page } from "@playwright/test";
import { drawnRows, greedyRows, isRoundingTie, measureCards, seedMemoSong, type Measured } from "./cards-helpers";
import { choose } from "./reading-helpers";
import { seedFitSong, seedWideSong, SONGS, type SongName } from "./wide-helpers";

test.setTimeout(300_000);

const WIDE = [768, 1024, 1280, 1440, 1920, 2560];
const NARROW = [320, 375, 412, 767];
type Name = SongName | "fit" | "memo";
const ALL: Name[] = ["fit", ...SONGS, "memo"];
type Urls = { songUrl: string; playUrl: string };

async function seed(page: Page, name: Name): Promise<Urls> {
  if (name === "fit") return seedFitSong(page) as unknown as Urls;
  if (name === "memo") return (await seedMemoSong(page)) as unknown as Urls;
  return (await seedWideSong(page, name)) as unknown as Urls;
}

/** Fonts in and two frames to settle. */
async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(250);
}

async function open(page: Page, url: string, width: number, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto(url);
  await page.waitForLoadState("load");
  await settle(page);
}

const chromeOf = (m: Measured) => 2 * m.tokens.padX + 2;
const leastOf = (m: Measured, i: number) =>
  m.cards[i].memo
    ? Math.max(m.tokens.cardFloor, m.tokens.cardMin)
    : Math.max(m.tokens.cardMin, Math.min(m.cards[i].head + chromeOf(m), m.tokens.cardFloor));
const ownOf = (m: Measured) => m.cards.map((c, i) => Math.max(leastOf(m, i), c.ruler > 0 ? c.ruler + chromeOf(m) : 0));

for (const name of ALL) {
  test(`INV-001/002/003/006: rows follow content: ${name}`, async ({ page }) => {
    const urls = await seed(page, name);
    for (const url of [urls.songUrl, urls.playUrl]) {
      for (const width of WIDE) {
        await open(page, url, width);
        const m = await measureCards(page);
        if (m.cards.length === 0) continue;
        const where = `${name} ${url.endsWith("/play") ? "play" : "song"} @${width}`;
        expect(m.display, where).toBe("flex");
        const own = ownOf(m);
        // INV-001: nothing placed before an earlier card; play-view numbers 1..n; no `order`.
        const orders = await page.evaluate(() => [...document.querySelectorAll(".reading-cards > li")].map((li) => getComputedStyle(li).order));
        expect(orders.every((o) => o === "0"), where).toBe(true);
        m.cards.forEach((c, i) => {
          if (i === 0) return;
          const p = m.cards[i - 1];
          expect(c.top > p.top + 0.5 || c.left >= p.right - 0.5, `${where} order ${i}`).toBe(true);
        });
        if (url.endsWith("/play")) {
          const numbers = await page.getByTestId("card-number").allTextContents();
          expect(numbers.map((t) => t.trim()), where).toEqual(m.cards.map((_, i) => String(i + 1)));
        }
        // INV-002: drawn rows equal the greedy rows (a rounding tie is reported, not failed).
        const drawn = drawnRows(m.cards);
        if (isRoundingTie(own, m.row, m.tokens.gap)) console.log(`rounding tie: ${where}`);
        else expect(drawn, where).toEqual(greedyRows(own, m.row, m.tokens.gap));
        // INV-003: widths.
        const listRight = Math.max(...m.cards.map((c) => c.right));
        drawn.forEach((r, ri) => {
          const isLast = ri === drawn.length - 1;
          const tops = r.map((i) => m.cards[i].top);
          expect(Math.max(...tops) - Math.min(...tops), `${where} tops`).toBeLessThanOrEqual(0.5);
          r.forEach((i) => {
            const c = m.cards[i];
            expect(c.width, `${where} min ${i}`).toBeGreaterThanOrEqual(Math.min(own[i], m.row) - 1.5);
            expect(c.width, `${where} max ${i}`).toBeLessThanOrEqual(m.row + 0.5);
            if (isLast) expect(c.width, `${where} last own ${i}`).toBeLessThanOrEqual(own[i] + 1.5);
            // INV-006: a card is never narrower than its minimum, or the row.
            expect(c.width, `${where} least ${i}`).toBeGreaterThanOrEqual(Math.min(leastOf(m, i), m.row) - 1.5);
            if (c.memo) expect(c.width, `${where} memo ${i}`).toBeGreaterThanOrEqual(Math.min(343, m.row) - 0.5);
          });
          if (!isLast) {
            const right = Math.max(...r.map((i) => m.cards[i].right));
            expect(Math.abs(right - listRight), `${where} full row reaches the edge`).toBeLessThanOrEqual(1.5);
          }
        });
        // INV-006: head-row children stay in the card and do not overlap.
        const head = await page.evaluate(() =>
          [...document.querySelectorAll(".reading-cards > li")].map((li) => {
            const card = li.getBoundingClientRect();
            const kids = [...(li.querySelector(".reading-card > :first-child")?.children ?? [])].map((k) => k.getBoundingClientRect()).filter((r) => r.width > 0);
            const inside = kids.every((r) => r.left >= card.left - 0.5 && r.right <= card.right + 0.5);
            let overlap = 0;
            for (let a = 0; a < kids.length; a++)
              for (let b = a + 1; b < kids.length; b++) {
                const w = Math.min(kids[a].right, kids[b].right) - Math.max(kids[a].left, kids[b].left);
                const h = Math.min(kids[a].bottom, kids[b].bottom) - Math.max(kids[a].top, kids[b].top);
                if (w > 0.5 && h > 0.5) overlap = Math.max(overlap, Math.min(w, h));
              }
            return { inside, overlap };
          }),
        );
        head.forEach((h, i) => {
          expect(h.inside, `${where} head inside ${i}`).toBe(true);
          expect(h.overlap, `${where} head overlap ${i}`).toBeLessThanOrEqual(0.5);
        });
      }
    }
  });
}

test("INV-002: light theme at 1280 draws the same rows", async ({ page }) => {
  const { playUrl } = (await seedWideSong(page, "short")) as unknown as Urls;
  await page.emulateMedia({ colorScheme: "light" });
  await open(page, playUrl, 1280);
  const m = await measureCards(page);
  const own = ownOf(m);
  if (!isRoundingTie(own, m.row, m.tokens.gap)) expect(drawnRows(m.cards)).toEqual(greedyRows(own, m.row, m.tokens.gap));
});

for (const theme of ["dark", "light"] as const) {
  test(`INV-007: fit fits the screen: ${theme}`, async ({ page }) => {
    const fit = (await seedFitSong(page)) as unknown as Urls;
    await page.emulateMedia({ colorScheme: theme });
    for (const [w, h] of [[1280, 800], [1440, 900]]) {
      await open(page, fit.playUrl, w, h);
      test.skip(await page.evaluate(() => !matchMedia("(pointer: fine)").matches), "fit is measured with a mouse");
      const f = await page.evaluate(() => ({
        scroll: document.documentElement.scrollHeight,
        inner: innerHeight,
        bottom: Math.max(...[...document.querySelectorAll(".reading-cards > li")].map((li) => li.getBoundingClientRect().bottom)),
        bar: document.querySelector('[data-testid="click-bar"]')?.getBoundingClientRect().top ?? Infinity,
      }));
      console.log(`INV-007 fit play ${w}x${h} ${theme}`, JSON.stringify(f));
      expect(f.scroll).toBeLessThanOrEqual(f.inner);
      expect(f.bottom).toBeLessThanOrEqual(f.bar);
      await open(page, fit.songUrl, w, h);
      const fs = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, inner: innerHeight }));
      console.log(`INV-007 fit song ${w}x${h} ${theme}`, JSON.stringify(fs));
      expect(fs.scroll).toBeLessThanOrEqual(fs.inner);
    }
  });

  // Seeded in its own test: seeding another song leaves state (a view control) that changes a head row's width.
  test(`INV-007: short fits the screen: ${theme}`, async ({ page }) => {
    const short = (await seedWideSong(page, "short")) as unknown as Urls;
    await page.emulateMedia({ colorScheme: theme });
    await open(page, short.playUrl, 1280, 800);
    test.skip(await page.evaluate(() => !matchMedia("(pointer: fine)").matches), "fit is measured with a mouse");
    const sp = await page.evaluate(() => ({ scroll: document.documentElement.scrollHeight, inner: innerHeight }));
    console.log(`INV-007 short play ${theme}`, JSON.stringify(sp));
    expect(sp.scroll).toBeLessThanOrEqual(sp.inner);
    const m = await measureCards(page);
    drawnRows(m.cards).slice(0, -1).forEach((r) => expect(r.length).toBeGreaterThanOrEqual(5));
    await open(page, short.songUrl, 1280, 800);
    await page.waitForTimeout(1500);
    const ss = await page.evaluate(() => ({
      scroll: document.documentElement.scrollHeight,
      panel: document.querySelector('[data-testid="panel-song-tools"]')?.getAttribute("aria-expanded"),
      rows: new Set([...document.querySelectorAll(".reading-cards > li")].map((li) => Math.round(li.getBoundingClientRect().top))).size,
      heads: [...document.querySelectorAll(".reading-card > :first-child")].map((h) => {
        const first = h.firstElementChild?.getBoundingClientRect().height ?? 0;
        return h.getBoundingClientRect().height - first;
      }),
    }));
    console.log(`INV-007 short song ${theme}`, JSON.stringify(ss));
    expect(ss.scroll).toBeLessThanOrEqual(1030);
    ss.heads.forEach((d) => expect(d).toBeLessThanOrEqual(1));
  });
}

// Guards narrow: passes before the change by design; T014's hook is where it can start failing.
for (const name of ["fit", "short", "names", "empty", "memo"] as Name[]) {
  test(`INV-014: narrow draws no card style: ${name}`, async ({ page }) => {
    const urls = await seed(page, name);
    for (const url of [urls.songUrl, urls.playUrl]) {
      for (const width of NARROW) {
        await open(page, url, width, 800);
        const found = await page.evaluate(() => ({
          li: [...document.querySelectorAll(".reading-cards > li")].filter((li) => li.hasAttribute("style")).length,
          head: [...document.querySelectorAll(".reading-card > :first-child")].filter((h) => h.hasAttribute("style")).length,
          list: [...document.querySelectorAll(".reading-cards")].some((l) => (l.getAttribute("style") ?? "").includes("--staff-line")),
        }));
        expect(found, `${name} @${width}`).toEqual({ li: 0, head: 0, list: false });
      }
    }
  });
}

/** Opens the song tools panel (song page) and picks a staff view. */
async function pickView(page: Page, view: "frets" | "notes" | "intervals") {
  const tools = page.getByTestId("panel-song-tools");
  if ((await tools.count()) === 0) return false;
  if ((await tools.getAttribute("aria-expanded")) !== "true") await tools.click();
  const button = page.getByTestId(`staff-view-${view}`);
  if ((await button.count()) === 0) return false;
  await button.click();
  await settle(page);
  return true;
}

const STAFF_SONGS: Name[] = ["fit", "short", "long", "names", "wide-bar"];

// US2. INV-004: a card whose one-line staff fits its row draws one line; a wider one wraps at barlines and never
// scrolls sideways, except for a single bar wider than its line.
for (const name of STAFF_SONGS) {
  test(`INV-004: one line when it fits, barlines when it does not: ${name}`, async ({ page }) => {
    const urls = await seed(page, name);
    for (const url of [urls.songUrl, urls.playUrl]) {
      const isSong = url === urls.songUrl;
      for (const view of ["frets", "notes", "intervals"] as const) {
        for (const width of WIDE) {
          await open(page, url, width);
          if (view !== "frets") {
            if (isSong) {
              if (!(await pickView(page, view))) continue;
            } else {
              await choose(page, view);
              await settle(page);
            }
          }
          const m = await measureCards(page);
          const own = ownOf(m);
          const runs = await page.evaluate(() =>
            [...document.querySelectorAll(".reading-cards > li")].map((li) => {
              const els = [...li.querySelectorAll<HTMLElement>(".tab-bar-run")];
              return {
                tops: new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size,
                bars: els.length,
                overflow: Math.max(0, ...els.map((e) => e.scrollWidth - e.clientWidth)),
                single: els.length === 1,
              };
            }),
          );
          const where = `${name} ${isSong ? "song" : "play"} ${view} @${width}`;
          runs.forEach((r, i) => {
            if (r.bars === 0) return;
            if (own[i] <= m.row - 1.5) expect(r.tops, `${where} one line ${i}`).toBe(1);
            if (!r.single) expect(r.overflow, `${where} overflow ${i}`).toBeLessThanOrEqual(1);
          });
        }
      }
    }
  });
}

// INV-007 long half: A takes its one-line width up to the row, B and C share a row.
for (const [w, h] of [[1024, 800], [1280, 800], [1440, 900], [1920, 1080]]) {
  test(`INV-007: long gives A its width and B, C a shared row @${w}`, async ({ page }) => {
    const urls = (await seedWideSong(page, "long")) as unknown as Urls;
    for (const url of [urls.songUrl, urls.playUrl]) {
      await open(page, url, w, h);
      const m = await measureCards(page);
      const own = ownOf(m);
      const where = `long ${url.endsWith("/play") ? "play" : "song"} @${w}`;
      expect(m.cards.length, where).toBeGreaterThanOrEqual(3);
      expect(m.cards[0].width, `${where} A`).toBeGreaterThanOrEqual(Math.min(own[0], m.row) - 1.5);
      // SC-003 / US2 AS1: B and C share a row whenever greedy leaves A alone (A + gap + B > row). On Linux Chrome at
      // 1920 FR-007 puts B beside A (DECISIONS "013 - decisions"), so there the shared row is not owed.
      const aAlone = own[0] + m.tokens.gap + own[1] > m.row;
      if (aAlone) expect(Math.abs(m.cards[1].top - m.cards[2].top), `${where} B/C row`).toBeLessThanOrEqual(0.5);
      if (w === 1920 && process.platform === "win32") expect(aAlone, `${where} A alone at 1920`).toBe(true);
    }
  });
}

// INV-005: no sideways page scroll. Guards against overflow the new CSS could introduce; it may pass before the
// change (the old equal tracks never overflowed), so it is a regression guard rather than a failing probe.
for (const name of STAFF_SONGS) {
  test(`INV-005: no sideways page scroll: ${name}`, async ({ page }) => {
    const urls = await seed(page, name);
    const check = async (where: string) => {
      const o = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, inner: innerWidth }));
      expect(o.scroll, where).toBeLessThanOrEqual(o.inner);
    };
    for (const url of [urls.songUrl, urls.playUrl]) {
      const isSong = url === urls.songUrl;
      for (const width of [...NARROW, ...WIDE]) {
        await open(page, url, width, 800);
        await check(`${name} ${isSong ? "song" : "play"} @${width}`);
        if (!isSong) continue;
        for (const view of ["notes", "intervals", "frets"] as const) {
          if (!(await pickView(page, view))) break;
          await check(`${name} song ${view} @${width}`);
        }
      }
    }
  });
}
