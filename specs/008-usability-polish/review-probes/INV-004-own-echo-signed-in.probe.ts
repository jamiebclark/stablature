/**
 * Review probe, spec 008 round 3, INV-004 member "a sync arrival", through a signed-in device's OWN echo.
 *
 * Round 2 listed this under "could not check": the pull returns rows this device pushed and re-`put`s every one
 * (`src/lib/sync/client.ts` `applyRemoteRows`), which re-emits the part's live queries with no write of the user's.
 * One signed-in context, a 24-bar part built through the UI so every column syncs. For each trigger at the end: run
 * it, let its own write deliver, swipe the band to the top line, then wait for this device's push (whose response
 * re-`put`s the server's merged rows, `pushOnce` → `applyRemoteRows(result.rows)`: that is the echo) and, when one
 * comes within 20s, a pull after it. The band must not move across the echo. Skipped without a database, as the
 * implementation's own sync test is. Round 3: 5 of 5 held, every one after its push, one also after a pull.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, space, startCapturing } from "../../../e2e/probe-helpers";
import { blur } from "./helpers";

test.setTimeout(600_000);

const look = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    return {
      wrapped: !!band.querySelector(".tab-staff-wrapped"),
      overflows: band.scrollHeight > band.clientHeight + 1,
      scroll: Math.round(band.scrollTop),
      tops: [...band.querySelectorAll(".tab-bar-run")].map((r) => Math.round(r.getBoundingClientRect().top)),
    };
  });

test("INV-004 this device's own sync echo after a trigger does not move the band (412x915, signed in)", async ({ browser }, info) => {
  test.skip(info.project.name !== "mobile", "runs on mobile");
  test.skip(!process.env.STABLATURE_DATABASE_URL, "STABLATURE_DATABASE_URL is not set");
  const size = { width: 412, height: 915 };
  const id = Math.random().toString(36).slice(2, 10);
  const page = await (await browser.newContext({ viewport: size, hasTouch: true, isMobile: true })).newPage();
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(`Review ${id}`);
  await page.getByLabel("Email").fill(`review-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  await startCapturing(page, `Band ${id}`);
  await page.setViewportSize(size);
  const barline = page.getByTestId("toolbar-stable").getByRole("button", { name: "Barline" });
  for (let bar = 0; bar < 24; bar++) {
    for (let i = 0; i < 3; i++) await space(page);
    await barline.click();
  }
  await expect(columns(page)).toHaveCount(96);
  await expect(page.getByText(/unsynced/)).toHaveCount(0, { timeout: 30_000 });
  await page.waitForTimeout(1500);

  let pushes = 0;
  let pulls = 0;
  page.on("response", (r) => {
    if (r.url().includes("/api/sync/push")) pushes++;
    if (r.url().includes("/api/sync/pull")) pulls++;
  });
  const jumpEnd = () => page.getByTestId("status-row").getByRole("button", { name: "end ⇥" }).click();

  const CASES: [string, () => Promise<void>][] = [
    ["fret tap at the end", () => page.locator('button[aria-label*=" string, fret 3,"]').first().click()],
    ["×4 at the end", () => page.getByTitle("Four of these").click()],
    ["repeat + at the end", () => page.getByRole("button", { name: "Repeat one more time" }).click()],
    [
      "chord symbol set at the end",
      async () => {
        await page.getByRole("button", { name: "chord symbol" }).click();
        await page.getByRole("textbox", { name: "Chord" }).fill("Dsus4");
        await page.waitForTimeout(300);
        await page.getByRole("button", { name: "Set" }).click();
      },
    ],
    ["space at the end", () => space(page)],
  ];

  const moved: string[] = [];
  const held: string[] = [];
  let echoes = 0;
  for (const [name, act] of CASES) {
    await jumpEnd();
    await page.waitForTimeout(800);
    await blur(page);
    const pushesBefore = pushes;
    await act();
    // Its own write delivers locally long before the round trip; then swipe away from the anchor.
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
      band.scrollTop = -(band.scrollHeight - band.clientHeight);
    });
    await page.waitForTimeout(200);
    const before = await look(page);
    expect(before.wrapped && before.overflows, `${name}: the part must overflow a wrapped band`).toBe(true);
    // This device's push, then a pull after it (the echo).
    await expect.poll(() => pushes, { timeout: 30_000 }).toBeGreaterThan(pushesBefore);
    const pullsAfterPush = pulls;
    const echoed = await expect
      .poll(() => pulls, { timeout: 20_000 })
      .toBeGreaterThan(pullsAfterPush)
      .then(() => true)
      .catch(() => false);
    if (echoed) echoes++;
    await page.waitForTimeout(1200);
    const after = await look(page);
    const line = `${name} (${echoed ? "pull seen" : "no pull seen"}): scrollTop ${before.scroll} -> ${after.scroll}, top run ${before.tops[0]} -> ${after.tops[0]}`;
    const same = Math.abs(before.scroll - after.scroll) <= 1 && before.tops.every((t, i) => Math.abs(t - after.tops[i]) <= 1);
    (same ? held : moved).push(line);
  }
  console.log(`[own echo] ${echoes} of ${CASES.length} saw a pull after the push\nheld:\n  ${held.join("\n  ")}\nmoved:\n  ${moved.join("\n  ")}`);
  expect(echoes, "the probe must see this device's pull after its push").toBeGreaterThan(0);
  expect(moved, moved.join("\n")).toEqual([]);
});
