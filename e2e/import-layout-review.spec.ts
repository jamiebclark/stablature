/**
 * INV-028: never does the panel widen the page, hide its text, or fall below contrast.
 * INV-029: the status line says what happened, in the real page.
 * INV-030: a long paste does not freeze typing, and the import completes.
 * 2 themes x {idle, one refusal, several, ready, offer} x {4, 5, 6 strings}, at 375x667.
 */
import { expect, test, type Page } from "@playwright/test";
import { THEMES } from "./capture-surface-helpers";
import { TUNINGS, emptySong, pasteTab, startWith, tabText } from "./import-helpers";

test.use({ viewport: { width: 375, height: 667 } });

const NAMES: Record<number, string[]> = {
  4: ["G", "D", "A", "E"],
  5: ["G", "D", "A", "E", "B"],
  6: ["E", "B", "G", "D", "A", "E"],
};

const rows = (names: string[], top: string) => {
  const rails = top.replace(/[^|]/g, "-");
  return names.map((n, i) => `${n} |${i === 0 ? top : rails}|`).join("\n");
};

/** A staff with a chord, so the notes and ignored lists have something in them too. */
const ready = (names: string[]) => `A lyric line\n\n${rows(names, "---5---7---")}`;

/** For a song in `names`, labels of the next size up, which only an offer can take. */
function offerText(strings: number) {
  if (strings === 4) return rows(NAMES[5], "-5-7-").replace(/B \|-----\|/, "B |-3---|");
  if (strings === 5) return rows(["C", "G", "D", "A", "E", "B"], "-5-7-").replace(/B \|-----\|/, "B |-3---|");
  return rows(["E", "B", "G", "D", "A", "E", "B"], "-5-7-").replace(/B \|-----\|$/, "B |-3---|");
}

async function audit(page: Page) {
  return page.getByTestId("paste-tab").evaluate((panel) => {
    const parse = (css: string) => (css.match(/[\d.]+/g) ?? []).map(Number);
    const lum = (rgb: number[]) => {
      const [r, g, b] = rgb.slice(0, 3).map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const surface = (el: Element): number[] => {
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c.length === 3 || (c.length === 4 && c[3] === 1)) return c;
      }
      return [255, 255, 255];
    };
    const low: string[] = [];
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim();
      const el = node.parentElement;
      if (!text || !el) continue;
      const fg = lum(parse(getComputedStyle(el).color));
      const bg = lum(surface(el));
      const [hi, lo] = [fg, bg].sort((a, b) => b - a);
      const ratio = (hi + 0.05) / (lo + 0.05);
      if (ratio < 4.5) low.push(`${ratio.toFixed(2)} ${el.tagName} ${el.className} "${text.slice(0, 30)}"`);
    }
    let faded = false;
    for (let n: Element | null = panel; n; n = n.parentElement) {
      if (Number(getComputedStyle(n).opacity) < 1) faded = true;
    }
    const outside: string[] = [];
    for (const el of panel.querySelectorAll('textarea, [role="status"], button, li')) {
      const r = el.getBoundingClientRect();
      if (r.left < -0.5 || r.right > window.innerWidth + 0.5) {
        outside.push(`${el.tagName} ${r.left.toFixed(0)}..${r.right.toFixed(0)}`);
      }
    }
    return {
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
      low: [...new Set(low)],
      faded,
      outside,
    };
  });
}

function expectClean(state: Awaited<ReturnType<typeof audit>>) {
  expect(state.scroll, "the page does not scroll sideways").toBeLessThanOrEqual(state.client);
  expect(state.outside, "nothing sits outside the viewport").toEqual([]);
  expect(state.low, "every text clears 4.5:1 on its real surface").toEqual([]);
  expect(state.faded, "no opacity tier").toBe(false);
}

for (const theme of THEMES) {
  for (const [index, tuning] of TUNINGS.entries()) {
    const strings = tuning.strings;
    const names = NAMES[strings];
    test(`${theme}, ${strings} strings: every state`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.emulateMedia({ colorScheme: theme });
      const seeded = await startWith(page, TUNINGS[index]);
      await emptySong(page, seeded.songUrl);
      await page.getByRole("button", { name: "Paste tab" }).first().click();
      const status = page.getByRole("status");

      await expect(status).toHaveText("Paste tab here.");
      expectClean(await audit(page));

      await pasteTab(page, rows(names, "-5s7-"));
      await expect(status).toHaveText("Line 1 could not be read. Nothing will be imported.");
      expectClean(await audit(page));

      await pasteTab(page, `${rows(names, "-5s7-")}\n\n${rows(names, "-57--")}`);
      await expect(status).toHaveText("2 lines could not be read. Nothing will be imported.");
      expectClean(await audit(page));

      await pasteTab(page, ready(names));
      await expect(status).toHaveText(/^Ready to import as part A\.$/);
      await expect(page.getByTestId("paste-ignored")).toBeVisible();
      expectClean(await audit(page));

      await pasteTab(page, offerText(strings));
      await expect(page.getByRole("button", { name: /^Switch to / })).toBeVisible();
      await expect(status).toHaveText(/^Ready to import as part A in /);
      expectClean(await audit(page));
    });
  }

  for (const width of [200, 2000]) {
    test(`${theme}: a line of ${width} characters, in the box and in a refusal`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      const seeded = await startWith(page, TUNINGS[0]);
      await emptySong(page, seeded.songUrl);
      await pasteTab(page, rows(NAMES[4], `-5s7${"-".repeat(width)}`));
      await expect(page.getByTestId("paste-refusals").locator("[data-line]").first()).toBeVisible();
      expectClean(await audit(page));
    });
  }

  test(`${theme}: a 2,000-column preview scrolls inside itself`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    const seeded = await startWith(page, TUNINGS[0]);
    await emptySong(page, seeded.songUrl);
    await pasteTab(page, await tabText(2000));
    await expect(page.getByRole("button", { name: /^Import as part/ })).toBeVisible();
    const state = await audit(page);
    expect(state.scroll).toBeLessThanOrEqual(state.client);
    expect(state.outside).toEqual([]);
  });
}

test("INV-030: a keystroke reaches the box within 100 ms, one at a time, and the import completes", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  await pasteTab(page, await tabText(2000));
  await expect(page.getByRole("button", { name: /^Import as part/ })).toBeVisible();
  const box = page.getByRole("textbox", { name: "Tab text" });
  await box.press("Control+End");
  // Trailing spaces read as nothing, so the reading and its import button survive the typing.
  const worst = await page.evaluate(async () => {
    const area = document.querySelector("textarea")!;
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    let max = 0;
    for (let i = 0; i < 8; i += 1) {
      const value = `${area.value} `;
      const start = performance.now();
      set.call(area, value);
      area.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(resolve));
      if (area.value !== value) throw new Error("the box lost a keystroke");
      max = Math.max(max, performance.now() - start);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }
    return max;
  });
  console.log(`worst keystroke to paint with 2,000 columns: ${worst.toFixed(1)} ms`);
  expect(worst).toBeLessThan(100);
  await page.getByRole("button", { name: /^Import as part/ }).click();
  await expect(page.locator('[id^="part-"]')).toHaveCount(1, { timeout: 30_000 });
});
