/**
 * Review probe, spec 008 INV-021 and INV-022 over the plan's full matrix at 375 (touch):
 * **Lat** (7) × **Chd** (none, Am, Dsus4, Cm7b5add11, an unknown symbol) × **Dur** (none, whole note, and
 * thirty-second note in place of "dotted sixteenth", which this codebase cannot store) × {digit waiting, none}
 * × {end, start, mid}, plus the triplet refusal. The implementation's extension covers 2 latch states and 1 chord.
 *
 * INV-021: one line, at most 26px; the position words whole; a symbol of up to ten characters whole (not beside a
 * refusal); a rule between adjacent visible segments; the symbol heavier than the tones; a screen reader hears
 * "<symbol> chord: <t1>, <t2>, …"; both jumps at least 44x24 and inside the row.
 * Also FR-031's order: the duration is never cut while the tones still show (tones give way first).
 * INV-022: the position words equal a hand table of today's literals.
 */
import { expect, test, type Page } from "@playwright/test";
import { latch, stackLatch } from "../../../e2e/capture-surface-helpers";
import { n, seedSong } from "../../../e2e/reading-helpers";

test.setTimeout(600_000);

const CHD = [
  { name: "no chord", symbol: null as string | null, tones: [] as string[] },
  { name: "Am", symbol: "Am", tones: ["A", "C", "E"] },
  { name: "Dsus4", symbol: "Dsus4", tones: ["D", "G", "A"] },
  { name: "Cm7b5add11", symbol: "Cm7b5add11", tones: [] },
  { name: "unknown", symbol: "Zq7", tones: [] },
];
const DUR = [
  { name: "no duration", d: undefined as string | undefined },
  { name: "whole note", d: "w" },
  { name: "thirty-second note", d: "32" },
];
const LAT: { name: string; press: string[] }[] = [
  { name: "none", press: [] },
  { name: "stack", press: ["stack"] },
  { name: "hammer-on", press: ["hammer-on"] },
  { name: "pull-off", press: ["pull-off"] },
  { name: "slide up", press: ["slide up"] },
  { name: "slide down", press: ["slide down"] },
  { name: "stack and a transition", press: ["stack", "slide down"] },
];
const POS = ["end", "start", "mid"] as const;

/** Hand table of today's position and latch words (spec 001 FR-007, spec 002 FR-023, latches.ts at main). */
const LONG: Record<string, string> = {
  stack: "stacking onto the marked column",
  "hammer-on": "next note: hammer-on",
  "pull-off": "next note: pull-off",
  "slide up": "next note: slide up",
  "slide down": "next note: slide down",
};
const ORDER = ["stack", "hammer-on", "pull-off", "slide up", "slide down"];
function expected(lit: string[], pos: (typeof POS)[number], digit: boolean): string {
  const sorted = ORDER.filter((l) => lit.includes(l));
  if (sorted.length === 0) {
    if (digit) return { end: "at the end", start: "at the start", mid: "after the mark" }[pos];
    return { end: "adding at the end", start: "adding at the start", mid: "adding after the marked column" }[pos];
  }
  if (sorted.length === 1 && !digit) return LONG[sorted[0]];
  return sorted.join(" + ");
}

const read = (page: Page) =>
  page.getByTestId("status-row").evaluate((row) => {
    const q = (id: string) => row.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    const box = row.getBoundingClientRect();
    const right = box.right - parseFloat(getComputedStyle(row).paddingRight);
    const shown = (el: HTMLElement | null) => !!el && el.getBoundingClientRect().width > 0.5;
    const cut = (el: HTMLElement | null) => !!el && el.scrollWidth > el.clientWidth + 0.5;
    const rule = (el: Element | null) => !!el && el.getAttribute("aria-hidden") === "true" && el.getBoundingClientRect().width <= 1.5 && el.getBoundingClientRect().width > 0;
    const position = q("status-position");
    const symbol = q("status-symbol");
    const tones = q("status-tones");
    const duration = q("cursor-duration") ?? q("digit-waiting");
    const buttons = [...row.querySelectorAll<HTMLButtonElement>(":scope > button")];
    const problems: string[] = [];
    if (box.height > 26.5) problems.push(`row ${box.height}px`);
    // sr-only text is absolutely placed; it is heard, not drawn.
    const tops = [...row.children].filter((c) => getComputedStyle(c).position !== "absolute" && (c as HTMLElement).getBoundingClientRect().width > 0).map((c) => Math.round((c as HTMLElement).getBoundingClientRect().top));
    if (Math.max(...tops) - Math.min(...tops) > 8) problems.push("row wraps");
    if (!position) problems.push("no status-position");
    else if (cut(position) || position.getBoundingClientRect().right > right + 0.5) problems.push(`position cut: ${position.textContent}`);
    if (symbol && shown(symbol) && !rule(symbol.previousElementSibling)) problems.push("no rule before the symbol");
    if (duration && shown(duration) && !rule(duration.querySelector("[aria-hidden=true]"))) problems.push(`no rule inside ${duration.dataset.testid}`);
    if (buttons[0] && !rule(buttons[0].previousElementSibling)) problems.push("no rule before the jumps");
    if (buttons.length !== 2) problems.push(`${buttons.length} jumps`);
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      if (r.right > right + 0.5 || r.width < 43.5 || r.height < 23.5) problems.push(`jump ${b.textContent} ${r.width.toFixed(1)}x${r.height.toFixed(1)} right ${r.right.toFixed(1)}/${right.toFixed(1)}`);
    }
    if (symbol && tones && Number(getComputedStyle(symbol).fontWeight) <= Number(getComputedStyle(tones).fontWeight)) problems.push("symbol not heavier than tones");
    // What a screen reader hears: text not under aria-hidden.
    let heard = "";
    const walk = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
    for (let t = walk.nextNode(); t; t = walk.nextNode()) if (!t.parentElement!.closest("[aria-hidden=true]")) heard += `${t.textContent}|`;
    return {
      problems,
      position: position?.textContent ?? "",
      symbol: symbol?.textContent ?? null,
      symbolCut: cut(symbol) || (!!symbol && symbol.getBoundingClientRect().right > right + 0.5),
      tonesShown: shown(tones) && !!tones && tones.clientWidth > 2,
      tonesCut: cut(tones),
      durationCut: !!duration && duration.dataset.testid === "cursor-duration" && cut(duration),
      heard,
      widths: `tones ${tones?.clientWidth ?? 0}/${tones?.scrollWidth ?? 0}px, duration ${duration?.clientWidth ?? 0}/${duration?.scrollWidth ?? 0}px`,
    };
  });

