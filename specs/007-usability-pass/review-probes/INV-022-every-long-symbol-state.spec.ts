/**
 * INV-022 and FR-026, round 3. Round 2's probes took each fix's own shape: long symbols with nothing armed, and a waiting
 * digit with no chord. T162 and T163 share one row, so this crosses them: every symbol length, known and unknown, against
 * every armed state, every position, a waiting digit, and a refusal. surfaces.md's status table is the oracle: the words
 * and both jump buttons never give way, and a symbol gives way only past ten characters or during a refusal.
 * Filter: rects and the row's own text. No class is read.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { CHIPS, latch, stackLatch } from "../../../e2e/capture-surface-helpers";
import { n, seedSong } from "../../../e2e/reading-helpers";

test.setTimeout(280_000);
test.skip(({ isMobile }) => !isMobile, "the row is budgeted at 375 on touch");

const SYMBOLS = [
  { name: "10 known", symbol: "Cm7b5add11" },
  { name: "14 known", symbol: "Cmaj7add9add11" },
  { name: "10 unknown", symbol: "Xylophone1" },
  { name: "11 unknown", symbol: "Xylophone12" },
  { name: "19 unknown", symbol: "Xylophone Solo Part" },
  { name: "80 unknown", symbol: "Xylophone ".repeat(8) },
];

/** CANDIDATE=1: during a refusal an unknown symbol gives way as a known one does, whatever its length. */
const CANDIDATE = `
  [data-testid="status-row"] > span:nth-child(2) { flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }`;

const ARMED: { name: string; press: (page: Page) => Locator[] }[] = [
  { name: "none", press: () => [] },
  { name: "stack", press: (p) => [stackLatch(p)] },
  ...CHIPS.map((c) => ({ name: c.name, press: (p: Page) => [latch(p, c.name)] })),
  { name: "stack and a transition", press: (p: Page) => [stackLatch(p), latch(p, "slide down")] },
];

const POSITIONS: { name: string; go: (page: Page) => Promise<void> }[] = [
  { name: "at the end", go: async () => {} },
  { name: "at the start", go: async (p) => void (await p.getByRole("button", { name: /start$/ }).click()) },
  { name: "mid-part", go: async (p) => void (await p.getByTestId("tab-column").nth(1).click()) },
];

const read = (page: Page, symbol: string, refused: boolean) =>
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

for (const { name, symbol } of SYMBOLS) {
  test(`INV-022 a symbol of ${name}: every armed state, position and waiting digit keeps the row`, async ({ page }) => {
    const columns = [n(3, { d: "32", chord: symbol }), n(5, { d: "32" }), n(7, { d: "32" }), n(8, { d: "32" })];
    const { songId, parts } = await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
    await page.setViewportSize({ width: 375, height: 667 });
    const bad: string[] = [];
    let seen = 0;
    for (const position of POSITIONS) {
      for (const armed of ARMED) {
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
          const r = await read(page, symbol, false);
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
    if (process.env.CANDIDATE) await page.addStyleTag({ content: CANDIDATE });
    await page.waitForTimeout(40);
    const r = await read(page, symbol, true);
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
    const r = await read(page, symbol, true);
    seen.push(`${length}: ${r.problems.join("; ") || "ok"}`);
  }
  console.log(`INV-022 lengths ${seen.join(" | ")}`);
  expect(seen.length).toBe(9);
});
