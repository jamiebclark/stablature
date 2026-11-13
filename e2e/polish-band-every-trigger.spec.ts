/**
 * Adopted from the round-1 review probe, spec 008 INV-003: after every anchor trigger (plan.md **Trig**), from every cursor position (**Pos**),
 * on every wrapped size (**Wr**, plus **Wr390**), the cursor's line is the band's bottom line when the part overflows.
 * Before each trigger the band is swiped away, so a trigger that does not anchor is seen.
 * Records every miss, then fails once with the whole list.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, deleteButton, fret as _fret, space, triplet } from "./probe-helpers";
import { bandGeometry, blur, decorate, longPart, seedBars, SIX, swipeAway } from "./polish-review-helpers";

void _fret;
test.setTimeout(1_500_000);

type Pos = "end" | "mid-last" | "mid-upper" | "start";
const POS: Pos[] = ["end", "mid-last", "mid-upper", "start"];

const jump = (page: Page, which: "start" | "end") =>
  page.getByTestId("status-row").getByRole("button", { name: which === "start" ? "⇤ start" : "end ⇥" });

async function setPos(page: Page, pos: Pos) {
  if (pos === "end" || pos === "start") {
    await jump(page, pos).click();
  } else {
    const index = await columns(page).evaluateAll((els, pos) => {
      const runs = [...new Set(els.map((e) => e.closest(".tab-bar-run")!))];
      const run = pos === "mid-last" ? runs[runs.length - 1] : runs[Math.floor(runs.length / 2)];
      const mine = els.filter((e) => e.closest(".tab-bar-run") === run);
      const pick = mine[Math.min(1, mine.length - 1)];
      return els.indexOf(pick);
    }, pos);
    await columns(page).nth(index).click();
  }
  await page.waitForTimeout(650);
}

interface Trigger {
  name: string;
  /** Positions this trigger is defined at (a repeat needs a column under the cursor). */
  at?: Pos[];
  prep?: (page: Page) => Promise<void>;
  act: (page: Page) => Promise<void>;
  after?: (page: Page) => Promise<void>;
}

const fretButton = (page: Page) => page.locator('button[aria-label*=" string, fret 3,"]').first();
const key = (k: string) => async (page: Page) => {
  await blur(page);
  await page.keyboard.press(k);
};

