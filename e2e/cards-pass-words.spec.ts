/**
 * Spec 013 INV-010: the pass words sit last in the play view head row, so nothing blank opens before the next word and
 * nothing in the head row moves while the keys or the click walk the passes.
 */
import { expect, test, type Page } from "@playwright/test";
import { seedSong } from "./reading-helpers";
import { FOLD, bars, seedFitSong, seedFold } from "./wide-helpers";
import { setStoredTempo } from "./rhythm-probe-helpers";

test.setTimeout(300_000);

interface Box {
  left: number;
  right: number;
  top: number;
  height: number;
}
/** One head row at one instant: its children's boxes, the visible words' right edge, and the row's height. */
interface Snap {
  card: string;
  children: Box[];
  passes: number;
  textRight: number;
  height: number;
  gap: number;
}

/** Defined in the page so a key walk can snapshot synchronously after each press. */
const INSTALL = () => {
  const w = window as unknown as { __snap: () => Snap[] };
  w.__snap = () =>
    [...document.querySelectorAll<HTMLElement>("ol.reading-cards > li[data-card]")].flatMap((li) => {
      const passes = li.querySelector<HTMLElement>('[data-testid="card-passes"]');
      const head = passes?.parentElement;
      if (!passes || !head) return [];
      const live = li.hasAttribute("data-live-words");
      const layer = passes.querySelector(`[data-testid="card-passes-${live ? "live" : "rest"}"]`)!;
      const range = document.createRange();
      range.selectNodeContents(layer);
      const text = range.getBoundingClientRect();
      const kids = [...head.children].map((c) => {
        const r = c.getBoundingClientRect();
        return { left: r.left + scrollX, right: r.right + scrollX, top: r.top + scrollY, height: r.height };
      });
      const cs = getComputedStyle(head);
      return [
        {
          card: li.getAttribute("data-card")!,
          children: kids,
          passes: [...head.children].indexOf(passes),
          textRight: (text.width > 0 ? text.right : passes.getBoundingClientRect().left) + scrollX,
          height: head.getBoundingClientRect().height,
          gap: parseFloat(cs.columnGap) || 0,
        },
      ];
    });
};

const snap = (page: Page) => page.evaluate(() => (window as unknown as { __snap: () => Snap[] }).__snap());

/** Nothing later on the same line after the visible words, beyond a gap. */
function noHole(s: Snap, where: string) {
  const mine = s.children[s.passes];
  const later = s.children.filter((c, i) => i > s.passes && Math.abs(c.top - mine.top) < 1);
  for (const c of later) expect(c.left - s.textRight, `${where}: card ${s.card} blank before the next word`).toBeLessThanOrEqual(s.gap + 0.5);
}

function still(a: Snap[], b: Snap[], where: string) {
  expect(b.length, where).toBe(a.length);
  b.forEach((s, i) => {
    expect(s.height, `${where}: head height`).toBeCloseTo(a[i].height, 0);
    s.children.forEach((c, j) => {
      // The pass words' own slot may not change either; every child is held.
      expect(Math.abs(c.left - a[i].children[j].left), `${where}: child ${j} left`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(c.top - a[i].children[j].top), `${where}: child ${j} top`).toBeLessThanOrEqual(0.5);
    });
  });
}

const x12 = (page: Page) =>
  seedSong(
    page,
    [{ key: "a", label: "A", columns: bars(4) }],
    [{ part: "a", repeat: 12 }],
  );

const SONGS = {
  fit: seedFitSong,
  F5: (page: Page) => seedFold(page, FOLD.find((r) => r.id === "F5")!),
  x12,
} as const;

for (const id of Object.keys(SONGS) as (keyof typeof SONGS)[]) {
  for (const width of [375, 768, 1280]) {
    for (const mode of ["keys", "click"] as const) {
      test(`INV-010 no hole after the pass words: ${id} at ${width} by ${mode}`, async ({ page }, info) => {
        test.skip(info.project.name !== "desktop", "the viewport is set here");
        await page.setViewportSize({ width, height: 800 });
        const seeded = await SONGS[id](page);
        if (mode === "click") await setStoredTempo(page, 300);
        await page.goto(seeded.playUrl);
        const first = page.locator("ol.reading-cards > li[data-card]").first();
        await expect(first).toBeVisible();
        await expect(first.locator("[data-column]").first()).toBeAttached();
        await page.evaluate(INSTALL);
        await page.waitForTimeout(300);
        const rest = await snap(page);
        expect(rest.length, "a card with pass words").toBeGreaterThan(0);
        rest.forEach((s) => noHole(s, "rest"));

        const seen: Snap[][] = [];
        if (mode === "keys") {
          const total = await page.evaluate(() => document.querySelectorAll('ol.reading-cards > li [data-testid="tab-column"]').length * 12);
          const sampled = await page.evaluate((total) => {
            const w = window as unknown as { __snap: () => Snap[] };
            const out: Snap[][] = [];
            let last = "";
            for (let i = 0; i < total; i++) {
              window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
              const key = document.querySelector(".tab-column-reading")?.closest("li")?.querySelector('[data-testid="card-passes-live"]')?.textContent ?? "";
              if (key !== last) out.push(w.__snap());
              last = key;
            }
            return out;
          }, total);
          seen.push(...sampled);
        } else {
          await page.getByTestId("click-start").click();
          for (let i = 0; i < 16; i++) {
            await page.waitForTimeout(700);
            seen.push(await snap(page));
          }
          await page.getByTestId("click-stop").click();
          await page.waitForTimeout(300);
          seen.push(await snap(page));
        }
        expect(seen.length, "passes sampled").toBeGreaterThan(1);
        seen.forEach((s, i) => {
          s.forEach((c) => noHole(c, `sample ${i}`));
          still(rest, s, `sample ${i}`);
        });
      });
    }
  }
}
