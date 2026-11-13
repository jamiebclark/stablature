/**
 * Review probe, spec 008 round 3, INV-004: every member of plan.md **Still** × {swiped to the top of the part, at
 * rest with the cursor's line at the bottom} × **Wr** (412x915 coarse with 16 bars; 1280x800 fine with 40 bars,
 * because a 16-bar part is one line there and could not show a move).
 *
 * Round 2's Still probe ran on mobile only, and `INV-004-tap-after-swipe-every-size.probe.ts` at 1280x800 uses a
 * 16-bar part that is one line there, so the desktop member of INV-004 had only the sync-arrival case.
 *
 * Each Still starts from a settled band (nothing outstanding: a fresh open, then the position is set by scrolling
 * the band, which is not a trigger). The band's scrollTop and every run's top must not move by more than 1px across
 * the Still alone. Records every move, then fails once with the whole list.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, mouseHold, touchHold } from "../../../e2e/probe-helpers";
import { blur, longPart } from "./helpers";

test.setTimeout(900_000);

type Where = "top" | "rest";

const state = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    return {
      wrapped: !!band.querySelector(".tab-staff-wrapped"),
      overflows: band.scrollHeight > band.clientHeight + 1,
      scroll: Math.round(band.scrollTop),
      tops: [...band.querySelectorAll(".tab-bar-run")].map((r) => Math.round(r.getBoundingClientRect().top)),
    };
  });
type State = Awaited<ReturnType<typeof state>>;
const same = (a: State, b: State) =>
  Math.abs(a.scroll - b.scroll) <= 1 && a.tops.length === b.tops.length && a.tops.every((t, i) => Math.abs(t - b.tops[i]) <= 1);

/** Indexes of columns wholly in view on the top visible line and on the next one down. */
const visibleLines = (page: Page) =>
  columns(page).evaluateAll((els) => {
    const band = document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect();
    const seen = els
      .map((e, i) => ({ i, r: e.getBoundingClientRect(), barline: e.querySelector('[data-testid="tab-barline"]') !== null }))
      .filter(({ r }) => r.top >= band.top - 0.5 && r.bottom <= band.bottom + 0.5 && r.left >= band.left && r.right <= band.right);
    const tops = [...new Set(seen.map((s) => Math.round(s.r.top)))].sort((a, b) => a - b);
    const on = (t: number) => seen.filter((s) => Math.round(s.r.top) === t).map((s) => s.i);
    return { first: on(tops[0]), second: tops.length > 1 ? on(tops[1]) : [] };
  });

const hold = (page: Page, i: number, touch: boolean) => (touch ? touchHold(page, columns(page).nth(i)) : mouseHold(page, columns(page).nth(i)));
const selectRun = async (page: Page, a: number, b: number) => {
  await columns(page).nth(a).click();
  await page.getByRole("button", { name: /^select$/ }).click();
  await columns(page).nth(b).click();
};

interface Still {
  name: string;
  act: (page: Page, lines: { first: number[]; second: number[] }, touch: boolean) => Promise<void>;
}

const STILLS: Still[] = [
  { name: "tap a column on the top visible line", act: (p, l) => columns(p).nth(l.first[1] ?? l.first[0]).click() },
  { name: "tap a column on the second visible line", act: (p, l) => columns(p).nth(l.second[1] ?? l.second[0]).click() },
  {
    name: "select",
    act: async (p, l) => {
      await columns(p).nth(l.first[1]).click();
      await p.waitForTimeout(900);
      const s = await state(p);
      await p.getByRole("button", { name: /^select$/ }).click();
      await p.waitForTimeout(900);
      if (!same(s, await state(p))) throw new Error(`select alone moved: ${s.scroll} -> ${(await state(p)).scroll}`);
    },
  },
  { name: "select, then extend to another line", act: (p, l) => selectRun(p, l.first[1], l.second[1]) },
  { name: "cancel a selection", act: async (p, l) => { await selectRun(p, l.first[1], l.first[2]); await p.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click(); } },
  { name: "copy", act: async (p, l) => { await selectRun(p, l.first[1], l.first[2]); await p.getByTestId("toolbar-selection").getByTitle("Copy").click(); } },
  {
    name: "group from a selection",
    act: async (p, l) => {
      await selectRun(p, l.second[1], l.second[2]);
      await p.getByTestId("toolbar-selection").getByRole("button", { name: "Group with no number", exact: true }).click();
    },
  },
  {
    name: "ungroup",
    act: async (p, l) => {
      await selectRun(p, l.second[1], l.second[2]);
      await p.getByTestId("toolbar-selection").getByRole("button", { name: "Group with no number", exact: true }).click();
      await p.waitForTimeout(900);
      await selectRun(p, l.second[1], l.second[2]);
      await p.getByTestId("toolbar-selection").getByRole("button", { name: "Ungroup", exact: true }).click();
    },
  },
  { name: "long press", act: async (p, l, touch) => { await hold(p, l.first[1], touch); await p.keyboard.press("Escape"); } },
  {
    name: "an inspector write",
    act: async (p, l, touch) => {
      await hold(p, l.first[1], touch);
      await p.getByTestId("column-inspector").getByRole("button", { name: /dead|ghost|x/i }).first().click();
      await p.keyboard.press("Escape");
    },
  },
  { name: "the help overlay", act: async (p) => { await blur(p); await p.keyboard.press("?"); await p.waitForTimeout(300); await p.keyboard.press("Escape"); } },
];