function triggers(size: { width: number; height: number }, partUrl: string): Trigger[] {
  return [
    { name: "open", at: ["end", "mid-upper"], act: async (p) => { await p.goto(partUrl); await expect(columns(p).first()).toBeVisible(); } },
    { name: "fret tap", act: (p) => fretButton(p).click() },
    { name: "typed fret", act: async (p) => { await blur(p); await p.keyboard.press("3"); await p.keyboard.press("Enter"); } },
    { name: "dead-note key", act: key("x") },
    { name: "space", act: (p) => space(p) },
    { name: "barline", act: (p) => p.getByTestId("toolbar-stable").getByRole("button", { name: "Barline" }).click() },
    { name: "paste", act: (p) => p.getByRole("button", { name: /paste/ }).click() },
    { name: "stable delete", at: ["end", "mid-last", "mid-upper"], act: (p) => deleteButton(p).click() },
    { name: "repeat +", at: ["end", "mid-last", "mid-upper"], act: (p) => p.getByRole("button", { name: "Repeat one more time" }).click() },
    {
      name: "repeat −",
      at: ["end", "mid-last", "mid-upper"],
      prep: async (p) => { await p.getByRole("button", { name: "Repeat one more time" }).click(); await p.waitForTimeout(650); },
      act: (p) => p.getByRole("button", { name: "Repeat one fewer time" }).click(),
    },
    { name: "×4", at: ["end", "mid-last", "mid-upper"], act: (p) => p.getByTitle("Four of these").click() },
    {
      name: "chord symbol set",
      at: ["end", "mid-last", "mid-upper"],
      prep: async (p) => { await p.getByRole("button", { name: "chord symbol" }).click(); await p.getByRole("textbox", { name: "Chord" }).fill("Dsus4"); await p.waitForTimeout(650); },
      act: (p) => p.getByRole("button", { name: "Set" }).click(),
    },
    { name: "triplet", at: ["end", "mid-last", "mid-upper"], act: (p) => triplet(p).click() },
    { name: "column back", act: key("ArrowLeft") },
    { name: "column on", act: key("ArrowRight") },
    { name: "bar back", act: key("[") },
    { name: "bar on", act: key("]") },
    { name: "start key", act: key("Home") },
    { name: "end key", act: key("End") },
    { name: "start jump", act: (p) => jump(p, "start").click() },
    { name: "end jump", act: (p) => jump(p, "end").click() },
    {
      name: "cut selection",
      at: ["mid-last", "mid-upper"],
      prep: async (p) => { await p.getByRole("button", { name: /^select$/ }).click(); await p.keyboard.press("ArrowRight").catch(() => undefined); await p.waitForTimeout(400); },
      act: (p) => p.getByTestId("toolbar-selection").getByTitle("Cut").click(),
    },
    {
      name: "delete selection",
      at: ["mid-last", "mid-upper"],
      prep: async (p) => { await p.getByRole("button", { name: /^select$/ }).click(); await p.waitForTimeout(400); },
      act: (p) => p.getByTestId("toolbar-selection").getByTitle("Delete").click(),
    },
    {
      name: "part change by chip",
      act: (p) => p.getByTestId("capture-title-row").getByRole("link", { name: "B", exact: true }).click(),
      after: async (p) => { await p.getByTestId("capture-title-row").getByRole("link", { name: "A", exact: true }).click(); await p.waitForTimeout(800); },
    },
    {
      name: "part change by key",
      act: key("."),
      after: async (p) => { await key(",")(p); await p.waitForTimeout(800); },
    },
    {
      name: "band resize: window height",
      act: (p) => p.setViewportSize({ width: size.width, height: size.height - 24 }),
      after: async (p) => { await p.setViewportSize(size); await p.waitForTimeout(650); },
    },
    {
      name: "band resize: window width",
      act: (p) => p.setViewportSize({ width: size.width - 24, height: size.height }),
      after: async (p) => { await p.setViewportSize(size); await p.waitForTimeout(650); },
    },
    {
      name: "band resize: chord form open",
      at: ["end", "mid-last", "mid-upper"],
      act: (p) => p.getByRole("button", { name: "chord symbol" }).click(),
      after: async (p) => { await p.keyboard.press("Escape"); await p.getByRole("button", { name: /^cancel$/i }).click({ timeout: 500 }).catch(() => undefined); await p.waitForTimeout(650); },
    },
    {
      name: "entering wrapped mode",
      prep: async (p) => { await p.setViewportSize({ width: 375, height: 560 }); await p.waitForTimeout(650); },
      act: (p) => p.setViewportSize(size),
    },
  ];
}

const CONFIGS = [
  { project: "mobile", size: { width: 412, height: 915 }, bracket: true, label: "Wr 412x915 coarse" },
  { project: "desktop", size: { width: 1280, height: 800 }, bracket: true, label: "Wr 1280x800 fine" },
  { project: "mobile", size: { width: 390, height: 844 }, bracket: false, label: "Wr390 390x844 coarse, no bracket" },
];

