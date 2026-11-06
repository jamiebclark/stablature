/**
 * INV-016, INV-017 and INV-038 over **Bars** x **V** x sizes x **Ptr** on every reading surface. The suite's
 * usability-wrap.spec.ts runs one shape, and its chord test measures the song page alone.
 */
import { expect, test, type Page } from "@playwright/test";
import { bar, n, remember, seedSong, VIEWS, type Col } from "../../../e2e/reading-helpers";

test.setTimeout(300_000);

const q = (fret: number, over: Col = {}) => n(fret, { d: "q", ...over });
const four = (from = 3): Col[] => [q(from), q(from + 2), q(from), q(from + 2)];
const bars = (count: number, shape: (i: number) => Col[] = () => four()): Col[] =>
  Array.from({ length: count }, (_, i) => [...shape(i), ...(i < count - 1 ? [bar()] : [])]).flat();

const LONG = "Cmaj7".repeat(16);

const BARS: { name: string; columns: Col[]; wide?: boolean }[] = [
  { name: "no barlines", columns: [...four(), ...four()] },
  { name: "a trailing barline", columns: [...four(), bar()] },
  { name: "a leading barline", columns: [bar(), ...four()] },
  { name: "an empty bar in the middle", columns: [...four(), bar(), bar(), ...four()] },
  { name: "16 bars", columns: bars(16, (i) => four(i % 2 ? 10 : 3)) },
  { name: "one bar wider than a line", columns: Array.from({ length: 160 }, (_, i) => q(i % 2 ? 12 : 3)), wide: true },
  { name: "a chord longer than a line", columns: [q(3, { chord: LONG }), q(5), q(3), q(5), bar(), ...four()], wide: true },
  { name: "a repeat crossing a line", columns: bars(12, (i) => (i === 5 ? [q(3, { repeat: 8 }), q(5), q(3), q(5)] : four())) },
  { name: "a pass with no notes", columns: [{ kind: "rest", d: "q" }, { kind: "rest", d: "q" }] },
];

/** Reads every staff on the page: the rect of each row's item against its column, on every line. */
const measure = (page: Page) =>
  page.evaluate(() => {
    const bad: string[] = [];
    const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;
    const textRect = (el: Element) => {
      const r = document.createRange();
      r.selectNodeContents(el);
      return r.getBoundingClientRect();
    };
    for (const staff of document.querySelectorAll('[data-testid="tab-staff"]')) {
      const edge = staff.getBoundingClientRect().right;
      for (const col of staff.querySelectorAll('[data-testid="tab-column"]')) {
        const c = col.getBoundingClientRect();
        if (c.width === 0) continue;
        const key = col.getAttribute("data-column");
        for (const num of col.querySelectorAll('[data-testid="tab-bar-number"]')) {
          if (!near(num.getBoundingClientRect().left, c.left)) bad.push(`bar number off column ${key}`);
        }
        const bracket = col.querySelector('[data-testid="tab-bracket"]');
        if (bracket) {
          const b = bracket.getBoundingClientRect();
          if (!near(b.left, c.left) || !near(b.right, c.right)) bad.push(`bracket off column ${key}`);
        }
        const note = col.querySelector(".tab-cell span");
        const rhythm = col.querySelector('[data-testid="tab-rhythm"]');
        if (note && rhythm && rhythm.textContent) {
          const a = note.getBoundingClientRect();
          const b = textRect(rhythm);
          if (!near(a.left + a.width / 2, b.left + b.width / 2)) bad.push(`mark off note ${key}: ${rhythm.textContent}`);
        }
      }
      const labels = [...staff.querySelectorAll('[data-testid="tab-column"] > div.text-accent')].filter((e) => e.textContent);
      const rects = labels.map((el) => ({ el, r: textRect(el) }));
      rects.forEach(({ el, r }, i) => {
        if ((el.textContent ?? "").includes("…")) bad.push(`chord cut: ${el.textContent}`);
        const scrolls = el.closest(".tab-bar-run, [role=group]");
        const ownScroller = scrolls && getComputedStyle(scrolls).overflowX !== "visible" && scrolls.scrollWidth > scrolls.clientWidth;
        if (r.right > edge + 1 && !ownScroller) bad.push(`chord past the staff: ${(el.textContent ?? "").slice(0, 12)} by ${Math.round(r.right - edge)}`);
        const next = rects[i + 1];
        if (next && near(next.r.top, r.top) && next.r.left - r.right < 2) bad.push(`chords touch: ${el.textContent} ${next.el.textContent}`);
      });
    }
    return [...new Set(bad)];
  });

