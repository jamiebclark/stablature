/**
 * Review probe (round 3), INV-013 / FR-019 / FR-004: a page opened on a narrow screen (< 768, so `useWide()` is false and
 * `useCardTrack` writes no `--own-*`) and printed onto paper whose printable width is 768 or more (A4 landscape, 1047).
 *
 * Round 3 result: the two halves disagree, and both are kept.
 * - **Chromium's real print path holds.** The last two tests show it. From a 412 screen, `page.pdf()` fires the
 *   `(min-width: 768px)` and `print` media changes, so React re-renders wide and `useCardTrack` measures under print
 *   media. The PDF draws the same rows as from a 1280 screen.
 * - **The frozen-script model fails** (the first tests). They model a print that runs no script while it lays out, as
 *   Firefox's static-clone print is understood to do (not verified: Playwright cannot drive Firefox's print). `matchMedia`
 *   answers `(min-width: 768px)` with `false` and never changes, the viewport is the paper's width, and print media is
 *   emulated. CSS then sees a wide page while JS has measured nothing, and every card falls to the 9rem `--card-min`.
 *   That is review round 3 F1, MINOR, PLAUSIBLE.
 *
 * FR-019 asks print to apply FR-001 to FR-009 at the printable width. FR-004: a card whose own width fits the row is at
 * least its own width, so its staff is on one line. Own widths are measured here (measure.ts), never read from `--own-*`.
 * The play view always draws a ruler, so its own widths are measurable. The song page draws its narrow scrolling staff,
 * so it is checked for cut content (a scroll box narrower than what it holds) and for its rows against its main-branch
 * equivalent (2 a row at 1047: spec 010's half-row track with no `--staff-line`).
 *
 * The control half runs the same seed with a wide screen state, to show what paper should look like.
 */
import { expect, test, type Page } from "@playwright/test";
import { seedFitSong, seedWideSong } from "../../../e2e/wide-helpers";
import { drawn, greedy, measure, own, settle } from "./measure";

test.setTimeout(400_000);
type Urls = { songUrl: string; playUrl: string };

const narrowScreen = (page: Page) =>
  page.addInitScript(() => {
    const real = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => {
      if (q.replace(/\s+/g, "") !== "(min-width:768px)") return real(q);
      return {
        matches: false,
        media: q,
        onchange: null,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
        dispatchEvent: () => false,
      } as unknown as MediaQueryList;
    };
  });

const layout = (page: Page) =>
  page.evaluate(() => {
    const lis = [...document.querySelectorAll<HTMLElement>(".reading-cards > li")];
    return lis.map((li) => {
      const r = li.getBoundingClientRect();
      const scrollers = [...li.querySelectorAll<HTMLElement>(".overflow-x-auto")];
      return {
        width: Math.round(r.width),
        inline: li.getAttribute("style") ?? "",
        cut: Math.max(0, ...scrollers.map((s) => s.scrollWidth - s.clientWidth)),
      };
    });
  });

for (const song of ["fit", "short", "long"] as const) {
  for (const screen of ["narrow", "wide"] as const) {
    test(`INV-013 print at 1047 from a ${screen} screen: ${song}`, async ({ page }, info) => {
      test.skip(info.project.name !== "probe-desktop" && info.project.name !== "probe-firefox", "desktop and firefox only");
      const urls = (song === "fit" ? await seedFitSong(page) : await seedWideSong(page, song)) as unknown as Urls;
      if (screen === "narrow") await narrowScreen(page);
      const bad: string[] = [];
      for (const [pg, url] of [["play", urls.playUrl], ["song", urls.songUrl]] as const) {
        await page.emulateMedia({ media: "screen" });
        await page.setViewportSize({ width: 1047, height: 900 });
        await page.goto(url);
        await expect(page.locator(".reading-cards > li").first()).toBeVisible();
        await settle(page);
        await page.emulateMedia({ media: "print" });
        await settle(page);
        const m = await measure(page);
        const l = await layout(page);
        const d = drawn(m.cards);
        const where = `${song} ${pg} from a ${screen} screen @1047`;
        const w = own(m);
        const g = greedy(w, m.row, m.gap);
        console.log(
          `${where}: display ${m.display}; rows ${JSON.stringify(d)}; widths ${l.map((x) => x.width).join(",")}; ` +
            `staff lines ${m.cards.map((c) => c.lines).join(",")}; own (ruler) ${w.map((x) => x.toFixed(0)).join(",")}; ` +
            `greedy ${JSON.stringify(g.rows)}; cut ${l.map((x) => x.cut).join(",")}; inline ${l.map((x) => x.inline || "-").join(" | ")}`,
        );
        if (pg === "play") {
          if (!g.tie && JSON.stringify(d) !== JSON.stringify(g.rows)) bad.push(`${where}: rows ${JSON.stringify(d)} vs greedy ${JSON.stringify(g.rows)}`);
          m.cards.forEach((c, i) => {
            if (w[i] <= m.row - 1 && c.runs > 0 && c.lines > 1) bad.push(`${where}: card ${i + 1} wraps to ${c.lines} lines though its own ${w[i].toFixed(0)} fits ${m.row.toFixed(0)}`);
          });
        } else {
          l.forEach((x, i) => {
            if (x.cut > 1) bad.push(`${where}: card ${i + 1} (${x.width}px) cuts ${x.cut}px of its staff`);
          });
        }
      }
      expect(bad).toEqual([]);
    });
  }
}