const CHUNK = 8;
for (const config of CONFIGS) {
 for (let chunk = 0; chunk * CHUNK < triggers(config.size, "").length; chunk++) {
  test(`INV-003 every trigger x every position anchors the cursor's line (${config.label}, triggers ${chunk * CHUNK + 1}-${(chunk + 1) * CHUNK})`, async ({ page }, info) => {
    test.skip(info.project.name !== config.project, `runs on ${config.project}`);
    const { partUrl } = await longPart(page, { chord: true, bracket: config.bracket, bars: 16, size: config.size });
    // A second long part, B, for the part-change triggers.
    await page.getByRole("button", { name: "Add a part" }).click();
    await expect(page).not.toHaveURL(partUrl);
    await expect(columns(page)).toHaveCount(0);
    await decorate(page, { chord: true });
    await seedBars(page, page.url().split("/").pop()!, SIX.strings, 16);
    await page.goto(partUrl);
    await page.waitForTimeout(700);
    // Something to paste.
    await columns(page).nth(5).click();
    await page.getByRole("button", { name: /^select$/ }).click();
    await columns(page).nth(6).click();
    await page.getByTestId("toolbar-selection").getByTitle("Copy").click();
    await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click({ timeout: 1000 }).catch(() => undefined);
    await page.waitForTimeout(650);

    const misses: string[] = [];
    const ran: string[] = [];
    // The control needs a part that overflows: a one-line band has no line to swipe away from the cursor.
    if (chunk === 0 && (await bandGeometry(page)).overflows) {
      // Control, so the probe is seen able to fail: a swipe, then a tap (a Still) on the top line in view, must NOT be anchored.
      await setPos(page, "end");
      await swipeAway(page);
      await page.waitForTimeout(200);
      const top = await columns(page).evaluateAll((els) => {
        const band = document.querySelector("[data-testid=\"tab-band\"]")!.getBoundingClientRect();
        const seen = els.map((e, i) => ({ i, r: e.getBoundingClientRect() })).filter(({ r }) => r.top >= band.top && r.bottom <= band.bottom);
        const first = Math.min(...seen.map((x) => x.r.top));
        return seen.filter((x) => x.r.top === first)[1]?.i ?? seen[0].i;
      });
      await columns(page).nth(top).click();
      await page.waitForTimeout(800);
      const g = await bandGeometry(page);
      expect(g.wrapped && g.cursorBottom !== null && Math.abs(g.cursorBottom - g.bottom) > 1, "control: a tap after a swipe is not anchored").toBe(true);
    }
    for (const t of triggers(config.size, partUrl).slice(chunk * CHUNK, (chunk + 1) * CHUNK)) {
      for (const pos of t.at ?? POS) {
        const label = `${t.name} @ ${pos}`;
        try {
          await setPos(page, pos);
          if (t.prep) await t.prep(page);
          await swipeAway(page);
          await page.waitForTimeout(120);
          const away = await bandGeometry(page);
          await t.act(page);
          await page.waitForTimeout(800);
          const g = await bandGeometry(page);
          ran.push(label);
          // FR-002: one line is right when two whole lines do not fit; then the caret must still be in view (edge case: chord form).
          const fits = g.content >= 2 * g.line + g.gap;
          if (!g.wrapped && fits) misses.push(`${label}: not wrapped though two lines fit (content ${g.content}, line ${g.line})`);
          else if (!g.wrapped) {
            const seen = await page.evaluate(() => {
              const band = document.querySelector("[data-testid=\"tab-band\"]")!.getBoundingClientRect();
              const c = document.querySelector("[data-testid=\"tab-caret\"]")?.getBoundingClientRect();
              return !c || (c.left >= band.left - 1 && c.right <= band.right + 1);
            });
            if (!seen) misses.push(`${label}: one line, caret out of view`);
          }
          else if (g.overflows && g.cursorBottom !== null && Math.abs(g.cursorBottom - g.bottom) > 1)
            misses.push(`${label}: cursor line bottom ${g.cursorBottom.toFixed(1)} vs band bottom ${g.bottom.toFixed(1)} (swiped-away bottom was ${away.cursorBottom?.toFixed(1)})`);
          else if (g.cursorBottom === null) misses.push(`${label}: no cursor mark found`);
          if (t.after) await t.after(page);
        } catch (error) {
          misses.push(`${label}: could not run (${String(error).split("\n")[0].slice(0, 140)})`);
          await page.keyboard.press("Escape").catch(() => undefined);
          await page.goto(partUrl);
          await page.waitForTimeout(800);
        }
      }
    }
    console.log(`[${config.label}] ran ${ran.length} trials; ${misses.length} misses`);
    for (const m of misses) console.log(`  MISS ${m}`);
    expect(misses, `${config.label}: ${ran.length} trials`).toEqual([]);
  });
 }
}