const CONFIGS = [
  { project: "mobile", size: { width: 412, height: 915 }, bars: 16, touch: true, label: "412x915 coarse, 16 bars" },
  { project: "desktop", size: { width: 1280, height: 800 }, bars: 40, touch: false, label: "1280x800 fine, 40 bars" },
];

async function settle(page: Page, partUrl: string, where: Where) {
  await page.goto(partUrl);
  await expect(columns(page).first()).toBeVisible();
  await page.waitForTimeout(900);
  if (where === "top") {
    await page.evaluate(() => {
      const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
      band.scrollTop = -(band.scrollHeight - band.clientHeight);
    });
    await page.waitForTimeout(400);
  }
}

for (const config of CONFIGS) {
  test(`INV-004 every Still x {top, at rest} leaves the band where it is (${config.label})`, async ({ page }, info) => {
    test.skip(info.project.name !== config.project, `runs on ${config.project}`);
    const { partUrl } = await longPart(page, { chord: true, bracket: true, bars: config.bars, size: config.size });
    const moved: string[] = [];
    const held: string[] = [];
    let checked = 0;

    const run = async (name: string, where: Where, act: (lines: { first: number[]; second: number[] }) => Promise<void>) => {
      await settle(page, partUrl, where);
      const before = await state(page);
      expect(before.wrapped && before.overflows, `${name}: the part must overflow a wrapped band`).toBe(true);
      const lines = await visibleLines(page);
      try {
        await act(lines);
      } catch (error) {
        moved.push(`${name} (${where}): could not run: ${String(error).split("\n")[0].slice(0, 160)}`);
        return;
      }
      await page.waitForTimeout(900);
      const after = await state(page);
      checked++;
      const line = `${name} (${where}): scrollTop ${before.scroll} -> ${after.scroll}, top run ${before.tops[0]} -> ${after.tops[0]}`;
      (same(before, after) ? held : moved).push(line);
    };

    for (const still of STILLS)
      for (const where of ["top", "rest"] as const) await run(still.name, where, (l) => still.act(page, l, config.touch));

    // Each latch toggle, one at a time, each toggled on and off again.
    await settle(page, partUrl, "rest");
    const latches = await page.getByTestId("latch-strip").getByRole("button").count();
    for (let i = 0; i < latches; i++) {
      for (const where of ["top", "rest"] as const) {
        await run(`latch ${i + 1} of ${latches}`, where, async () => {
          const b = page.getByTestId("latch-strip").getByRole("button").nth(i);
          if (await b.isDisabled()) throw new Error("disabled here");
          await b.click();
          await page.waitForTimeout(300);
          await b.click();
        });
      }
    }

    // A sync arrival from a second tab, with no trigger before it.
    const other = await page.context().newPage();
    await other.setViewportSize({ width: 412, height: 915 });
    await other.goto(partUrl);
    await expect(columns(other).first()).toBeVisible();
    for (const where of ["top", "rest"] as const) {
      await page.bringToFront();
      await run("a sync arrival from a second tab", where, async () => {
        const count = await columns(page).count();
        await other.locator('button[aria-label*=" string, fret 3,"]').first().click();
        await expect.poll(() => columns(page).count(), { timeout: 5000 }).toBe(count + 1);
      });
    }

    // Negative control: from the same setup, a trigger (the end jump, from line 1) must move the band, so "held"
    // above is evidence and not a band that cannot move.
    await settle(page, partUrl, "top");
    const lines = await visibleLines(page);
    await columns(page).nth(lines.first[1]).click();
    await page.waitForTimeout(900);
    const pre = await state(page);
    await page.getByTestId("status-row").getByRole("button", { name: "end ⇥" }).click();
    await page.waitForTimeout(900);
    const post = await state(page);
    console.log(`control, end jump from line 1: scrollTop ${pre.scroll} -> ${post.scroll}`);
    expect(same(pre, post), "control: the end jump must move the band").toBe(false);

    console.log(`[${config.label}] ${checked} checked\nheld:\n  ${held.join("\n  ")}\nmoved:\n  ${moved.join("\n  ")}`);
    expect(moved, moved.join("\n")).toEqual([]);
  });
}