/**
 * The same through Chromium's real print path, with no `matchMedia` stand-in: the fit song page opened at 412 (a real
 * narrow screen) and at 1280, then `page.pdf()` onto 1047px-wide paper with no margin. The PDF's link annotations for
 * each part's label link (`/capture/<part>`) give where each card's head printed. Rows are read from their `/Rect` y.
 */
test("INV-013 real print (page.pdf) at 1047 from a 412 and a 1280 screen: fit song page", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium" || info.project.name !== "probe-desktop", "page.pdf is Chromium headless");
  const urls = (await seedFitSong(page)) as unknown as Urls;
  const out: Record<string, number[][]> = {};
  for (const width of [412, 1280]) {
    await page.emulateMedia({ media: "screen" });
    await page.setViewportSize({ width, height: 900 });
    await page.goto(urls.songUrl);
    await expect(page.locator(".reading-cards > li").first()).toBeVisible();
    await settle(page);
    const pdf = (await page.pdf({ width: "1047px", height: "1400px", margin: { top: "0", right: "0", bottom: "0", left: "0" } })).toString("latin1");
    const rects: { x: number; y: number; uri: string }[] = [];
    for (const m of pdf.matchAll(/\/Rect \[([-\d. ]+)\][^]*?\/URI \(([^)]*)\)/g)) {
      const [x1, y1] = m[1].trim().split(/\s+/).map(Number);
      if (/\/capture\/[0-9a-f-]+$/.test(m[2])) rects.push({ x: Math.round(x1), y: Math.round(y1), uri: m[2] });
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
    console.log(`page.pdf fit song @1047 paper from a ${width} screen: card heads at ${heads.map((r) => `(${r.x},${r.y})`).join(" ")}; rows ${JSON.stringify(rows)}`);
  }
  // From a wide screen paper draws FR-007's rows (measured above: [[0],[1],[2,3]]); from a narrow one it must not do worse
  // than one card a row.
  expect(out[1280]).toEqual([[0], [1], [2, 3]]);
  expect(out[412].every((r) => r.length === 1) || JSON.stringify(out[412]) === JSON.stringify(out[1280])).toBe(true);
});

/** What JS does during `page.pdf()` from a 412 screen: which events fire, and when the cards get their `--own-*`. */
test("INV-013 real print (page.pdf) from a 412 screen: the event log", async ({ page, browserName }, info) => {
  test.skip(browserName !== "chromium" || info.project.name !== "probe-desktop", "page.pdf is Chromium headless");
  const urls = (await seedFitSong(page)) as unknown as Urls;
  await page.setViewportSize({ width: 412, height: 900 });
  await page.goto(urls.songUrl);
  await expect(page.locator(".reading-cards > li").first()).toBeVisible();
  await settle(page);
  await page.evaluate(() => {
    const w = window as unknown as { __log: string[] };
    w.__log = [];
    const snap = (why: string) => {
      const lis = [...document.querySelectorAll<HTMLElement>(".reading-cards > li")];
      w.__log.push(
        `${why}: innerWidth=${innerWidth} wide=${matchMedia("(min-width: 768px)").matches} print=${matchMedia("print").matches} ` +
          `rulers=${document.querySelectorAll('[data-testid="tab-ruler"]').length} styles=${lis.map((li) => li.getAttribute("style") ?? "-").join(" | ")}`,
      );
    };
    matchMedia("(min-width: 768px)").addEventListener("change", () => snap("mql 768 change"));
    matchMedia("print").addEventListener("change", () => snap("mql print change"));
    addEventListener("beforeprint", () => snap("beforeprint"));
    addEventListener("afterprint", () => snap("afterprint"));
    addEventListener("resize", () => snap("resize"));
    new MutationObserver(() => snap("li style mutation")).observe(document.querySelector(".reading-cards")!, { attributes: true, subtree: true, attributeFilter: ["style"] });
  });
  await page.pdf({ width: "1047px", height: "1400px", margin: { top: "0", right: "0", bottom: "0", left: "0" } });
  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  console.log(log.slice(0, 12).join("\n"));
});
