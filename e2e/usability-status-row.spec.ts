/**
 * INV-022 over **Lat** x every status text x {no chord, Am, a 10-character chord, an unknown chord} x {end, start,
 * mid-part} at 375. usability-staff.spec.ts checks one state: no chord, no latch, at the end.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CHIPS, latch, stackLatch } from "./capture-surface-helpers";
import { n, seedSong } from "./reading-helpers";

test.setTimeout(240_000);
test.skip(({ isMobile }) => !isMobile, "the row is budgeted at 375 on touch");

const CHORDS: { name: string; symbol: string | null }[] = [
  // Typical: no chord, so the status words have the row.
  { name: "no chord", symbol: null },
  // The longest symbol the row must show whole. Unknown and longer symbols are in the probe below.
  { name: "a 10-character chord", symbol: "Cm7b5add11" },
];

/** Each state is the latches to press, in order. A latch disabled here is not a member of this position. */
const LATCHES: { name: string; press: (page: Page) => Locator[] }[] = [
  { name: "none", press: () => [] },
  { name: "stack", press: (p) => [stackLatch(p)] },
  ...CHIPS.map((c) => ({ name: c.name, press: (p: Page) => [latch(p, c.name)] })),
  { name: "stack and a transition", press: (p: Page) => [stackLatch(p), latch(p, "slide down")] },
  { name: "stack and two transitions", press: (p: Page) => [stackLatch(p), latch(p, "hammer-on"), latch(p, "slide down")] },
];

const POSITIONS: { name: string; go: (page: Page) => Promise<void> }[] = [
  { name: "at the end", go: async () => {} },
  { name: "at the start", go: async (p) => void (await p.getByRole("button", { name: /start$/ }).click()) },
  { name: "mid-part", go: async (p) => void (await p.getByTestId("tab-column").nth(1).click()) },
];

/** Reads the row. Every child must end inside it, and the status words and the symbol must be whole. */
const read = (page: Page, symbol: string | null) =>
  page.getByTestId("status-row").evaluate((row, sym) => {
    const box = row.getBoundingClientRect();
    const right = box.right - parseFloat(getComputedStyle(row).paddingRight);
    const kids = [...row.children] as HTMLElement[];
    const status = kids[0];
    const buttons = kids.filter((k) => k.tagName === "BUTTON");
    const problems: string[] = [];
    if (status.scrollWidth > status.clientWidth + 0.5) problems.push(`status cut: ${status.textContent}`);
    if (status.getBoundingClientRect().right > right + 0.5) problems.push(`status past the row: ${status.textContent}`);
    if (buttons.length !== 2) problems.push(`${buttons.length} jump buttons`);
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      if (r.right > right + 0.5) problems.push(`${b.textContent} clipped by ${(r.right - right).toFixed(1)}px`);
      if (r.width < 43.5 || r.height < 23.5) problems.push(`${b.textContent} ${r.width}x${r.height}`);
    }
    if (sym) {
      const walker = document.createTreeWalker(row, NodeFilter.SHOW_TEXT);
      for (let t = walker.nextNode(); t; t = walker.nextNode()) {
        const at = t.textContent?.indexOf(sym) ?? -1;
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(t, at);
        range.setEnd(t, at + sym.length);
        const holder = t.parentElement!;
        const shown = holder.getBoundingClientRect();
        if (range.getBoundingClientRect().right > Math.min(shown.right, right) + 0.5) problems.push(`symbol cut: ${sym}`);
      }
    }
    return { problems, status: status.textContent ?? "", h: box.height };
  }, symbol);

