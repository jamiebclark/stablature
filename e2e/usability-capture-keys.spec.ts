/**
 * INV-040 and contracts/staff.md section 6: a key does what the matching tap does, and a cursor moved by key is
 * kept in view. Run the key on one song and the tap on another, then compare stored columns.
 */
import { expect, test, type Page } from "@playwright/test";
import { fret, stackLatch } from "./capture-surface-helpers";
import { n, seedSong } from "./reading-helpers";
import { cols, eventRows, seed, type Col } from "./rhythm-probe-helpers";

test.setTimeout(150_000);
test.skip(({ isMobile }) => isMobile, "a keyboard probe: the desktop project is the mouse-and-keyboard device");

type Row = {
  partId: string;
  rank: string;
  kind: string;
  frets: Record<string, unknown>;
  techniques: unknown;
  repeat: number;
  durationHint: unknown;
  deletedAt: unknown;
};

const columnsOf = async (page: Page, partId: string) =>
  ((await eventRows(page)) as unknown as Row[])
    .filter((r) => r.partId === partId && !r.deletedAt)
    .sort((a, b) => (a.rank < b.rank ? -1 : 1))
    .map(({ kind, frets, techniques, repeat, durationHint }) => ({ kind, frets, techniques, repeat, durationHint }));

const NOTES: Col[] = [{ d: "q" }, { d: "q" }, { kind: "barline" }, { d: "q" }, { d: "q" }];

async function open(page: Page) {
  const { partUrl, partId } = await seed(page, NOTES, { bpm: 120 });
  await page.goto(partUrl);
  await expect(page.getByTestId("tab-column")).toHaveCount(5);
  return partId;
}

const latch = (page: Page, name: string) => page.getByTestId("latch-strip").getByRole("button", { name });

type Armed = { name: string; arm: (page: Page) => Promise<void> };
type Cursor = { name: string; go: (page: Page) => Promise<void> };

/** The armed states with distinct handling: nothing, the stack latch, a transition latch, and both at once. */
const NOTHING: Armed = { name: "none", arm: async () => {} };
const STACK: Armed = { name: "stack", arm: async (p) => void (await stackLatch(p).click()) };
const HAMMER_ON: Armed = { name: "hammer-on", arm: async (p) => void (await latch(p, "hammer-on").click()) };
const BOTH: Armed = {
  name: "stack and a transition",
  arm: async (p) => {
    await stackLatch(p).click();
    await latch(p, "hammer-on").click();
  },
};

const AT_END: Cursor = { name: "at the end", go: async () => {} };
const ON_FIRST: Cursor = { name: "on the first column", go: async (p) => void (await p.getByTestId("tab-column").first().click()) };
const ON_LAST: Cursor = { name: "on the last column", go: async (p) => void (await p.getByTestId("tab-column").last().click()) };

const TYPED_SEVENS: { armed: Armed; cursor: Cursor }[] = [
  // The typical entry: nothing armed, adding at the end.
  { armed: NOTHING, cursor: AT_END },
  // The stack latch, inserting before the first column.
  { armed: STACK, cursor: ON_FIRST },
  // A transition alone, on the last column.
  { armed: HAMMER_ON, cursor: ON_LAST },
  // The worst case: stack and a transition together, inserting before the first column.
  { armed: BOTH, cursor: ON_FIRST },
];

for (const { armed, cursor } of TYPED_SEVENS) {
  test(`INV-040 a typed 7 equals a tapped 7: ${armed.name}, ${cursor.name}`, async ({ page }) => {
    const tapped = await open(page);
    await cursor.go(page);
    await armed.arm(page);
    await fret(page, "B", 7).click();
    await page.waitForTimeout(350);
    const want = await columnsOf(page, tapped);

    const typed = await open(page);
    await cursor.go(page);
    await armed.arm(page);
    await page.keyboard.press("7");
    await page.waitForTimeout(350);
    expect(await columnsOf(page, typed)).toEqual(want);
  });
}

