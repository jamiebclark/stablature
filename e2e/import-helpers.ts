/** Drivers for the spec 004 paste-import probes. Builds on the suite's own helpers. */
import { expect, type Page } from "@playwright/test";

export * from "./probe-helpers";

/** Open the paste panel (if it is not open) and fill the text box with `text`. */
export async function pasteTab(page: Page, text: string): Promise<void> {
  const box = page.getByRole("textbox", { name: "Tab text" });
  if (!(await box.isVisible())) await page.getByRole("button", { name: "Paste tab" }).first().click();
  await box.fill(text);
}

/** A song with no parts, in the same band (so the same default tuning). */
export async function emptySong(page: Page, songUrl: string): Promise<string> {
  await page.goto(songUrl);
  await page.getByRole("link", { name: "Band" }).click();
  await page.getByLabel("Song title").fill("Empty");
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  return page.url();
}

/**
 * A staff as the person reads it: one line per string, tokens joined, top string first.
 * `preview` is the one inside the paste panel; `part` is the first one in the parts list.
 */
export async function readStaffText(page: Page, which: "preview" | "part" = "part"): Promise<string> {
  const scope = which === "preview" ? page.getByTestId("paste-tab") : page.getByRole("listitem");
  const rows = await scope
    .getByTestId("tab-staff")
    .first()
    .evaluate((staff) => {
      const out: string[][] = [];
      staff
        .querySelectorAll('[data-testid="tab-column"], [data-testid="tab-connector"]')
        .forEach((part) => {
          part.querySelectorAll(".tab-cell").forEach((cell, i) => {
            (out[i] ??= []).push((cell.textContent ?? "").trim());
          });
        });
      return out;
    });
  return rows.map((row) => row.join("")).join("\n");
}

const TABLES = [
  "bands",
  "tunings",
  "songs",
  "parts",
  "events",
  "annotations",
  "arrangementEntries",
  "outbox",
  "meta",
] as const;

/** Every Dexie table, `meta` included, read straight from IndexedDB. */
export async function dumpStore(page: Page): Promise<Record<string, unknown[]>> {
  return page.evaluate(async (tables) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open("stablature");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const out: Record<string, unknown[]> = {};
    for (const name of tables) {
      out[name] = await new Promise<unknown[]>((resolve, reject) => {
        const req = db.transaction(name).objectStore(name).getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    db.close();
    return out;
  }, TABLES);
}

/** App-written tab for `count` single notes on a Bass 4 in E standard, written by `toAscii` itself. */
export async function tabText(count: number, density: "expanded" | "compact" = "expanded") {
  const { toAscii } = await import("../src/lib/tab/ascii");
  const { presetById } = await import("../src/lib/tunings");
  const tuning = presetById("bass4-e")!;
  const events = Array.from({ length: count }, (_, i) => ({
    id: `e${i}`,
    bandId: "b",
    partId: "p",
    rank: `a${String(i).padStart(5, "0")}`,
    kind: "notes",
    frets: { [String(i % 4)]: (i % 9) + 1 },
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  }));
  return toAscii({ events: events as never, tuning, density });
}
