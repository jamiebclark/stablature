/**
 * INV-004 / FR-018 / SC-009 (round 3): the plan's probe compares exported ASCII, but FR-018
 * says "down to the stored data". Twin columns, one edited through each surface, compared
 * row by row in IndexedDB: every field the export cannot see, which fields each write
 * stamped, and the annotation row. Delete's cursor is compared over every position,
 * through the rendered screen. Enumerated: the plan's 6 edits; delete x {first, middle,
 * last, end-tracking}; inspector delete of a column the cursor is not on x 3.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addPart,
  caret,
  columns,
  deleteButton,
  fret,
  inspector,
  mouseHold,
  openDialog,
  startCapturing,
  status,
} from "./helpers";

const partId = (page: Page) => page.url().split("/").pop()!;

/** Every stored row of a part, with identity and clock VALUES stripped; clock KEYS are kept. */
async function storedRows(page: Page, part: string) {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open("stablature");
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const all = (table: string) =>
      new Promise<Record<string, unknown>[]>((resolve) => {
        const req = db.transaction(table).objectStore(table).getAll();
        req.onsuccess = () => resolve(req.result);
      });
    const strip = (row: Record<string, unknown>) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row).sort()) {
        if (["id", "bandId", "partId", "anchorEventId", "rank", "serverSeq", "hlc", "updatedAt"].includes(key)) continue;
        if (key === "deletedAt") out.deleted = value !== null && value !== undefined;
        else if (/clock/i.test(key) && value && typeof value === "object") out.stamped = Object.keys(value).sort();
        else out[key] = value;
      }
      return out;
    };
    const events = (await all("events")).filter((r) => r.partId === id);
    const annotations = (await all("annotations")).filter((r) => r.partId === id);
    db.close();
    return { events: events.map(strip), annotations: annotations.map(strip) };
  }, part);
}

const more = (p: Page) => inspector(p).getByRole("button", { name: "repeat count: one more" });
const fewer = (p: Page) => inspector(p).getByRole("button", { name: "repeat count: one fewer" });
const toolbarChord = async (p: Page, value: string) => {
  await p.getByRole("button", { name: "chord symbol" }).click();
  await p.getByLabel("Chord", { exact: true }).fill(value);
  await p.getByRole("button", { name: "Set", exact: true }).click();
  await expect(p.getByLabel("Chord", { exact: true })).toHaveCount(0);
};
const sheetChord = async (p: Page, value: string) => {
  await inspector(p).getByLabel("chord symbol").fill(value);
  await inspector(p).getByRole("button", { name: "set" }).click();
  await expect(inspector(p).getByLabel("chord symbol")).toHaveValue(value);
};
const countShows = (p: Page, n: number, where: "toolbar" | "sheet") =>
  expect(
    where === "toolbar"
      ? p.getByLabel("Repeat count")
      : inspector(p).getByLabel("repeat count", { exact: true }),
  ).toHaveText(`×${n}`);

const EDITS: {
  name: string;
  toolbar: (p: Page) => Promise<void>;
  sheet: (p: Page) => Promise<void>;
}[] = [
  {
    name: "repeat increase",
    toolbar: async (p) => {
      await p.getByRole("button", { name: "Repeat one more time" }).click();
      await countShows(p, 2, "toolbar");
    },
    sheet: async (p) => {
      await more(p).click();
      await countShows(p, 2, "sheet");
    },
  },
  {
    name: "repeat decrease",
    toolbar: async (p) => {
      await p.getByRole("button", { name: "Repeat one more time" }).click();
      await countShows(p, 2, "toolbar");
      await p.getByRole("button", { name: "Repeat one fewer time" }).click();
      await countShows(p, 1, "toolbar");
    },
    sheet: async (p) => {
      await more(p).click();
      await countShows(p, 2, "sheet");
      await fewer(p).click();
      await countShows(p, 1, "sheet");
    },
  },
  {
    name: "x4",
    toolbar: async (p) => {
      await p.getByRole("button", { name: /^×4$/ }).click();
      await countShows(p, 4, "toolbar");
    },
    sheet: async (p) => {
      for (let n = 2; n <= 4; n++) {
        await more(p).click();
        await countShows(p, n, "sheet");
      }
    },
  },
  { name: "chord set", toolbar: (p) => toolbarChord(p, "Am"), sheet: (p) => sheetChord(p, "Am") },
  {
    name: "chord clear",
    toolbar: async (p) => {
      await toolbarChord(p, "Am");
      await toolbarChord(p, "");
    },
    sheet: async (p) => {
      await sheetChord(p, "Am");
      await sheetChord(p, "");
    },
  },
  {
    name: "delete",
    toolbar: async (p) => {
      await deleteButton(p).click();
      await expect(columns(p)).toHaveCount(0);
    },
    sheet: async (p) => {
      await inspector(p).getByRole("button", { name: "delete column" }).click();
      await expect(columns(p)).toHaveCount(0);
    },
  },
];