const wrapped = (page: Page) =>
  page.evaluate(() => {
    const bad: string[] = [];
    const overs: number[] = [];
    for (const staff of document.querySelectorAll(".tab-staff-wrapped")) {
      const lines = staff.querySelector(".tab-lines")!;
      overs.push(lines.scrollWidth - lines.clientWidth);
      const firstCells = [...staff.querySelectorAll(".tab-bar-run")]
        .map((run) => run.querySelector(".tab-cell")?.getBoundingClientRect().top)
        .filter((t): t is number => t !== undefined);
      const tops = [...new Set(firstCells.map((t) => Math.round(t)))].sort((a, b) => a - b);
      const gutter = [...staff.querySelectorAll(".tab-gutter-block")].map((b) =>
        Math.round(b.querySelector(".tab-cell")!.getBoundingClientRect().top),
      );
      // One gutter block per bar and the surplus clipped (staff.md): there may be more blocks than lines, never fewer.
      if (tops.length > gutter.length) bad.push(`${tops.length} lines, ${gutter.length} gutter blocks`);
      tops.forEach((top, i) => {
        if (gutter[i] !== undefined && Math.abs(gutter[i] - top) > 1) bad.push(`line ${i} at ${top}, its labels at ${gutter[i]}`);
      });
      for (const run of staff.querySelectorAll(".tab-bar-run")) {
        const r = run.getBoundingClientRect();
        if (r.right > lines.getBoundingClientRect().right + 1) bad.push("a run past its line");
      }
    }
    return {
      bad,
      over: Math.max(0, ...overs),
      page: document.documentElement.scrollWidth - window.innerWidth,
      widthShare: (document.querySelector(".tab-lines")?.getBoundingClientRect().width ?? 0) / window.innerWidth,
      runsScrolling: [...document.querySelectorAll(".tab-bar-run")].filter((r) => r.scrollWidth > r.clientWidth + 1).length,
    };
  });

for (const shape of BARS) {
  test(`INV-016 INV-017 INV-038 ${shape.name}`, async ({ page }) => {
    const { songUrl, playUrl, parts } = await seedSong(
      page,
      [{ key: "a", label: "A", columns: shape.columns }],
      [{ part: "a" }, { part: "a", fromBar: 1, toBar: 1 }],
    );
    const bad: string[] = [];
    for (const view of VIEWS) {
      await remember(page, view);
      for (const size of [{ width: 375, height: 667 }, { width: 820, height: 1000 }, { width: 1280, height: 800 }]) {
        await page.setViewportSize(size);
        const where = `${view} @${size.width}`;
        await page.goto(playUrl);
        await expect(page.getByTestId("tab-staff").first()).toBeVisible();
        await page.waitForTimeout(120);
        bad.push(...(await measure(page)).map((x) => `play ${where}: ${x}`));
        const w = await wrapped(page);
        bad.push(...w.bad.map((x) => `play ${where}: ${x}`));
        if (w.over > 1) bad.push(`play ${where}: lines scroll sideways by ${w.over}`);
        if (w.page > 0) bad.push(`play ${where}: the page scrolls sideways by ${w.page}`);
        if (!shape.wide && w.runsScrolling > 0) bad.push(`play ${where}: ${w.runsScrolling} runs scroll with no wide bar`);
        if (size.width === 1280 && w.widthShare < 0.9) bad.push(`play ${where}: ${Math.round(w.widthShare * 100)}% of the window`);

        await page.emulateMedia({ media: "print" });
        await page.waitForTimeout(60);
        const cut = await page.evaluate(() =>
          [...document.querySelectorAll(".tab-bar-run")].filter((r) => r.scrollWidth > r.clientWidth + 1).length,
        );
        if (cut > 0) bad.push(`print ${where}: ${cut} lines cut`);
        await page.emulateMedia({ media: "screen" });

        if (size.width === 820) continue;
        await page.goto(songUrl);
        await expect(page.getByTestId("tab-staff").first()).toBeVisible();
        await page.waitForTimeout(120);
        bad.push(...(await measure(page)).map((x) => `song ${where}: ${x}`));
        await page.goto(`${songUrl}/capture/${parts.a}`);
        await expect(page.getByTestId("tab-staff").first()).toBeAttached();
        await page.waitForTimeout(120);
        bad.push(...(await measure(page)).map((x) => `capture ${where}: ${x}`));
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
}

const SYMBOLS = ["Em7", "Cmaj7", "F#m7b5", "Cm7b5add11"];

for (const symbol of SYMBOLS) {
  test(`INV-016 ${symbol}: one digit, two digits, adjacent, last, before a barline, on a repeat`, async ({ page }) => {
    const columns: Col[] = [
      q(3, { chord: symbol }),
      q(12, { chord: symbol }),
      q(3, { chord: symbol }),
      q(5),
      bar(),
      q(3, { chord: symbol, repeat: 2 }),
      q(5, { chord: symbol }),
      bar(),
      q(12),
      q(3, { chord: symbol }),
    ];
    const { songUrl, playUrl, parts } = await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
    const bad: string[] = [];
    for (const view of VIEWS) {
      await remember(page, view);
      for (const size of [{ width: 375, height: 667 }, { width: 1280, height: 800 }]) {
        await page.setViewportSize(size);
        for (const url of [playUrl, songUrl, `${songUrl}/capture/${parts.a}`]) {
          await page.goto(url);
          await expect(page.getByTestId("tab-staff").first()).toBeAttached();
          await page.waitForTimeout(120);
          bad.push(...(await measure(page)).map((x) => `${url.slice(-8)} ${view} @${size.width}: ${x}`));
        }
      }
    }
    expect([...new Set(bad)]).toEqual([]);
  });
}
