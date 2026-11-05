/**
 * INV-031 over its whole product, and INV-015's sync batch on the play view in a labelling view.
 *
 * INV-031 names five writes and three routes. Earlier probes ran a column added and deleted from another tab, a
 * chord by a raw write, the parent deleted from this tab, and one column by a pull on the song page. This runs what
 * was left: every write by a real pull from a second device on both surfaces, and a chord and the parent's deletion
 * from a real second tab. INV-015 holds over **Load** x {song page, play view} x **N**, and the sync batch had only
 * been seen on the song page in frets.
 */
import { appendFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { deleteButton, fret, startCapturing } from "../../../e2e/capture-surface-helpers";
import { choose, idb, n, seedSong } from "./helpers";

const outbox = (page: Page) => idb<number>(page, `return (await all("outbox")).length;`);
const liveParts = (page: Page) =>
  idb<string[]>(page, `return (await all("parts")).filter((p) => !p.deletedAt).map((p) => p.id);`);
const cursor = (page: Page) =>
  idb<unknown>(page, `return (await all("meta")).find((m) => m.key === "syncCursor")?.value ?? null;`);
const onServer = (page: Page) =>
  page.evaluate(async () => {
    const response = await fetch("/api/sync/pull?since=0&limit=1000");
    const body = (await response.json()) as {
      rows: { parts?: { id: string; deletedAt: unknown; serverSeq?: number | string }[] };
    };
    return (body.rows.parts ?? []).filter((p) => !p.deletedAt).map((p) => ({ id: p.id, seq: Number(p.serverSeq) }));
  });
const line = (page: Page) => page.getByTestId("variant-line");
const WAIT = { timeout: 30_000 };

const signUp = async (browser: Browser, id: string) => {
  const page = await browser.newPage();
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill(`Probe ${id}`);
  await page.getByLabel("Email").fill(`probe-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
};
const signIn = async (browser: Browser, id: string) => {
  const page = await browser.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(`probe-${id}@example.test`);
  await page.getByLabel("Password").fill("practice-space-5");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/$/);
  return page;
};

/** A and its variant, the variant on the last pass, drained, and open on a second device. */
async function twoDevices(browser: Browser) {
  const id = randomUUID().slice(0, 8);
  const first = await signUp(browser, id);
  const { songUrl } = await startCapturing(first, `Probe band ${id}`);
  await fret(first, "E", 7).click();
  await fret(first, "A", 5).click();
  await expect(first.getByTestId("tab-column")).toHaveCount(2);
  await first.goto(songUrl);
  await first.getByRole("button", { name: "+ variant" }).first().click();
  await expect(line(first)).toHaveText("Same as A");
  await first.getByRole("button", { name: "Each part once" }).click();
  await expect(first.getByTestId("roadmap-chip")).toHaveCount(1);
  // A variant plays through the entry of its parent, so the play view draws it as the last pass.
  await first.getByTestId("roadmap-chip").first().click();
  await first.getByLabel("Last pass").selectOption({ label: "A'" });
  await expect.poll(() => outbox(first), WAIT).toBe(0);
  const second = await signIn(browser, id);
  await second.goto(songUrl);
  await expect(line(second)).toHaveText("Same as A", WAIT);
  return { first, second, songUrl, playUrl: `${songUrl}/play` };
}

/** Open the Nth part's capture screen from the song page, and come back when `work` is done. */
const inCapture = async (page: Page, songUrl: string, index: number, work: () => Promise<unknown>) => {
  await page.getByRole("link", { name: "Edit" }).nth(index).click();
  await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
  await expect(page.getByTestId("tab-column").first()).toBeVisible();
  await work();
  await page.goto(songUrl);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible(WAIT);
};
const addColumn = async (page: Page, count: number) => {
  await fret(page, "E", 3).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(count);
};
const dropColumn = async (page: Page, count: number) => {
  await deleteButton(page).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(count);
};
const setChord = async (page: Page, value: string) => {
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByLabel("Chord").fill(value);
  await page.getByRole("button", { name: "Set" }).click();
  await expect(page.getByTestId("tab-staff").getByText(value)).toBeVisible();
};

for (const surface of ["song page", "play view"] as const) {
  test(`INV-031 every write by a pull: ${surface}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const { first, second, songUrl, playUrl } = await twoDevices(browser);
    if (surface === "play view") await first.goto(playUrl);
    await expect(line(first)).toHaveText("Same as A", WAIT);

    // Edit the variant, then delete that column.
    await inCapture(second, songUrl, 1, () => addColumn(second, 3));
    await expect(line(first)).toHaveText("Differs from A in bar 1: 1 added", WAIT);
    await inCapture(second, songUrl, 1, () => dropColumn(second, 2));
    await expect(line(first)).toHaveText("Same as A", WAIT);

    // Edit the parent, then delete that column.
    await inCapture(second, songUrl, 0, () => addColumn(second, 3));
    await expect(line(first)).toHaveText("Differs from A in bar 1: 1 removed", WAIT);
    await inCapture(second, songUrl, 0, () => dropColumn(second, 2));
    await expect(line(first)).toHaveText("Same as A", WAIT);

    // A chord on the variant, then the same chord on the parent.
    await inCapture(second, songUrl, 1, () => setChord(second, "Am"));
    await expect(line(first)).toHaveText("Differs from A in bar 1: 1 changed", WAIT);
    await inCapture(second, songUrl, 0, () => setChord(second, "Am"));
    await expect(line(first)).toHaveText("Same as A", WAIT);

    // Delete the parent: the comparison goes away, and the variant stays.
    await second.getByRole("button", { name: "Delete part A", exact: true }).click();
    await expect(line(first)).toHaveCount(0, WAIT);
    await expect(first.locator("[data-diff]")).toHaveCount(0);
    await expect(first.getByTestId("tab-removal")).toHaveCount(0);
  });

  test(`INV-031 a chord and the parent's deletion from a real second tab: ${surface}`, async ({ page, context }) => {
    const { songUrl, playUrl, parts, songId } = await seedSong(
      page,
      [
        { key: "a", label: "A", columns: [n(5), n(7)] },
        { key: "v", label: "A'", variantOf: "a", columns: [n(5), n(7)] },
      ],
      [{ part: "a" }, { part: "v" }],
    );
    if (surface === "play view") await page.goto(playUrl);
    await expect(line(page)).toHaveText("Same as A");
    const other = await context.newPage();
    await other.goto(`/songs/${songId}/capture/${parts.v}`);
    await expect(other.getByTestId("tab-column")).toHaveCount(2);
    await setChord(other, "Am");
    await expect(line(page)).toHaveText("Differs from A in bar 1: 1 changed");
    await other.goto(`/songs/${songId}/capture/${parts.a}`);
    await expect(other.getByTestId("tab-column")).toHaveCount(2);
    await setChord(other, "Am");
    await expect(line(page)).toHaveText("Same as A");
    await other.goto(songUrl);
    await other.getByRole("button", { name: "Delete part A", exact: true }).click();
    await expect(line(page)).toHaveCount(0);
    await other.close();
  });
}