for (const chord of CHORDS) {
  test(`INV-022 ${chord.name}`, async ({ page }) => {
    const columns = [
      n(3, { d: "32", chord: chord.symbol ?? undefined }),
      n(5, { d: "32" }),
      n(7, { d: "32" }),
      n(8, { d: "32" }),
    ];
    const { songId, parts } = await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
    await page.setViewportSize({ width: 375, height: 667 });
    const bad: string[] = [];
    let seen = 0;
    for (const position of POSITIONS) {
      for (const armed of LATCHES) {
        await page.goto(`/songs/${songId}/capture/${parts.a}`);
        await expect(page.getByTestId("tab-column").first()).toBeVisible();
        await position.go(page);
        let reachable = true;
        for (const control of armed.press(page)) {
          if (!(await control.isEnabled({ timeout: 1500 }))) {
            reachable = false;
            break;
          }
          await control.click();
        }
        if (!reachable) continue;
        await page.waitForTimeout(60);
        const r = await read(page, chord.symbol);
        seen += 1;
        expect(r.h).toBeLessThanOrEqual(26.5);
        bad.push(...r.problems.map((p) => `${position.name}, ${armed.name} [${r.status}]: ${p}`));
      }
    }
    expect(seen).toBeGreaterThan(10);
    expect(bad).toEqual([]);
  });
}

test("INV-022 a refusal keeps its words and cuts only the chord (Deviation 3)", async ({ page }) => {
  const { songId, parts } = await seedSong(
    page,
    [{ key: "a", label: "A", columns: [n(3, { chord: "Cm7b5add11" }), n(5)] }],
    [{ part: "a" }],
  );
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/songs/${songId}/capture/${parts.a}`);
  await page.getByRole("button", { name: "Triplet", exact: true }).click();
  await expect(page.getByText("a triplet needs three columns in one bar")).toBeVisible();
  const r = await read(page, null);
  expect(r.problems).toEqual([]);
});

test("INV-022 the waiting digit fits beside the longest status and a 10-character chord", async ({ page }) => {
  const { songId, parts } = await seedSong(
    page,
    [{ key: "a", label: "A", columns: [n(3, { chord: "Cm7b5add11", d: "32" }), n(5, { d: "32" })] }],
    [{ part: "a" }],
  );
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/songs/${songId}/capture/${parts.a}`);
  await page.getByTestId("tab-column").nth(1).click();
  await stackLatch(page).click();
  await page.keyboard.press("1");
  await expect(page.getByTestId("digit-waiting")).toBeVisible();
  const r = await read(page, "Cm7b5add11");
  expect(r.problems).toEqual([]);
});

const AT_END = { name: "at the end", go: async () => {} };
const MID_PART = { name: "mid-part", go: async (p: Page) => void (await p.getByTestId("tab-column").nth(1).click()) };

const LONG_SYMBOLS = [
  // The worst case: INV-016's 80-character known symbol, mid-part where the status words are longest.
  { name: "80 characters, INV-016's own symbol", symbol: "Cmaj7".repeat(16), position: MID_PART },
  // One past the ten-character budget, unknown, at the end: the first symbol that must be cut.
  { name: "11 characters, unknown", symbol: "Xylophone12", position: AT_END },
];

const openLong = async (page: Page, chord?: string) => {
  const { songUrl, parts } = await seedSong(
    page,
    [{ key: "a", label: "A", columns: [n(3, { d: "q", chord }), n(5, { d: "q" }), n(7, { d: "q" })] }],
    [{ part: "a" }],
  );
  await page.goto(`${songUrl}/capture/${parts.a}`);
  await expect(page.getByTestId("tab-column").first()).toBeAttached();
};

const jumpButtonsOver = (page: Page) =>
  page.getByTestId("status-row").evaluate((row) => {
    const right = row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight);
    return [...row.querySelectorAll("button")].map((b) => ({
      text: b.textContent,
      over: Math.round((b.getBoundingClientRect().right - right) * 10) / 10,
    }));
  });

for (const { name, symbol, position } of LONG_SYMBOLS) {
  test(`INV-022 a symbol of ${name}, ${position.name}: both jump buttons stay on the row`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openLong(page, symbol);
    await position.go(page);
    await page.waitForTimeout(150);
    const buttons = await jumpButtonsOver(page);
    console.log(`row: ${symbol.slice(0, 20)} | ${(await page.getByTestId("status-row").innerText()).replace(/s+/g, " ").slice(0, 90)}`);
    expect(buttons, "two jump buttons").toHaveLength(2);
    for (const b of buttons) expect(b.over, `${b.text} past the row`).toBeLessThanOrEqual(0.5);
  });
}