test.describe("INV-004 r3 stored rows", () => {
  for (const edit of EDITS) {
    test(`${edit.name}: both surfaces store the same rows`, async ({ page }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await expect(columns(page)).toHaveCount(1);
      const viaToolbar = partId(page);
      await columns(page).first().click();
      await edit.toolbar(page);
      await page.waitForTimeout(150);
      const toolbar = await storedRows(page, viaToolbar);

      await addPart(page);
      await fret(page, "E", 7).click();
      await expect(columns(page)).toHaveCount(1);
      const viaSheet = partId(page);
      await columns(page).first().click();
      await mouseHold(page, columns(page).first());
      await expect(openDialog(page)).toHaveCount(1);
      await edit.sheet(page);
      await page.waitForTimeout(150);
      const sheet = await storedRows(page, viaSheet);

      console.log(`ROWS ${edit.name} ${JSON.stringify(sheet)}`);
      expect(toolbar.events.length).toBeGreaterThan(0);
      expect(sheet).toEqual(toolbar);
    });
  }
});

/** The whole visible cursor state, by column content rather than by id. */
async function cursorState(page: Page) {
  const active = await columns(page).evaluateAll((els) =>
    els.findIndex((e) => e.getAttribute("aria-current") === "true"),
  );
  return {
    count: await columns(page).count(),
    active,
    status: await status(page).first().textContent(),
    caretLeft: (await caret(page).first().boundingBox())?.x,
  };
}

async function threeColumns(page: Page) {
  await addPart(page);
  await fret(page, "E", 7).click();
  await fret(page, "A", 5).click();
  await fret(page, "D", 3).click();
  await expect(columns(page)).toHaveCount(3);
}

test.describe("INV-004 r3 delete lands the cursor in one place", () => {
  for (const position of [0, 1, 2, "end"] as const) {
    test(`deleting the cursor's column, position ${position}`, async ({ page }) => {
      await startCapturing(page);
      const index = position === "end" ? 2 : position;

      await threeColumns(page);
      if (position !== "end") await columns(page).nth(index).click();
      await deleteButton(page).click();
      await expect(columns(page)).toHaveCount(2);
      await page.waitForTimeout(150);
      const toolbar = await cursorState(page);

      await threeColumns(page);
      if (position !== "end") await columns(page).nth(index).click();
      await mouseHold(page, columns(page).nth(index));
      await inspector(page).getByRole("button", { name: "delete column" }).click();
      await expect(columns(page)).toHaveCount(2);
      await expect(openDialog(page)).toHaveCount(0);
      await page.waitForTimeout(150);
      const sheet = await cursorState(page);

      console.log(`CURSOR ${position} ${JSON.stringify(sheet)}`);
      expect(sheet).toEqual(toolbar);
    });
  }

  for (const [cursorAt, deleted] of [
    [0, 2],
    [2, 0],
    [1, 0],
  ] as const) {
    test(`deleting another column leaves the cursor alone: cursor ${cursorAt}, deleted ${deleted}`, async ({
      page,
    }) => {
      await startCapturing(page);
      await threeColumns(page);
      await columns(page).nth(cursorAt).click();
      const text = await columns(page).nth(cursorAt).innerText();
      await mouseHold(page, columns(page).nth(deleted));
      await inspector(page).getByRole("button", { name: "delete column" }).click();
      await expect(columns(page)).toHaveCount(2);
      await expect(openDialog(page)).toHaveCount(0);
      const now = page.locator('[data-testid="tab-column"][aria-current="true"]');
      await expect(now).toHaveCount(1);
      expect(await now.innerText()).toBe(text);
      await expect(status(page).first()).toHaveText("adding after the marked column");
    });
  }
});