test("INV-040 keys stop at both ends of the parts and of the strings", async ({ page }) => {
  await open(page);
  const url = page.url();
  await page.keyboard.press(",");
  await page.keyboard.press(".");
  expect(page.url(), "one part: neither key leaves it").toBe(url);
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-keyboard-string]")).toContainText("B");
  for (let i = 0; i < 9; i++) await page.keyboard.press("ArrowUp");
  await expect(page.locator("[data-keyboard-string]")).toContainText("G");
});

test("INV-040 Left and Right extend a selection exactly as a tap does", async ({ page }) => {
  await open(page);
  await page.getByTestId("tab-column").first().click();
  await page.getByRole("button", { name: /^select$/ }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-testid="tab-column"][data-selected="true"]')).toHaveCount(2);
});

const LONG = cols(...Array.from({ length: 160 }, (_, i) => (i % 5 === 4 ? "|" : "q")));

for (const [name, keys] of [
  // One jump across the whole part.
  ["Home", ["Home"]],
  // A column at a time, so the caret crosses the scroller's edge step by step.
  ["Left, walked down the part", Array.from({ length: 60 }, () => "ArrowLeft")],
] as const) {
  test(`staff.md section 6: a cursor moved by ${name} stays in view`, async ({ page }) => {
    const { partUrl } = await seed(page, LONG, { bpm: 120 });
    await page.setViewportSize({ width: 800, height: 700 });
    await page.goto(partUrl);
    await expect(page.getByTestId("tab-column").first()).toBeAttached();
    for (const key of keys) await page.keyboard.press(key);
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const mark = document.querySelector('[data-testid="tab-caret"]');
      const scroller = document.querySelector('[data-testid="tab-staff"] [role="group"]')!;
      if (!mark) return null;
      const a = mark.getBoundingClientRect();
      const b = scroller.getBoundingClientRect();
      return { caret: Math.round(a.left), left: Math.round(b.left), right: Math.round(b.right), scrollLeft: Math.round(scroller.scrollLeft) };
    });
    expect(m, "a caret is drawn").not.toBeNull();
    expect(m!.caret >= m!.left - 1 && m!.caret <= m!.right + 1, JSON.stringify(m)).toBe(true);
  });
}

const KEY_JUMPS = [
  // End, typical: nothing armed.
  { key: "End", button: /^end/, from: "second column", at: 1, armed: NOTHING },
  // End from the last column, a jump that goes nowhere, with the stack latch held over it.
  { key: "End", button: /^end/, from: "last column", at: 4, armed: STACK },
  // Home, the other jump, with stack and a transition: the worst case.
  { key: "Home", button: /start$/, from: "second column", at: 1, armed: BOTH },
] as const;

for (const { armed, ...jump } of KEY_JUMPS) {
  test(`INV-040 ${jump.key} equals its jump button: ${armed.name} armed, from the ${jump.from}`, async ({ page }) => {
    const byButton = await open(page);
    await page.getByTestId("tab-column").nth(jump.at).click();
    await armed.arm(page);
    await page.getByRole("button", { name: jump.button }).click();
    await page.waitForTimeout(120);
    await fret(page, "B", 7).click();
    await page.waitForTimeout(350);
    const want = await columnsOf(page, byButton);

    const byKey = await open(page);
    await page.getByTestId("tab-column").nth(jump.at).click();
    await armed.arm(page);
    await page.keyboard.press(jump.key);
    await page.waitForTimeout(120);
    await fret(page, "B", 7).click();
    await page.waitForTimeout(350);
    expect(await columnsOf(page, byKey)).toEqual(want);
  });
}

/** INV-040, INV-041, round 3: every key against its tap, under the armed states that differ; then the jump keys in fast typing. */
type StoredRow = { partId: string; rank: string; kind: string; frets: unknown; techniques: unknown; deletedAt: unknown };

/** Each run seeds its own song in the same browser, so a read names the parts it means. */
const storedOf = async (page: Page, partIds: readonly string[]) =>
  ((await eventRows(page)) as unknown as StoredRow[])
    .filter((r) => partIds.includes(r.partId) && !r.deletedAt)
    .sort((a, b) => (a.partId === b.partId ? (a.rank < b.rank ? -1 : 1) : partIds.indexOf(a.partId) - partIds.indexOf(b.partId)))
    .map(({ kind, frets, techniques }) => ({ kind, frets, techniques }));