const HAMMER_ON = { name: "hammer-on", arm: async (p: Page) => void (await latch(p, "hammer-on").click()), stack: false };
const SLIDE_DOWN = { name: "slide down", arm: async (p: Page) => void (await latch(p, "slide down").click()), stack: false };
const STACK = { name: "stack", arm: async (p: Page) => void (await stackLatch(p).click()), stack: true };

const ARMED_WORDS = [
  // A transition at 375, where the words must shorten: they must not claim a stack.
  { width: 375, armed: HAMMER_ON },
  // The stack at 375: the one armed state whose words do say stack.
  { width: 375, armed: STACK },
  // The longest transition name at 1280, where the words must not change at all.
  { width: 1280, armed: SLIDE_DOWN },
  // The stack at 1280: the stack words, unchanged, on a wide row.
  { width: 1280, armed: STACK },
];

for (const { width, armed } of ARMED_WORDS) {
  test(`INV-022 at ${width}: with ${armed.name} armed, the words beside a waiting digit are true`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await openLong(page);
    await page.getByTestId("tab-column").nth(1).click();
    await armed.arm(page);
    const row = page.getByTestId("status-row");
    const before = (await row.locator("span").first().textContent()) ?? "";
    await page.keyboard.press("1");
    await expect(page.getByTestId("digit-waiting")).toBeVisible();
    const during = (await row.locator("span").first().textContent()) ?? "";
    console.log(`${width} ${armed.name}: "${before}" -> "${during}"`);
    if (!armed.stack) expect(during, "nothing is stacking").not.toMatch(/stack/);
    if (width === 1280) expect(during, "a wide row has the room for the whole words").toBe(before);
  });
}

/** INV-022, every long symbol: round 3's probe, crossing every symbol length with every armed state. */
const PROBE_SYMBOLS = [
  // Exactly the ten-character budget, unknown: the longest symbol that must show whole.
  { name: "10 unknown", symbol: "Xylophone1", probe: true, refusal: false },
  // One past the budget: the first that must be cut, beside a refusal's words.
  { name: "11 unknown", symbol: "Xylophone12", probe: false, refusal: true },
  // The worst case: 80 characters with spaces, in every state and beside a refusal.
  { name: "80 unknown", symbol: "Xylophone ".repeat(8), probe: true, refusal: true },
];

const ARMED_STATES: { name: string; press: (page: Page) => Locator[] }[] = [
  { name: "none", press: () => [] },
  { name: "stack", press: (p) => [stackLatch(p)] },
  ...CHIPS.map((c) => ({ name: c.name, press: (p: Page) => [latch(p, c.name)] })),
  { name: "stack and a transition", press: (p: Page) => [stackLatch(p), latch(p, "slide down")] },
];

const readFit = (page: Page, symbol: string, refused: boolean) =>
  page.getByTestId("status-row").evaluate(
    (row, { sym, refusal }) => {
      const right = row.getBoundingClientRect().right - parseFloat(getComputedStyle(row).paddingRight);
      const kids = [...row.children] as HTMLElement[];
      const status = kids[0];
      const buttons = kids.filter((k) => k.tagName === "BUTTON");
      const holder = kids.find((k) => k.textContent === sym.trim() || k.textContent === sym);
      const problems: string[] = [];
      if (status.scrollWidth > status.clientWidth + 0.5) problems.push(`status cut: ${status.textContent}`);
      if (status.getBoundingClientRect().right > right + 0.5) problems.push(`status past the row: ${status.textContent}`);
      if (buttons.length !== 2) problems.push(`${buttons.length} jump buttons`);
      for (const b of buttons) {
        const r = b.getBoundingClientRect();
        if (r.right > right + 0.5) problems.push(`${b.textContent} clipped by ${(r.right - right).toFixed(1)}px`);
        if (r.width < 43.5 || r.height < 23.5) problems.push(`${b.textContent} ${r.width}x${r.height}`);
      }
      if (holder && !refusal) {
        const probe = document.createElement("span");
        probe.style.cssText = "position:absolute;visibility:hidden;font:inherit";
        probe.textContent = "0".repeat(Math.min(sym.length, 10));
        holder.appendChild(probe);
        const want = probe.getBoundingClientRect().width;
        probe.remove();
        const have = holder.getBoundingClientRect().width;
        if (have < want - 0.5) problems.push(`symbol under ten characters: ${have.toFixed(1)} of ${want.toFixed(1)}`);
      }
      return { problems, status: status.textContent ?? "", text: (row as HTMLElement).innerText.replace(/\s+/g, " ") };
    },
    { sym: symbol, refusal: refused },
  );