async function arm(page: Page, names: string[]): Promise<boolean> {
  for (const name of names) {
    const control = name === "stack" ? stackLatch(page) : latch(page, name);
    if (!(await control.isEnabled({ timeout: 1000 }).catch(() => false))) return false;
    await control.click();
  }
  return true;
}
const litNow = (page: Page) =>
  page.getByTestId("latch-strip").locator('button[aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent ?? ""));
const litName = (label: string) => (label.startsWith("stack") ? "stack" : (ORDER.find((o) => label.includes(o)) ?? label));

for (const chd of CHD) {
  for (const dur of DUR) {
    test(`INV-021/022 ${chd.name}, ${dur.name}: every latch x position x digit, and the refusal`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "budgeted at 375 on touch");
      const cols = [n(3, { d: dur.d, chord: chd.symbol ?? undefined }), n(5, { d: dur.d }), n(7, { d: dur.d }), n(8, { d: dur.d })];
      const { songId, parts } = await seedSong(page, [{ key: "a", label: "A", columns: cols }], [{ part: "a" }]);
      await page.setViewportSize({ width: 375, height: 667 });
      const url = `/songs/${songId}/capture/${parts.a}`;
      const bad: string[] = [];
      let states = 0;
      for (const pos of POS) {
        for (const lat of LAT) {
          for (const digit of [false, true]) {
            await page.goto(url);
            await expect(page.getByTestId("tab-column").first()).toBeVisible();
            if (pos === "start") await page.getByTestId("status-row").getByRole("button", { name: "⇤ start" }).click();
            if (pos === "mid") await page.getByTestId("tab-column").nth(1).click();
            if (!(await arm(page, lat.press))) continue;
            if (digit) {
              await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
              await page.keyboard.press("1");
              await expect(page.getByTestId("digit-waiting")).toBeVisible();
            }
            await page.waitForTimeout(60);
            const r = await read(page);
            const lit = (await litNow(page)).map(litName);
            const label = `${pos}, ${lat.name} (lit ${lit.join("+") || "none"}), digit ${digit}`;
            states++;
            bad.push(...r.problems.map((p) => `${label}: ${p}`));
            const want = expected(lit, pos, digit);
            if (r.position !== want) bad.push(`${label}: position words "${r.position}", today's are "${want}"`);
            if (r.symbol && r.symbol.length <= 10 && r.symbolCut) bad.push(`${label}: symbol ${r.symbol} cut`);
            if (chd.tones.length && r.symbol === chd.symbol) {
              const hears = `${chd.symbol}| chord:|${chd.tones.join(", ")}|`;
              if (!r.heard.includes(hears)) bad.push(`${label}: heard "${r.heard}"`);
            }
            if (r.durationCut && r.tonesShown) bad.push(`${label}: duration cut while the tones still show (tones must give way first; shown/full ${r.widths})`);
          }
        }
      }
      // The refusal, mid-part where three columns do not end at the cursor.
      await page.goto(url);
      await page.getByTestId("tab-column").nth(1).click();
      await page.getByRole("button", { name: "Triplet", exact: true }).click();
      await expect(page.getByText("a triplet needs three columns in one bar")).toBeVisible();
      const r = await read(page);
      states++;
      bad.push(...r.problems.map((p) => `refusal: ${p}`));
      if (r.position !== "a triplet needs three columns in one bar") bad.push(`refusal words "${r.position}"`);
      console.log(`  ${chd.name}, ${dur.name}: ${states} states, ${bad.length} problems`);
      for (const b of bad) console.log(`    BAD ${b}`);
      expect(bad).toEqual([]);
    });
  }
}