const tapColumns = (page: Page) => page.getByTestId("tab-column");

async function openKeys(page: Page) {
  const { partUrl, partId } = await seed(page, NOTES, { bpm: 120 });
  await page.goto(partUrl);
  await expect(tapColumns(page)).toHaveCount(5);
  return [partId];
}

/** From column index `from`, each key against the tap on the column the table says it reaches. */
const KEY_MOVES = [
  // Left, typical: nothing armed.
  { key: "ArrowLeft", from: 3, to: 2, armed: NOTHING },
  // Right, the other direction, with stack and a transition held over the move: the worst case.
  { key: "ArrowRight", from: 0, to: 1, armed: BOTH },
] as const;

for (const { armed, ...move } of KEY_MOVES) {
  test(`INV-040 ${move.key} equals a tap on that column: ${armed.name} armed`, async ({ page }) => {
    const byTap = await openKeys(page);
    await tapColumns(page).nth(move.from).click();
    await armed.arm(page);
    await tapColumns(page).nth(move.to).click();
    await page.waitForTimeout(120);
    await fret(page, "B", 7).click();
    await page.waitForTimeout(350);
    const want = await storedOf(page, byTap);

    const byKey = await openKeys(page);
    await tapColumns(page).nth(move.from).click();
    await armed.arm(page);
    await page.keyboard.press(move.key);
    await page.waitForTimeout(120);
    await fret(page, "B", 7).click();
    await page.waitForTimeout(350);
    expect(await storedOf(page, byKey)).toEqual(want);
  });
}

// Nothing armed is the typical dead note; stack and a transition is the one most likely to differ from the cell.
for (const armed of [NOTHING, BOTH]) {
  test(`INV-040 x equals the neck's dead-note cell: ${armed.name} armed`, async ({ page }) => {
    const byTap = await openKeys(page);
    await tapColumns(page).nth(1).click();
    await armed.arm(page);
    await page.getByRole("button", { name: /dead note/i }).last().click();
    await page.waitForTimeout(350);
    const want = await storedOf(page, byTap);

    const byKey = await openKeys(page);
    await tapColumns(page).nth(1).click();
    await armed.arm(page);
    await page.keyboard.press("x");
    await page.waitForTimeout(350);
    expect(await storedOf(page, byKey)).toEqual(want);
  });
}

const PART_KEYS = [
  // Part on, typical: nothing armed.
  { key: ".", chip: "B", armed: NOTHING },
  // Part back, with stack and a transition armed across the change of part.
  { key: ",", chip: "A", armed: BOTH },
] as const;

for (const { key, chip, armed } of PART_KEYS) {
  test(`INV-040 ${key} equals the ${chip} chip: ${armed.name} armed`, async ({ page }) => {
    const go = async () => {
      const { songUrl, parts } = await seedSong(
        page,
        [
          { key: "a", label: "A", columns: [n(3, { d: "q" }), n(5, { d: "q" })] },
          { key: "b", label: "B", columns: [n(7, { d: "q" }), n(8, { d: "q" })] },
        ],
        [{ part: "a" }],
      );
      await page.goto(`${songUrl}/capture/${chip === "B" ? parts.a : parts.b}`);
      await expect(tapColumns(page)).toHaveCount(2);
      await tapColumns(page).first().click();
      await armed.arm(page);
      return [parts.a, parts.b];
    };
    const after = async (ids: string[]) => {
      await page.waitForTimeout(250);
      await fret(page, "B", 7).click();
      await page.waitForTimeout(350);
      return storedOf(page, ids);
    };
    const byTap = await go();
    await page.getByTestId("capture-title-row").getByRole("link", { name: chip, exact: true }).click();
    const want = await after(byTap);
    const byKey = await go();
    await page.keyboard.press(key);
    expect(await after(byKey)).toEqual(want);
  });
}