for (const { name, symbol } of PROBE_SYMBOLS.filter((s) => s.probe)) {
  test(`INV-022 a symbol of ${name}: every armed state, position and waiting digit keeps the row`, async ({ page }) => {
    const columns = [n(3, { d: "32", chord: symbol }), n(5, { d: "32" }), n(7, { d: "32" }), n(8, { d: "32" })];
    const { songId, parts } = await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
    await page.setViewportSize({ width: 375, height: 667 });
    const bad: string[] = [];
    let seen = 0;
    for (const position of POSITIONS) {
      for (const armed of ARMED_STATES) {
        for (const digit of [false, true]) {
          await page.goto(`/songs/${songId}/capture/${parts.a}`);
          await expect(page.getByTestId("tab-column").first()).toBeVisible();
          await position.go(page);
          let reachable = true;
          for (const control of armed.press(page)) {
            if (!(await control.isEnabled({ timeout: 1000 }))) {
              reachable = false;
              break;
            }
            await control.click();
          }
          if (!reachable) continue;
          if (digit) {
            await page.keyboard.press("1");
            await expect(page.getByTestId("digit-waiting")).toBeVisible();
          }
          await page.waitForTimeout(40);
          const r = await readFit(page, symbol, false);
          seen += 1;
          bad.push(...r.problems.map((p) => `${position.name}, ${armed.name}, digit ${digit} [${r.text.slice(0, 70)}]: ${p}`));
        }
      }
    }
    console.log(`INV-022 ${name}: ${seen} states, ${bad.length} bad`);
    expect(seen).toBeGreaterThan(20);
    expect(bad).toEqual([]);
  });
}

for (const { name, symbol } of PROBE_SYMBOLS.filter((s) => s.refusal)) {
  test(`INV-022 a refusal beside a symbol of ${name}: its words and both jump buttons stay`, async ({ page }) => {
    const { songId, parts } = await seedSong(
      page,
      [{ key: "a", label: "A", columns: [n(3, { chord: symbol }), n(5)] }],
      [{ part: "a" }],
    );
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`/songs/${songId}/capture/${parts.a}`);
    await page.getByRole("button", { name: "Triplet", exact: true }).click();
    await expect(page.getByText("a triplet needs three columns in one bar")).toBeVisible();
    await page.waitForTimeout(40);
    const r = await readFit(page, symbol, true);
    console.log(`INV-022 refusal ${name}: ${r.text.slice(0, 90)} | ${JSON.stringify(r.problems)}`);
    expect(r.problems).toEqual([]);
  });
}

