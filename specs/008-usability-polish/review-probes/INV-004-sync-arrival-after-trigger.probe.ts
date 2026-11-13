/**
 * Review probe, spec 008 round 2, INV-004 member "a sync arrival from a second context" × {the top line in view}
 * × Wr (412x915 coarse; 1280x800 fine with 40 bars, because a 16-bar part fits on one line there).
 *
 * Page A captures; page B, a second tab on the same origin, writes through the app (a fret tap at the end of the
 * same part), so A's live query delivers a change A did not make, as a sync pull would. Before B writes, A runs one
 * trigger (or a Still, as control), waits until every write has landed, and is swiped to the top line. The band's
 * scrollTop and the top line's position must not move when B's write arrives, however long after the trigger.
 *
 * Round 2: `useCaptureBand` keeps a bump outstanding until both the content and the cursor have changed once. A
 * trigger whose write changes neither (a jump to where the cursor already is, a chord symbol, which writes an
 * annotation and not a column) or only one of them (×4, repeat, triplet at the end) leaves it outstanding, and the
 * next sync arrival is then anchored.
 *
 * The mid-part and start members cannot discriminate: on this part, the swiped-to-top position is where line 1 or 2
 * anchors anyway, so "held" there is not evidence. The members at the end are the evidence (7 of 7 moved at both
 * sizes in round 2, and the End key through the real server).
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, space, startCapturing, triplet } from "../../../e2e/probe-helpers";
import { blur, longPart } from "./helpers";

test.setTimeout(600_000);

type Pos = "end" | "mid" | "start";
interface Case {
  name: string;
  pos: Pos;
  /** A Still: expected never to anchor, so it is the control. */
  still?: boolean;
  act: (page: Page) => Promise<void>;
}

const jump = (page: Page, which: "start" | "end") =>
  page.getByTestId("status-row").getByRole("button", { name: which === "start" ? "⇤ start" : "end ⇥" });
const key = (k: string) => async (page: Page) => {
  await blur(page);
  await page.keyboard.press(k);
};
const fretButton = (page: Page) => page.locator('button[aria-label*=" string, fret 3,"]').first();

const CASES: Case[] = [
  { name: "a column tap (control)", pos: "mid", still: true, act: (p) => columns(p).nth(22).click() },
  { name: "fret tap (control: its write moves the cursor)", pos: "end", still: true, act: (p) => fretButton(p).click() },
  { name: "end jump, already at the end", pos: "end", act: (p) => jump(p, "end").click() },
  { name: "End key, already at the end", pos: "end", act: key("End") },
  { name: "ArrowRight, already at the end", pos: "end", act: key("ArrowRight") },
  { name: "start jump, already at the start", pos: "start", act: (p) => jump(p, "start").click() },
  { name: "×4 at the end", pos: "end", act: (p) => p.getByTitle("Four of these").click() },
  { name: "repeat + at the end", pos: "end", act: (p) => p.getByRole("button", { name: "Repeat one more time" }).click() },
  { name: "triplet at the end", pos: "end", act: (p) => triplet(p).click() },
  {
    name: "chord symbol set at the end",
    pos: "end",
    act: async (p) => {
      await p.getByRole("button", { name: "chord symbol" }).click();
      await p.getByRole("textbox", { name: "Chord" }).fill("Dsus4");
      await p.waitForTimeout(400);
      await p.getByRole("button", { name: "Set" }).click();
    },
  },
  {
    name: "chord symbol set mid-part",
    pos: "mid",
    act: async (p) => {
      await p.getByRole("button", { name: "chord symbol" }).click();
      await p.getByRole("textbox", { name: "Chord" }).fill("G7");
      await p.waitForTimeout(400);
      await p.getByRole("button", { name: "Set" }).click();
    },
  },
  { name: "×4 mid-part", pos: "mid", act: (p) => p.getByTitle("Four of these").click() },
];

const CONFIGS = [
  { project: "mobile", size: { width: 412, height: 915 }, bars: 16, label: "412x915 coarse" },
  { project: "desktop", size: { width: 1280, height: 800 }, bars: 40, label: "1280x800 fine, 40 bars" },
];

const look = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    const top = band.getBoundingClientRect().top;
    const cols = [...document.querySelectorAll<HTMLElement>('[data-testid="tab-column"]')];
    const first = cols.find((c) => c.getBoundingClientRect().bottom > top + 1)!;
    return {
      wrapped: !!band.querySelector(".tab-staff-wrapped"),
      overflows: band.scrollHeight > band.clientHeight + 1,
      scrollTop: Math.round(band.scrollTop),
      firstTop: Math.round(first.getBoundingClientRect().top),
      firstIndex: cols.indexOf(first),
      count: cols.length,
    };
  });