const fretsOf = async (page: Page, partIds: readonly string[]) =>
  (await storedOf(page, partIds)).map((r) => (r.kind === "barline" ? "|" : Object.values((r.frets ?? {}) as Record<string, unknown>).join("+") || "r"));

// 0ms is the fastest typing there is, 150ms a quick human.
for (const delay of [0, 150]) {
  test(`INV-041 the jump keys keep their place in fast typing at ${delay}ms`, async ({ page }) => {
    const ids = await openKeys(page);
    const before = await fretsOf(page, ids);
    for (const key of ["5", "Home", "7", "End", "3", "Home", "4", "9", "End", "8"]) await page.keyboard.press(key, { delay });
    await page.waitForTimeout(1800);
    const got = await fretsOf(page, ids);
    console.log(`INV-041 at ${delay}: ${JSON.stringify(got)}`);
    // Home goes before the first column, and notes follow one another from there, so 4 and 9 land ahead of the 7.
    expect(got).toEqual(["4", "9", "7", ...before, "5", "3", "8"]);
  });

  test(`INV-041 a digit waiting when a jump key lands enters where it was typed at ${delay}ms`, async ({ page }) => {
    const ids = await openKeys(page);
    const before = await fretsOf(page, ids);
    await page.keyboard.press("1", { delay });
    await page.keyboard.press("Home", { delay });
    await page.keyboard.press("6", { delay });
    await page.waitForTimeout(1200);
    const got = await fretsOf(page, ids);
    console.log(`INV-041 digit at ${delay}: ${JSON.stringify(got)}`);
    expect(got).toEqual(["6", ...before, "1"]);
  });
}

/** INV-040, round 3: the help's rows drive the test, and each runs its key. */
const HELP_PART = cols("q", "q", "q", "q", "|", "q", "q", "q", "q");
const caretX = async (page: Page) => (await page.getByTestId("tab-caret").boundingBox())!.x;

async function helpRows(page: Page) {
  await page.keyboard.press("Shift+?");
  const rows = page.getByTestId("help-row");
  await expect(rows.first()).toBeAttached();
  const ids = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-action")!));
  await page.keyboard.press("Shift+?");
  await expect(page.getByTestId("help-overlay")).toBeHidden();
  return ids;
}

const moved = async (page: Page, key: string) => {
  const before = await caretX(page);
  await page.keyboard.press(key);
  await expect.poll(() => caretX(page), { message: `${key} moves the caret` }).not.toBe(before);
};

const reading = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector(".tab-column-reading");
    return el ? [...document.querySelectorAll('[data-testid="tab-column"]')].indexOf(el) : -1;
  });

const readingMoves = async (page: Page, key: string) => {
  const before = await reading(page);
  await page.keyboard.press(key);
  await expect.poll(() => reading(page), { message: `${key} moves the reading position` }).not.toBe(before);
};