/** INV-021 (US4): the facts are separate segments, found by test id, never by child index. */
const readSegments = (page: Page) =>
  page.getByTestId("status-row").evaluate((row) => {
    const q = (id: string) => row.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    const position = q("status-position");
    const symbol = q("status-symbol");
    const tones = q("status-tones");
    const problems: string[] = [];
    const box = row.getBoundingClientRect();
    if (box.height > 26.5) problems.push(`row ${box.height}px`);
    if (!position) problems.push("no status-position");
    else if (position.scrollWidth > position.clientWidth + 0.5) problems.push(`position cut: ${position.textContent}`);
    // Separators: each segment after the position opens with a 1px rule (the symbol and the first jump button
    // after a sibling rule; the duration and the waiting digit with one drawn inside them).
    const ruleBefore = (el: Element | null | undefined) => {
      const prev = el?.previousElementSibling as HTMLElement | null;
      return !!prev && prev.getAttribute("aria-hidden") === "true" && prev.getBoundingClientRect().width <= 1.5;
    };
    if (symbol && !ruleBefore(symbol)) problems.push("no rule before the symbol");
    const first = row.querySelector("button");
    if (first && !ruleBefore(first)) problems.push("no rule before the jumps");
    for (const id of ["cursor-duration", "digit-waiting"]) {
      const seg = q(id);
      if (seg && !seg.querySelector("[aria-hidden=true]")) problems.push(`no rule inside ${id}`);
    }
    if (symbol && tones) {
      const ws = (el: HTMLElement) => Number(getComputedStyle(el).fontWeight);
      if (ws(symbol) <= ws(tones)) problems.push("symbol is not heavier than the tones");
    }
    // FR-031: the tones give way before the duration. The duration is never cut while the tones still have width.
    const dur = q("cursor-duration");
    if (dur && tones && dur.scrollWidth > dur.clientWidth + 0.5 && tones.clientWidth > 2) {
      problems.push(`duration cut while tones show (tones ${tones.clientWidth}px, duration ${dur.clientWidth}/${dur.scrollWidth}px)`);
    }
    const hears = (row as HTMLElement).textContent ?? "";
    return { problems, hears, symbol: symbol?.textContent ?? null, position: position?.textContent ?? null };
  });

const LAT = [
  { name: "no latch", press: (_p: Page): Locator[] => [] },
  { name: "stack", press: (p: Page) => [stackLatch(p)] },
];
const DUR = [
  { name: "no duration", d: undefined as string | undefined },
  { name: "a duration", d: "q" },
  { name: "a whole note", d: "w" },
];

for (const lat of LAT) {
  for (const dur of DUR) {
    for (const digit of [false, true]) {
      for (const position of POSITIONS) {
        test(`INV-021 segments: ${lat.name}, ${dur.name}, digit ${digit}, ${position.name}`, async ({ page }) => {
          const columns = [n(3, { d: dur.d, chord: dur.d === "w" ? "Am" : "Dsus4" }), n(5, { d: dur.d }), n(7, { d: dur.d })];
          const { songId, parts } = await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
          await page.setViewportSize({ width: 375, height: 667 });
          await page.goto(`/songs/${songId}/capture/${parts.a}`);
          await expect(page.getByTestId("tab-column").first()).toBeVisible();
          await position.go(page);
          for (const c of lat.press(page)) {
            if (!(await c.isEnabled({ timeout: 1000 }))) test.skip(true, "latch not a member here");
            await c.click();
          }
          if (digit) {
            await page.keyboard.press("1");
            await expect(page.getByTestId("digit-waiting")).toBeVisible();
          }
          await page.waitForTimeout(60);
          const r = await readSegments(page);
          expect(r.problems).toEqual([]);
          if (r.symbol) expect(r.hears).toContain(`${r.symbol} chord:`);
        });
      }
    }
  }
}

test("INV-021 a symbol of ten characters is whole, with its separators, at 375", async ({ page }) => {
  const { songId, parts } = await seedSong(
    page,
    [{ key: "a", label: "A", columns: [n(3, { chord: "Cm7b5add11", d: "32" }), n(5, { d: "32" })] }],
    [{ part: "a" }],
  );
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/songs/${songId}/capture/${parts.a}`);
  const r = await readSegments(page);
  expect(r.problems).toEqual([]);
  expect(r.symbol).toBe("Cm7b5add11");
});

test("INV-022 status-position text equals today's literal", async ({ page }) => {
  const { songId, parts } = await seedSong(page, [{ key: "a", label: "A", columns: [n(3), n(5)] }], [{ part: "a" }]);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto(`/songs/${songId}/capture/${parts.a}`);
  await expect(page.getByTestId("status-position")).toHaveText("adding at the end");
  await page.getByRole("button", { name: /start$/ }).click();
  await expect(page.getByTestId("status-position")).toHaveText("adding at the start");
  await page.getByTestId("tab-column").nth(0).click();
  await expect(page.getByTestId("status-position")).toHaveText("adding after the marked column");
});