for (const config of CONFIGS) {
  test(`INV-004 a sync arrival after each trigger does not move the band (${config.label})`, async ({ page }, info) => {
    test.skip(info.project.name !== config.project, `runs on ${config.project}`);
    const { partUrl } = await longPart(page, { chord: true, bracket: true, bars: config.bars, size: config.size });
    const other = await page.context().newPage();
    await other.setViewportSize({ width: 412, height: 915 });
    await other.goto(partUrl);
    await expect(columns(other).first()).toBeVisible();
    await other.waitForTimeout(500);

    const moves: string[] = [];
    const held: string[] = [];
    for (const c of CASES) {
      await page.bringToFront();
      // Reset: a fresh open puts A at the end with nothing outstanding.
      await page.goto(partUrl);
      await expect(columns(page).first()).toBeVisible();
      await page.waitForTimeout(800);
      if (c.pos === "mid") await columns(page).nth(20).click();
      if (c.pos === "start") await jump(page, "start").click();
      await page.waitForTimeout(800);
      await c.act(page);
      // Long past any write, any render and the round-1 400ms window.
      await page.waitForTimeout(1500);
      await page.evaluate(() => {
        const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
        band.scrollTop = -(band.scrollHeight - band.clientHeight);
      });
      await page.waitForTimeout(400);
      const before = await look(page);
      expect(before.wrapped && before.overflows, `${c.name}: the part must overflow a wrapped band`).toBe(true);
      // The second context writes.
      await fretButton(other).click();
      await expect.poll(async () => (await look(page)).count, { timeout: 5000 }).toBe(before.count + 1);
      await page.waitForTimeout(800);
      const after = await look(page);
      const line = `${c.name}: scrollTop ${before.scrollTop} -> ${after.scrollTop}, first visible column #${before.firstIndex} top ${before.firstTop} -> ${after.firstTop}`;
      if (Math.abs(after.scrollTop - before.scrollTop) > 1 || Math.abs(after.firstTop - before.firstTop) > 1) moves.push(line);
      else held.push(line);
    }
    console.log(`[${config.label}] held:\n  ${held.join("\n  ")}\nmoved:\n  ${moves.join("\n  ")}`);
    expect(moves, moves.join("\n")).toEqual([]);
  });
}

/**
 * The same member through the real sync server: two signed-in contexts, the part built through the UI so every
 * column syncs, the second device appending at the end. Skipped without a database, as the implementation's own
 * sync test is.
 */
test("INV-004 a sync arrival through the server after a no-op End key does not move the band (412x915)", async ({ browser }, info) => {
  test.skip(info.project.name !== "mobile", "runs on mobile");
  test.skip(!process.env.STABLATURE_DATABASE_URL, "STABLATURE_DATABASE_URL is not set");
  const size = { width: 412, height: 915 };
  const id = Math.random().toString(36).slice(2, 10);
  const who = { email: `review-${id}@example.test`, password: "practice-space-5" };
  const a = await (await browser.newContext({ viewport: size, hasTouch: true, isMobile: true })).newPage();
  await a.goto("/sign-up");
  await a.getByLabel("Name").fill(`Review ${id}`);
  await a.getByLabel("Email").fill(who.email);
  await a.getByLabel("Password").fill(who.password);
  await a.getByRole("button", { name: "Create account" }).click();
  await expect(a).toHaveURL(/\/$/);
  const { partUrl } = await startCapturing(a, `Band ${id}`);
  await a.setViewportSize(size);
  const barline = a.getByTestId("toolbar-stable").getByRole("button", { name: "Barline" });
  for (let bar = 0; bar < 24; bar++) {
    for (let i = 0; i < 3; i++) await space(a);
    await barline.click();
  }
  const total = 24 * 4;
  await expect(columns(a)).toHaveCount(total);
  await expect(a.getByText(/unsynced/)).toHaveCount(0, { timeout: 30_000 });

  const b = await (await browser.newContext({ viewport: size })).newPage();
  await b.goto("/sign-in");
  await b.getByLabel("Email").fill(who.email);
  await b.getByLabel("Password").fill(who.password);
  await b.getByRole("button", { name: "Sign in" }).click();
  await expect(b).toHaveURL(/\/$/);
  await b.goto(partUrl);
  await expect(columns(b)).toHaveCount(total, { timeout: 30_000 });

  const moves: string[] = [];
  const held: string[] = [];
  let count = total;
  for (const [name, act] of [
    ["a column tap (control)", async () => { await columns(a).nth(30).click(); }],
    ["End key, already at the end", async () => {
      await jump(a, "end").click();
      await a.waitForTimeout(800);
      await blur(a);
      await a.keyboard.press("End");
    }],
  ] as const) {
    await a.bringToFront();
    await act();
    await a.waitForTimeout(1500);
    await a.evaluate(() => {
      const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
      band.scrollTop = -(band.scrollHeight - band.clientHeight);
    });
    await a.waitForTimeout(400);
    const before = await look(a);
    expect(before.wrapped && before.overflows, `${name}: the part must overflow a wrapped band`).toBe(true);
    await b.bringToFront();
    await fretButton(b).click();
    count += 1;
    await expect.poll(async () => (await look(a)).count, { timeout: 30_000 }).toBe(count);
    await a.waitForTimeout(800);
    const after = await look(a);
    const line = `${name}: scrollTop ${before.scrollTop} -> ${after.scrollTop}, first visible column #${before.firstIndex} top ${before.firstTop} -> ${after.firstTop}`;
    if (Math.abs(after.scrollTop - before.scrollTop) > 1 || Math.abs(after.firstTop - before.firstTop) > 1) moves.push(line);
    else held.push(line);
  }
  console.log(`[through the server] held:\n  ${held.join("\n  ")}\nmoved:\n  ${moves.join("\n  ")}`);
  expect(moves, moves.join("\n")).toEqual([]);
});