test("INV-040 capture: every help row runs", async ({ page }) => {
  const { songUrl, parts } = await seedSong(
    page,
    [
      { key: "a", label: "A", columns: [n(3, { d: "q" }), n(5, { d: "q" }), { kind: "barline" }, n(7, { d: "q" }), n(8, { d: "q" })] },
      { key: "b", label: "B", columns: [n(3, { d: "q" })] },
      { key: "c", label: "C", columns: [n(5, { d: "q" })] },
    ],
    [{ part: "a" }],
  );
  await page.goto(`${songUrl}/capture/${parts.b}`);
  await expect(tapColumns(page)).toHaveCount(1);
  const ids = await helpRows(page);
  const urlChanges = async (key: string) => {
    const before = page.url();
    await page.keyboard.press(key);
    await expect(page, `${key} changes part`).not.toHaveURL(before);
  };
  const keyed = () => page.locator("[data-keyboard-string]").textContent();
  const checks: Record<string, () => Promise<void>> = {
    "part-on": () => urlChanges("."),
    "part-back": () => urlChanges(","),
    "string-up": async () => {
      await page.keyboard.press("ArrowUp");
      await expect(page.locator("[data-keyboard-string]")).toHaveCount(1);
    },
    "string-down": async () => {
      const before = await keyed();
      await page.keyboard.press("ArrowDown");
      await expect.poll(keyed, { message: "Down moves the string" }).not.toBe(before);
    },
    "dead-note": async () => {
      const count = await tapColumns(page).count();
      await page.keyboard.press("x");
      await expect(tapColumns(page)).toHaveCount(count + 1);
    },
    enter: async () => {
      const count = await tapColumns(page).count();
      await page.keyboard.press("7");
      await expect(tapColumns(page)).toHaveCount(count + 1);
      await page.keyboard.press("1");
      await page.keyboard.press("Enter");
      await expect(tapColumns(page)).toHaveCount(count + 2);
    },
    "column-back": () => moved(page, "ArrowLeft"),
    "column-on": () => moved(page, "ArrowRight"),
    "bar-back": () => moved(page, "["),
    "bar-on": () => moved(page, "]"),
    start: async () => {
      await page.keyboard.press("Home");
      await expect(page.getByText("adding at the start")).toBeVisible();
    },
    end: async () => {
      await page.keyboard.press("End");
      await expect(page.getByText("adding at the end")).toBeVisible();
    },
    help: async () => {
      await page.keyboard.press("Shift+?");
      await expect(page.getByTestId("help-overlay")).toBeVisible();
      await page.keyboard.press("Shift+?");
      await expect(page.getByTestId("help-overlay")).toBeHidden();
    },
  };
  console.log(`capture rows: ${ids.join(" ")}`);
  expect(ids.length).toBe(13);
  // The part keys run first and on a part with a neighbour each side, then the rest on part A with its barline.
  for (const id of ["part-on", "part-back"]) await checks[id]();
  await page.goto(`${songUrl}/capture/${parts.a}`);
  await expect(tapColumns(page)).toHaveCount(5);
  const order = ["string-up", "string-down", "dead-note", "enter", "column-back", "column-on", "bar-back", "bar-on", "start", "end", "help"];
  expect([...order, "part-on", "part-back"].sort()).toEqual([...ids].sort());
  for (const id of order) await checks[id]();
});

test("INV-040 play: every help row runs", async ({ page }) => {
  const { playUrl } = await seed(page, HELP_PART, { bpm: 120 });
  await page.goto(playUrl);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.waitForTimeout(150);
  const ids = await helpRows(page);
  console.log(`play rows: ${ids.join(" ")}`);
  const checks: Record<string, () => Promise<void>> = {
    "column-on": () => readingMoves(page, "ArrowRight"),
    "column-back": async () => {
      await page.keyboard.press("ArrowRight");
      await readingMoves(page, "ArrowLeft");
    },
    "bar-on": () => readingMoves(page, "]"),
    "bar-back": () => readingMoves(page, "["),
    "toggle-click": async () => {
      await page.keyboard.press("Space");
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await page.locator("body").click({ position: { x: 2, y: 2 } });
      await page.keyboard.press("Space");
      await expect(page.getByTestId("click-start")).toBeVisible();
    },
    restart: async () => {
      await page.keyboard.press("r");
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await expect(page.getByTestId("click-state")).toHaveText("Counting in.");
      await page.getByTestId("click-stop").click();
    },
    help: async () => {
      await page.keyboard.press("Shift+?");
      await expect(page.getByTestId("help-overlay")).toBeVisible();
      await page.keyboard.press("Shift+?");
      await expect(page.getByTestId("help-overlay")).toBeHidden();
    },
  };
  const order = ["column-on", "column-back", "bar-on", "bar-back", "toggle-click", "restart", "help"];
  expect([...order].sort()).toEqual([...ids].sort());
  for (const id of order) await checks[id]();
});

test("INV-040 any other screen: the help lists only itself", async ({ page }) => {
  const { songUrl } = await seed(page, HELP_PART, { bpm: 120 });
  await page.goto(songUrl);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(150);
  expect(await helpRows(page)).toEqual(["help"]);
});
