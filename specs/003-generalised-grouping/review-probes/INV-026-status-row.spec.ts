/**
 * INV-026 / SC-010, round 3. T064 and T070 put the status row on one line with `truncate` and
 * `overflow-hidden`, in every state and not only during a refusal, so this reaches people who
 * never group. For every status the row can show, beside every kind of chord, at 375x667: is the
 * status cut, does either jump button leave the row, and what does main's markup do with the same
 * text? Main's classes are put back in the live DOM, so that column is the geometry, not a build.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addNotes,
  chip,
  columns,
  PHONE,
  refusal,
  setChordOn,
  startCapturing,
  status,
  triplet,
} from "./probe-helpers";

const row = (page: Page) => status(page).locator("xpath=..");

async function read(page: Page) {
  return status(page).evaluate((el) => {
    const parent = el.parentElement!;
    const edge = parent.getBoundingClientRect().right;
    const jumps = [...parent.querySelectorAll("button")].map((b) => b.getBoundingClientRect().right);
    const ours = {
      text: el.textContent,
      cut: el.scrollWidth > el.clientWidth,
      shows: el.clientWidth,
      needs: el.scrollWidth,
      row: Math.round(parent.getBoundingClientRect().height * 10) / 10,
      jumpsInside: jumps.every((right) => right <= edge + 0.5),
    };
    const was = [parent.getAttribute("class") ?? "", el.getAttribute("class") ?? ""];
    parent.classList.remove("overflow-hidden", "whitespace-nowrap");
    el.classList.remove("min-w-0", "truncate");
    const main = {
      row: Math.round(parent.getBoundingClientRect().height * 10) / 10,
      cut: el.scrollWidth > el.clientWidth,
    };
    parent.setAttribute("class", was[0]);
    el.setAttribute("class", was[1]);
    return { ...ours, main };
  });
}

const LATCH_STATES: readonly { name: string; chips: readonly (string | RegExp)[] }[] = [
  { name: "no latch", chips: [] },
  { name: "stack", chips: [/^stack notes/] },
  { name: "hammer-on", chips: ["hammer-on"] },
  { name: "pull-off", chips: ["pull-off"] },
  { name: "slide up", chips: ["slide up"] },
  { name: "slide down", chips: ["slide down"] },
  { name: "stack and slide down", chips: [/^stack notes/, "slide down"] },
];

test.describe("the status row at 375x667", () => {
  test.use({ viewport: PHONE });

  for (const symbol of [null, "Am", "Cmaj7", "F#m7b5", "Zork"]) {
    test(`every status beside ${symbol ?? "no chord"}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await startCapturing(page);
      await addNotes(page, 3);
      if (symbol) await setChordOn(page, 0, symbol);
      await columns(page).nth(1).click();
      const seen = [];
      for (const state of LATCH_STATES) {
        for (const c of state.chips) await chip(page, c).click();
        await expect(status(page)).toBeVisible();
        seen.push({ state: state.name, ...(await read(page)) });
        for (const c of state.chips) await chip(page, c).click();
      }
      await page.getByRole("button", { name: /end/ }).last().click();
      await expect(row(page)).toBeVisible();
      seen.push({ state: "at the end", ...(await read(page)) });
      for (const s of seen) console.log(JSON.stringify({ symbol, ...s }));
      expect(seen.filter((s) => !s.jumpsInside), "a jump button left the row").toEqual([]);
      expect(seen.filter((s) => s.cut && !s.main.cut).map((s) => s.state), "cut here, whole on main").toEqual([]);
    });
  }

  /** T070 made the refusal `shrink-0`, so whatever else is on the row has to give way, not leave. */
  for (const symbol of [null, "Am", "Cmaj7", "F#m7b5", "Zork"]) {
    test(`a refusal keeps both jump buttons on the row, beside ${symbol ?? "no chord"}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await startCapturing(page);
      await addNotes(page, 2);
      if (symbol) await setChordOn(page, 0, symbol);
      await columns(page).nth(1).click();
      await triplet(page).click();
      await expect(refusal(page)).toBeVisible();
      const m = await refusal(page).evaluate((el) => {
        const parent = el.parentElement!;
        const edge = parent.getBoundingClientRect();
        return {
          row: Math.round(edge.height * 10) / 10,
          sentenceWhole: el.scrollWidth <= el.clientWidth,
          buttons: [...parent.querySelectorAll("button")].map((b) => {
            const r = b.getBoundingClientRect();
            return { text: b.textContent, inside: r.left >= edge.left && r.right <= edge.right + 0.5 };
          }),
          siblings: [...parent.children]
            .filter((c) => c !== el && c.tagName === "SPAN")
            .map((c) => Math.round(c.getBoundingClientRect().width)),
        };
      });
      console.log(JSON.stringify({ symbol, ...m }));
      expect(m.sentenceWhole).toBe(true);
      expect(m.row).toBeLessThanOrEqual(30);
      expect(m.buttons.map((b) => b.inside)).toEqual([true, true]);
    });
  }
});
