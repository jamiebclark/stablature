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
  { name: "no chord", symbol: null },
  { name: "Am", symbol: "Am" },
  { name: "a 10-character chord", symbol: "Cm7b5add11" },
  { name: "an unknown chord", symbol: "Xylophone1" },
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

const LONG_SYMBOLS = [
  { name: "11 characters, unknown", symbol: "Xylophone12" },
  { name: "19 characters, unknown", symbol: "Xylophone Solo Part" },
  { name: "80 characters, INV-016's own symbol", symbol: "Cmaj7".repeat(16) },
  { name: "14 characters, known", symbol: "Cmaj7add9add11" },
];

const LONG_POSITIONS: { name: string; go: (page: Page) => Promise<void> }[] = [
  { name: "at the end", go: async () => {} },
  { name: "mid-part", go: async (p) => void (await p.getByTestId("tab-column").nth(1).click()) },
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

for (const { name, symbol } of LONG_SYMBOLS) {
  for (const position of LONG_POSITIONS) {
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
}

const ARMED_WORDS: { name: string; arm: (page: Page) => Promise<void>; stack: boolean }[] = [
  { name: "hammer-on", arm: async (p) => void (await latch(p, "hammer-on").click()), stack: false },
  { name: "pull-off", arm: async (p) => void (await latch(p, "pull-off").click()), stack: false },
  { name: "slide up", arm: async (p) => void (await latch(p, "slide up").click()), stack: false },
  { name: "slide down", arm: async (p) => void (await latch(p, "slide down").click()), stack: false },
  { name: "stack", arm: async (p) => void (await stackLatch(p).click()), stack: true },
];

for (const width of [375, 1280]) {
  for (const armed of ARMED_WORDS) {
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
}

/** INV-022, every long symbol: round 3's probe, crossing every symbol length with every armed state. */
const PROBE_SYMBOLS = [
  { name: "10 known", symbol: "Cm7b5add11" },
  { name: "14 known", symbol: "Cmaj7add9add11" },
  { name: "10 unknown", symbol: "Xylophone1" },
  { name: "11 unknown", symbol: "Xylophone12" },
  { name: "19 unknown", symbol: "Xylophone Solo Part" },
  { name: "80 unknown", symbol: "Xylophone ".repeat(8) },
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

for (const { name, symbol } of PROBE_SYMBOLS) {
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

test("INV-022 how short an unknown symbol cuts a button during a refusal", async ({ page }) => {
  const seen: string[] = [];
  for (let length = 4; length <= 12; length++) {
    const symbol = "Xylophone123".slice(0, length);
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
    seen.push(`${length}: ${r.problems.join("; ") || "ok"}`);
  }
  console.log(`INV-022 lengths ${seen.join(" | ")}`);
  expect(seen.length).toBe(9);
});