/** Every line and mark a device ever shows, from now on. */
const record = (page: Page) =>
  page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __seen: string[] }).__seen = seen;
    const read = () => {
      for (const el of document.querySelectorAll('[data-testid="variant-line"], [data-testid="tab-removal"], [data-diff]')) {
        seen.push(el.getAttribute("data-testid") === "variant-line" ? (el.textContent ?? "") : `mark: ${el.textContent}`);
      }
    };
    new MutationObserver(read).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
const recorded = (page: Page) => page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);

for (const surface of ["song page", "play view"] as const) {
  for (const view of ["notes", "intervals"] as const) {
    test(`INV-015 a variant arriving by a pull, on the last pass: ${surface}, ${view}`, async ({ browser }) => {
      test.setTimeout(180_000);
      const id = randomUUID().slice(0, 8);
      const first = await signUp(browser, id);
      const { songUrl } = await startCapturing(first, `Probe band ${id}`);
      await fret(first, "E", 7).click();
      await setChord(first, "Am");
      await fret(first, "A", 5).click();
      await expect(first.getByTestId("tab-column")).toHaveCount(2);
      await first.goto(songUrl);
      await first.getByRole("button", { name: "Each part once" }).click();
      await expect(first.getByTestId("roadmap-chip")).toHaveCount(1);
      await expect.poll(() => outbox(first), WAIT).toBe(0);
      if (surface === "play view") await first.goto(`${songUrl}/play`);
      await expect(first.getByTestId("tab-column").first()).toBeVisible(WAIT);
      await choose(first, view);
      await record(first);

      const second = await signIn(browser, id);
      await second.goto(songUrl);
      await expect(second.getByTestId("tab-column").first()).toBeVisible(WAIT);
      await second.getByRole("button", { name: "+ variant" }).first().click();
      await expect(line(second)).toHaveText("Same as A");
      // Inside the one-second debounce, so the variant and the entry that plays it go in one push.
      await second.getByTestId("roadmap-chip").first().click();
      await second.getByLabel("Last pass").selectOption({ label: "A'" });
      await expect.poll(() => outbox(second), WAIT).toBe(0);

      const arrived = await expect(line(first)).toHaveText("Same as A", WAIT).then(() => true, () => false);
      if (!arrived) {
        // Under load the server can hand out a cursor past a row (OOS-F23-a-pull-under-load.spec.ts). That is the only
        // excuse: the row must be missing from this device, below its cursor. Held here and not drawn is a page bug.
        const held = await liveParts(first);
        const lost = (await onServer(first)).filter((p) => !held.includes(p.id));
        expect(lost, "the variant is on this device and the page did not draw it").not.toEqual([]);
        expect(Number(await cursor(first))).toBeGreaterThan(Math.min(...lost.map((p) => p.seq)));
        if (process.env.F23_LOG) appendFileSync(process.env.F23_LOG, `${JSON.stringify({ kind: "lost", surface, view, lost })}
`);
      } else if (process.env.F23_LOG) appendFileSync(process.env.F23_LOG, `${JSON.stringify({ kind: "fine" })}
`);
      expect([...new Set(await recorded(first))].filter((t) => t !== "Same as A")).toEqual([]);
    });
  }
}
