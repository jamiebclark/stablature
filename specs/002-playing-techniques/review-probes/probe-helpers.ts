/** Shared drivers for the spec 002 review probes. Builds on the suite's own helpers. */
import { expect, type Locator, type Page } from "@playwright/test";
import { columns, fret, stackLatch } from "../../../e2e/capture-surface-helpers";

export * from "../../../e2e/capture-surface-helpers";

export const PHONE = { width: 375, height: 667 };
export const THEMES = ["light", "dark"] as const;
export const STACK = "stack notes onto the marked column";
export const CHIPS = [
  { name: "hammer-on", glyph: "h", id: "hammer_on" },
  { name: "pull-off", glyph: "p", id: "pull_off" },
  { name: "slide up", glyph: "/", id: "slide_up" },
  { name: "slide down", glyph: "\\", id: "slide_down" },
] as const;
export const LATCH_NAMES = [STACK, ...CHIPS.map((c) => c.name)];
export const DECORATIONS = [
  { words: "vibrato", id: "vibrato" },
  { words: "harmonic", id: "harmonic" },
  { words: "let ring", id: "let_ring" },
  { words: "bend", id: "bend" },
  { words: "tap", id: "tap" },
  { words: "palm mute", id: "palm_mute" },
] as const;

export const strip = (page: Page) => page.getByTestId("latch-strip");
export const latch = (page: Page, name: string) =>
  strip(page).getByRole("button", { name, exact: true });
export const details = (page: Page) => page.getByRole("button", { name: "Open column details" });
export const stable = (page: Page) => page.getByTestId("toolbar-stable");

export async function pressedStates(page: Page): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const name of LATCH_NAMES) {
    out[name] = (await latch(page, name).getAttribute("aria-pressed")) ?? "?";
  }
  return out;
}

export async function expectLit(page: Page, lit: readonly string[]) {
  await expect
    .poll(() => pressedStates(page))
    .toEqual(Object.fromEntries(LATCH_NAMES.map((n) => [n, lit.includes(n) ? "true" : "false"])));
}

export interface StoredRow {
  id: string;
  partId: string;
  rank: string;
  kind: string;
  frets: Record<string, number | string>;
  techniques: Record<string, string[]>;
  repeat: number;
  deletedAt: string | null;
}

/** The live rows of the open part, in rank order, straight from IndexedDB. */
export async function storedRows(page: Page): Promise<StoredRow[]> {
  const partId = page.url().split("/capture/")[1];
  const rows = await page.evaluate(
    () =>
      new Promise<StoredRow[]>((resolve, reject) => {
        const open = indexedDB.open("stablature");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const read = db.transaction("events").objectStore("events").getAll();
          read.onerror = () => reject(read.error);
          read.onsuccess = () => {
            db.close();
            resolve(read.result as StoredRow[]);
          };
        };
      }),
  );
  return rows
    .filter((r) => r.deletedAt === null && (!partId || r.partId === partId))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : a.id < b.id ? -1 : 1));
}

/** Overwrite one stored row. Dexie does not see this, so reload afterwards. */
export async function patchStored(page: Page, id: string, patch: Partial<StoredRow>) {
  await page.evaluate(
    ({ id, patch }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("stablature");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("events", "readwrite");
          const store = tx.objectStore("events");
          const get = store.get(id);
          get.onsuccess = () => store.put({ ...get.result, ...patch });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { id, patch },
  );
}

/** One string's exported row between the bar caps, from a downloaded song. */
export function exportRow(text: string, label: string, nth = 0): string {
  const rows = text.split("\n").filter((l) => new RegExp(`^${label}\\s*\\|`).test(l));
  const row = rows[nth];
  if (row === undefined) throw new Error(`no ${label} row ${nth} in:\n${text}`);
  return row.slice(row.indexOf("|") + 1, row.lastIndexOf("|"));
}

/** Press frets with nothing but a task boundary between: no wait for any write or render. */
export async function backToBack(page: Page, presses: readonly [string, number][]) {
  await page.evaluate(async (list) => {
    for (const [string, number] of list) {
      const prefix = `${string} string, fret ${number},`;
      const button = [...document.querySelectorAll("button")].find((b) =>
        (b.getAttribute("aria-label") ?? "").startsWith(prefix),
      );
      if (!button) throw new Error(`no fret ${prefix}`);
      button.click();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }, presses);
}

/** Add a column of `rows`, all on one fret, stacking every note after the first. */
export async function chordColumn(page: Page, rows: readonly string[], number = 5) {
  await fret(page, rows[0], number).click();
  if (rows.length === 1) return;
  await stackLatch(page).click();
  for (const row of rows.slice(1)) await fret(page, row, number).click();
  await expect
    .poll(async () => Object.keys((await storedRows(page)).at(-1)?.frets ?? {}).length)
    .toBe(rows.length);
  await stackLatch(page).click();
}

export async function addChord(page: Page, index: number, name: string) {
  await columns(page).nth(index).click();
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByRole("textbox", { name: "Chord" }).fill(name);
  await page.getByRole("button", { name: "Set" }).click();
  await expect(page.getByTestId("tab-staff").getByText(name, { exact: true })).toBeVisible();
}

/** Start a song on a tuning other than the seeded B Standard. */
export async function startWith(page: Page, family: string, preset: string, strings: number) {
  await page.goto("/");
  await page.getByLabel("Band name").fill("Hollow Crown");
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  const bandUrl = page.url();
  await page.goto(`${bandUrl}/tunings`);
  await page.getByRole("button", { name: family, exact: true }).click();
  await page.getByRole("button", { name: `Add ${preset}` }).first().click();
  await page.getByRole("button", { name: "Make default" }).first().click();
  const first = page.getByRole("listitem").first();
  await expect(first).toContainText(`${strings}-string`);
  await expect(first).toContainText(preset);
  await page.goto(bandUrl);
  await page.getByLabel("Song title").fill("Dirge");
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  const songUrl = page.url();
  await page.getByRole("link", { name: "Capture" }).click();
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
  return { songUrl, partUrl: page.url() };
}

/** Every string of the open tuning, played in one column, through the neck. */
export async function playEveryString(page: Page, strings: number) {
  const frets = page.getByRole("button", { name: /string, fret 5,/ });
  await expect(frets).toHaveCount(strings);
  await frets.nth(0).click();
  await stackLatch(page).click();
  for (let i = 1; i < strings; i += 1) await frets.nth(i).click();
  await expect
    .poll(async () => Object.keys((await storedRows(page)).at(-1)?.frets ?? {}).length)
    .toBe(strings);
  await stackLatch(page).click();
}

export async function box(loc: Locator) {
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}
