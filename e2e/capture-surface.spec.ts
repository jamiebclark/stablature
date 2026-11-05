import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  addPart,
  caret,
  centre,
  columns,
  deleteButton,
  exportText as exportAscii,
  fret,
  inspector,
  mouseHold,
  openDialog,
  screenState,
  space,
  stackLatch,
  startCapturing,
  status,
  touchHold,
} from "./capture-surface-helpers";

/**
 * Measured 2026-11-03 against `main` (commit ddb33ea), before any task touched
 * `Fretboard.tsx`: a disposable worktree running the production build on port 4100,
 * headless Chromium at 375×667, navigating to a five-string part's capture screen and
 * reading `document.querySelectorAll('[class*="w-max"]')[1].getBoundingClientRect().height`
 * — index 1 because `TabStaff`'s wrapper also matches `w-max` and sits earlier in the DOM.
 * This is the "before" half of INV-011: the neck's height must not change.
 */
export const NECK_HEIGHT_BASELINE_PX = 238.390625;

test.describe("latch", () => {
  test("captures a three-note chord using only the neck and the strip above it", async ({
    page,
  }) => {
    await startCapturing(page);

    await fret(page, "E", 7).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByText("stacking onto the marked column"),
    ).toBeVisible();

    await fret(page, "A", 5).click();
    await fret(page, "B", 3).click();

    await expect(columns(page)).toHaveCount(1);
    const column = columns(page).first();
    await expect(column).toContainText("7");
    await expect(column).toContainText("5");
    await expect(column).toContainText("3");
  });

  /** After reaching an inapplicable target, the latch reads unlit and the next fret starts a new column. */
  async function expectDisarmed(page: Page, countBefore: number) {
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "false");
    await fret(page, "G", 2).click();
    await expect(columns(page)).toHaveCount(countBefore + 1);
    // Unlit is not enough: a latch still armed re-lights once the note lands.
    await expect(
      stackLatch(page),
      "latch re-lit itself after the next note",
    ).toHaveAttribute("aria-pressed", "false");
    await fret(page, "D", 4).click();
    await expect(
      columns(page),
      "second press stacked instead of starting a column",
    ).toHaveCount(countBefore + 2);
  }

  test("tapping a barline leaves the latch unlit", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await page.getByTitle("Barline").click();
    await fret(page, "E", 5).click();
    await expect(columns(page)).toHaveCount(3);

    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");

    await columns(page).nth(1).click(); // the barline
    await expectDisarmed(page, 3);
  });

  test("inserting a barline leaves the latch unlit", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");

    await page.getByTitle("Barline").click();
    await expect(columns(page)).toHaveCount(2);
    await expectDisarmed(page, 2);
  });

  test("jumping to the start leaves the latch unlit", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: /start/ }).click();
    await expectDisarmed(page, 1);
  });

  test("switching part leaves the latch unlit", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();

    // A second, empty part to switch to.
    await page.getByRole("button", { name: "Add a part" }).click();
    await expect(columns(page)).toHaveCount(0);
    await page.getByRole("link", { name: "A", exact: true }).click();
    await expect(columns(page)).toHaveCount(1);

    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("link", { name: "B", exact: true }).click();
    await expect(columns(page)).toHaveCount(0);
    await expectDisarmed(page, 0);
  });

  test("deleting the marked column leaves the latch unlit", async ({
    page,
  }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");

    await deleteButton(page).click();
    await expect(columns(page)).toHaveCount(0);
    await expectDisarmed(page, 0);
  });

  test("a sync delete of the marked column leaves the latch unlit", async ({
    page,
  }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");

    const partUrl = page.url();
    const second = await page.context().newPage();
    await second.goto(partUrl);
    await expect(columns(second)).toHaveCount(1);
    await deleteButton(second).click();
    await expect(columns(second)).toHaveCount(0);
    await second.close();

    await expect(columns(page)).toHaveCount(0);
    await expectDisarmed(page, 0);
  });

  test("opening a part with no columns leaves the latch unlit", async ({
    page,
  }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Add a part" }).click();
    await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
    await expect(columns(page)).toHaveCount(0);
    await expectDisarmed(page, 0);
  });
});

const stableRow = (page: Page) => page.getByTestId("toolbar-stable");
const STABLE = [
  (page: Page) => stableRow(page).getByRole("button", { name: /space/ }),
  (page: Page) => stableRow(page).getByRole("button", { name: "Barline" }),
  (page: Page) => stableRow(page).getByRole("button", { name: /select/ }),
  (page: Page) => stableRow(page).getByRole("button", { name: /paste/ }),
  (page: Page) =>
    stableRow(page).getByRole("button", {
      name: /^Delete the (last|marked) column$/,
    }),
] as const;

test.describe("toolbar", () => {
  test("stable controls do not move when the contextual row appears or goes", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    await fret(page, "E", 7).click();

    const measure = async () => {
      const boxes = [];
      for (const s of STABLE) boxes.push(await s(page).boundingBox());
      return boxes;
    };
    const onNotes = await measure();
    await page.getByTitle("Barline").click();
    const onBarline = await measure();
    expect(onBarline).toEqual(onNotes);

    await columns(page).first().click();
    expect(await measure()).toEqual(onNotes);
  });

  test("a selection hides the contextual row", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await page.getByRole("button", { name: /select/ }).click();
    await expect(page.getByText(/1 selected/)).toBeVisible();
    await expect(page.getByTestId("toolbar-contextual")).toHaveCount(0);
    await expect(
      page.getByTestId("latch-strip").getByRole("button").first(),
    ).toBeDisabled();
  });
});

/** Press and hold on a column for `ms`, optionally drifting `dx` px while held. */
async function hold(page: Page, index: number, ms = 650, dx = 0) {
  const box = await columns(page).nth(index).boundingBox();
  if (!box) throw new Error("column has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (dx) await page.mouse.move(x + dx, y, { steps: 4 });
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** A real touch press-and-hold via CDP (Chromium only): pointerType "touch", not "mouse". */
async function touchHoldAt(page: Page, index: number, ms = 650) {
  const box = await columns(page).nth(index).boundingBox();
  if (!box) throw new Error("column has no box");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  await page.waitForTimeout(ms);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}

test.describe("long press", () => {
  test("a short tap moves the cursor on pointerup with no added delay", async ({
    page,
  }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "E", 9).click();
    await columns(page).first().click();
    await expect(columns(page).first()).toHaveAttribute(
      "aria-current",
      "true",
      { timeout: 250 },
    );
    await expect(openDialog(page)).toHaveCount(0);
  });

  test("a press that moves past the threshold opens nothing and moves no caret", async ({
    page,
  }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "E", 9).click();
    const before = await page
      .getByText(/adding/)
      .first()
      .textContent();
    await hold(page, 0, 650, 30);
    await expect(openDialog(page)).toHaveCount(0);
    expect(
      await page
        .getByText(/adding/)
        .first()
        .textContent(),
    ).toBe(before);
  });
});

test.describe("inspector", () => {
  test("a touch long press opens the inspector and it stays open after release", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "touch needs a touch device");
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(2);
    await touchHoldAt(page, 0, 900);
    await page.waitForTimeout(300);
    await expect(openDialog(page)).toHaveCount(1);
    await expect(inspector(page)).toBeVisible();

    // Edit, then dismiss, from the same touch-opened sheet.
    await inspector(page)
      .getByRole("button", { name: "repeat count: one more" })
      .click();
    await page.keyboard.press("Escape");
    await expect(openDialog(page)).toHaveCount(0);
    await expect(columns(page)).toHaveCount(3);
  });

  test("long-press opens a sheet; repeat and chord symbol show on the staff", async ({
    page,
  }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "E", 9).click();
    await hold(page, 0);
    await expect(inspector(page)).toBeVisible();
    await expect(openDialog(page)).toHaveAttribute("aria-label", /Column/);

    await inspector(page)
      .getByRole("button", { name: "repeat count: one more" })
      .click();
    await inspector(page).getByLabel("chord symbol").fill("Am");
    await inspector(page).getByRole("button", { name: "set" }).click();
    await page.keyboard.press("Escape");
    await expect(openDialog(page)).toHaveCount(0);

    await expect(columns(page)).toHaveCount(3);
    await expect(page.getByTestId("tab-staff").getByText("Am")).toBeVisible();
  });

  test("deleting from the sheet closes it and removes the column", async ({
    page,
  }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "E", 9).click();
    await hold(page, 0);
    await inspector(page)
      .getByRole("button", { name: "delete column" })
      .click();
    await expect(openDialog(page)).toHaveCount(0);
    await expect(columns(page)).toHaveCount(1);
  });

  test("long-press is inert while a selection is active", async ({ page }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "E", 9).click();
    await page.getByRole("button", { name: /select/ }).click();
    await hold(page, 0);
    await expect(openDialog(page)).toHaveCount(0);
  });

  for (const touch of [false, true]) {
    test(`FR-022 a long press during a selection leaves the selection alone (${touch ? "touch" : "mouse"})`, async ({
      page,
    }, info) => {
      test.skip(
        touch && info.project.name !== "mobile",
        "touch needs a touch device",
      );
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await fret(page, "A", 5).click();
      await expect(columns(page)).toHaveCount(2);
      await page.getByRole("button", { name: /select/ }).click();
      await expect(page.getByText(/1 selected/)).toBeVisible();
      if (touch) await touchHoldAt(page, 0);
      else await hold(page, 0);
      await expect(openDialog(page)).toHaveCount(0);
      await expect(page.getByText(/^1 selected/)).toBeVisible();
    });
  }
});

/** A space column: a rest. */
const spaceColumn = (page: Page) =>
  page
    .getByTestId("toolbar-stable")
    .getByRole("button", { name: /space/ })
    .click();

/** Notes, rest, barline, notes -- the last one keeps the cursor off the first three. */
async function buildTapColumns(page: Page) {
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await spaceColumn(page);
  await page.getByTitle("Barline").click();
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(4);
}

/** Install a recorder: ms from the last pointerup/keyup to aria-current landing on column i. */
async function armGap(page: Page, index: number) {
  await page.evaluate((i) => {
    const w = window as unknown as { __gap?: number | null; __t?: number };
    w.__gap = null;
    const mark = () => (w.__t = performance.now());
    document.addEventListener("pointerup", mark, { capture: true });
    document.addEventListener("keyup", mark, { capture: true });
    document.addEventListener("keydown", mark, { capture: true });
    const col = document.querySelectorAll('[data-testid="tab-column"]')[i];
    new MutationObserver(() => {
      if (col.getAttribute("aria-current") === "true" && w.__gap === null) {
        w.__gap = performance.now() - (w.__t ?? performance.now());
      }
    }).observe(col, { attributes: true, attributeFilter: ["aria-current"] });
  }, index);
}

async function expectMovedNow(page: Page, col: Locator) {
  // Read once, no retry: the cursor must already be there.
  expect(await col.getAttribute("aria-current")).toBe("true");
  const gap = await page.evaluate(
    () => (window as unknown as { __gap: number | null }).__gap,
  );
  expect(gap).not.toBeNull();
  expect(gap!).toBeLessThan(100);
  await expect(openDialog(page)).toHaveCount(0);
}

const KINDS = [
  { name: "notes", index: 0 },
  { name: "rest", index: 1 },
  { name: "barline", index: 2 },
] as const;

test.describe("a tap is never delayed or swallowed", () => {
  for (const kind of KINDS) {
    test(`mouse tap on a ${kind.name} column`, async ({ page }) => {
      await buildTapColumns(page);
      await armGap(page, kind.index);
      await columns(page).nth(kind.index).click();
      await expectMovedNow(page, columns(page).nth(kind.index));
    });

    test(`touch tap on a ${kind.name} column`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "touch needs a touch device");
      await buildTapColumns(page);
      await armGap(page, kind.index);
      await columns(page).nth(kind.index).tap();
      await expectMovedNow(page, columns(page).nth(kind.index));
    });
  }

  test("keyboard Enter on a focused column", async ({ page }) => {
    await buildTapColumns(page);
    await armGap(page, 0);
    await columns(page).nth(0).focus();
    await page.keyboard.press("Enter");
    await expectMovedNow(page, columns(page).nth(0));
  });

  test("keyboard Enter right after a mouse long press on the same column", async ({
    page,
  }) => {
    await buildTapColumns(page);
    await hold(page, 0);
    await expect(openDialog(page)).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(openDialog(page)).toHaveCount(0);
    await columns(page).nth(0).focus();
    await page.keyboard.press("Enter");
    await expect(columns(page).nth(0)).toHaveAttribute("aria-current", "true", {
      timeout: 300,
    });
  });

  test("keyboard Enter right after a touch long press on the same column", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "touch needs a touch device");
    await buildTapColumns(page);
    await touchHoldAt(page, 0);
    // Whether or not the sheet survived the finger lifting (see the touch trace
    // probe), get it out of the way without a pointer.
    if ((await openDialog(page).count()) > 0)
      await page.keyboard.press("Escape");
    await expect(openDialog(page)).toHaveCount(0);
    await columns(page).nth(0).focus();
    await page.keyboard.press("Enter");
    await expect(columns(page).nth(0)).toHaveAttribute("aria-current", "true", {
      timeout: 300,
    });
  });
});

/** Download the song's plain-text export and return it. */
async function exportText(
  page: Page,
  songUrl: string,
  back: string,
): Promise<string> {
  await page.goto(songUrl);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download/ }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  await page.goto(back);
  return Buffer.concat(chunks).toString("utf-8");
}

test.describe("inspector parity with the toolbar", () => {
  type Edit = {
    name: string;
    toolbar: (p: Page) => Promise<void>;
    sheet: (p: Page) => Promise<void>;
  };
  const more = (p: Page) =>
    inspector(p).getByRole("button", { name: "repeat count: one more" });
  const toolbarChord = async (p: Page, value: string) => {
    await p.getByRole("button", { name: "chord symbol" }).click();
    await p.getByLabel("Chord", { exact: true }).fill(value);
    await p.getByRole("button", { name: "Set", exact: true }).click();
  };
  const sheetChord = async (p: Page, value: string) => {
    await inspector(p).getByLabel("chord symbol").fill(value);
    await inspector(p).getByRole("button", { name: "set" }).click();
  };
  const edits: Edit[] = [
    {
      name: "repeat increase",
      toolbar: (p) =>
        p.getByRole("button", { name: "Repeat one more time" }).click(),
      sheet: () => Promise.resolve(),
    },
    {
      name: "repeat decrease",
      toolbar: async (p) => {
        await p.getByRole("button", { name: "Repeat one more time" }).click();
        await p.getByRole("button", { name: "Repeat one fewer time" }).click();
      },
      sheet: async (p) => {
        await more(p).click();
        await inspector(p)
          .getByRole("button", { name: "repeat count: one fewer" })
          .click();
      },
    },
    {
      name: "x4",
      toolbar: (p) => p.getByRole("button", { name: /^×4$/ }).click(),
      sheet: async (p) => {
        for (let i = 0; i < 3; i++) await more(p).click();
      },
    },
    {
      name: "chord symbol set",
      toolbar: (p) => toolbarChord(p, "Am"),
      sheet: (p) => sheetChord(p, "Am"),
    },
    {
      name: "chord symbol clear",
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
        await inspector(p)
          .getByRole("button", { name: "delete column" })
          .click();
        await expect(columns(p)).toHaveCount(0);
      },
    },
  ];
  // "repeat increase" must press "one more" exactly once in the sheet.
  edits[0].sheet = (p) => more(p).click();

  for (const edit of edits) {
    test(`${edit.name}: toolbar and inspector export the same column`, async ({
      page,
    }) => {
      const { songUrl } = await startCapturing(page);
      const first = page.url();
      await fret(page, "E", 7).click();
      await page.getByRole("button", { name: "Add a part" }).click();
      await expect(page).not.toHaveURL(first);
      await expect(columns(page)).toHaveCount(0);
      const second = page.url();
      await fret(page, "E", 7).click();
      await expect(columns(page)).toHaveCount(1);

      await page.goto(first);
      await columns(page).first().click();
      await edit.toolbar(page);
      await page.waitForTimeout(400); // let the local write land before navigating away

      await page.goto(second);
      await hold(page, 0);
      await edit.sheet(page);
      if ((await openDialog(page).count()) > 0)
        await page.keyboard.press("Escape");
      await page.waitForTimeout(400);

      const text = await exportText(page, songUrl, second);
      const blocks = text
        .split(/\n\s*\n/)
        .map((b) => b.trim())
        .filter((b) => /[-|]/.test(b));
      expect(blocks.length).toBeGreaterThanOrEqual(2);
      const body = (b: string) =>
        b
          .split("\n")
          .filter((l) => /[-|]/.test(l))
          .join("\n");
      expect(body(blocks[blocks.length - 1])).toBe(
        body(blocks[blocks.length - 2]),
      );
    });
  }

  // INV-004 r4 (review F22): the sheet's text field must hold what was typed across a `set`.
  async function openSheetWithChord(page: Page) {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await expect(columns(page)).toHaveCount(1);
    await mouseHold(page, columns(page).first());
    await expect(openDialog(page)).toHaveCount(1);
    await inspector(page).getByLabel("chord symbol").fill("Am");
    await expect(inspector(page).getByRole("button", { name: "set" })).toBeEnabled();
  }

  /** Clicks `set`, samples the field for 400 ms, and optionally types the old value in the gap. */
  const acrossSet = (typeInGap: string | null) => {
    const root = document.querySelector('[data-testid="column-inspector"]')!;
    const input = root.querySelector<HTMLInputElement>('input[aria-label="chord symbol"]')!;
    const set = [...root.querySelectorAll("button")].find((b) => b.textContent?.trim() === "set")!;
    const write = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    const seen: string[] = [input.value];
    const frames: string[] = [];
    let typed = false;
    return new Promise<{
      seen: string[];
      frames: string[];
      typed: boolean;
      end: string;
      disabled: boolean;
    }>((resolve) => {
      const channel = new MessageChannel();
      const start = performance.now();
      const frame = () => {
        frames.push(input.value);
        if (performance.now() - start < 400) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      channel.port1.onmessage = () => {
        if (input.value !== seen.at(-1)) seen.push(input.value);
        if (typeInGap !== null && !typed && input.value === typeInGap) {
          typed = true;
          // What Playwright's fill() does.
          write.call(input, typeInGap);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (performance.now() - start < 400) channel.port2.postMessage(0);
        else {
          resolve({ seen, frames: [...new Set(frames)], typed, end: input.value, disabled: set.disabled });
        }
      };
      set.click();
      channel.port2.postMessage(0);
    });
  };

  test("INV-004 r4 the field never falls back to the old value across a set", async ({ page }) => {
    await openSheetWithChord(page);
    const r = await page.evaluate(acrossSet, null);
    expect(r.seen, "the field holds what was typed").toEqual(["Am"]);
  });

  test("INV-004 r4 a clear typed in the gap is not lost", async ({ page }) => {
    await openSheetWithChord(page);
    const r = await page.evaluate(acrossSet, "");
    expect(r.typed, "there is no gap to type in").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Whole-screen invariants at 375x667 in both themes: INV-011 (neck height),
// INV-012 (no scrolling), INV-014 (surface contrast).
// ---------------------------------------------------------------------------

const THEMES = ["light", "dark"] as const;
const PHONE = { width: 375, height: 667 };

/** Band + song on a four-string default tuning, then an empty capture screen. */
async function startFourString(page: Page) {
  await page.goto("/");
  await page.getByLabel("Band name").fill("Hollow Crown");
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  const bandUrl = page.url();

  await page.goto(`${bandUrl}/tunings`);
  await page.getByRole("button", { name: "Bass 4", exact: true }).click();
  await page.getByRole("button", { name: "Add E Standard" }).click();
  await page.getByRole("button", { name: "Make default" }).first().click();
  await expect(page.getByText("Default").first()).toBeVisible();

  await page.goto(bandUrl);
  await page.getByLabel("Song title").fill("Dirge");
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  await page.getByRole("link", { name: "Capture" }).click();
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
}

async function captureShape(page: Page, shape: "chords" | "tuplet" | "four") {
  if (shape === "four") await startFourString(page);
  else await startCapturing(page);
  await fret(page, "A", 5).click();
  await fret(page, "A", 7).click();
  await fret(page, "A", 9).click();
  if (shape === "tuplet") {
    await page.getByTitle(/triplet/).click();
  }
  if (shape !== "four") {
    await hold(page, 0);
    await inspector(page).getByLabel("chord symbol").fill("Am");
    await inspector(page).getByRole("button", { name: "set" }).click();
    await page.keyboard.press("Escape");
    await expect(openDialog(page)).toHaveCount(0);
  }
}

async function aimCursor(page: Page, target: "column" | "barline") {
  if (target === "barline")
    await page.getByRole("button", { name: "Barline" }).click();
  await expect(page.getByTestId("latch-strip")).toBeVisible();
}

test.describe("fits", () => {
  for (const theme of THEMES) {
    for (const target of ["column", "barline"] as const) {
      test(`INV-011 the neck keeps its baseline height - ${theme}, ${target}`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize(PHONE);
        await startCapturing(page);
        await fret(page, "A", 5).click();
        await aimCursor(page, target);

        const strip = await page.getByTestId("latch-strip").boundingBox();
        expect(strip?.height ?? 0).toBeGreaterThan(0);
        const grid = await page.getByTestId("fret-grid").boundingBox();
        expect(
          Math.abs((grid?.height ?? 0) - NECK_HEIGHT_BASELINE_PX),
        ).toBeLessThanOrEqual(1);
      });
    }
  }

  for (const theme of THEMES) {
    for (const shape of ["chords", "tuplet", "four"] as const) {
      for (const target of ["column", "barline"] as const) {
        test(`INV-012 the screen needs no scrolling - ${theme}, ${shape}, ${target}`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.setViewportSize(PHONE);
          await captureShape(page, shape);
          await aimCursor(page, target);

          const m = await page.evaluate(() => {
            const root = document.scrollingElement!;
            const staff = document.querySelector('[data-testid="tab-staff"]')!;
            let scroller: Element | null = staff.parentElement;
            while (
              scroller &&
              !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
            ) {
              scroller = scroller.parentElement;
            }
            const box = scroller!.getBoundingClientRect();
            const rows = [...staff.querySelectorAll(".tab-cell")].map((c) =>
              c.getBoundingClientRect(),
            );
            return {
              pageOver: root.scrollHeight - root.clientHeight,
              scrollerOver: scroller!.scrollHeight - scroller!.clientHeight,
              rowsOutside: rows.filter(
                (r) => r.top < box.top - 1 || r.bottom > box.bottom + 1,
              ).length,
              rowCount: rows.length,
            };
          });
          expect(m.rowCount).toBeGreaterThan(0);
          expect(m.pageOver).toBeLessThanOrEqual(0);
          expect(m.scrollerOver).toBeLessThanOrEqual(0);
          expect(m.rowsOutside).toBe(0);
        });
      }
    }
  }

  // FR-028 is every string PLUS the chord row. `.tab-cell` counts and scrollHeight
  // cannot see overflow off the top of a `justify-end` scroller, so read the rendered
  // chord label against the box that clips it.
  for (const theme of THEMES) {
    for (const shape of ["chords", "tuplet"] as const) {
      for (const target of ["column", "barline"] as const) {
        test(`INV-012 the chord row is on screen - ${theme}, ${shape === "tuplet" ? "chords and tuplet" : "chords"}, ${target}`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme: theme });
          await page.setViewportSize(PHONE);
          await captureShape(page, shape);
          await aimCursor(page, target);
          await page.mouse.move(0, 0);
          await page.waitForTimeout(250);

          const m = await page.evaluate(() => {
            const staff = document.querySelector('[data-testid="tab-staff"]')!;
            let scroller: Element | null = staff.parentElement;
            while (
              scroller &&
              !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
            ) {
              scroller = scroller.parentElement;
            }
            const band = scroller!.getBoundingClientRect();
            const walker = document.createTreeWalker(
              staff,
              NodeFilter.SHOW_TEXT,
            );
            let chordTop: number | null = null;
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              if (n.textContent?.trim() === "Am") {
                const range = document.createRange();
                range.selectNodeContents(n);
                chordTop = range.getBoundingClientRect().top;
              }
            }
            return {
              chordTop,
              clippedPx:
                chordTop === null ? null : Math.max(0, band.top - chordTop),
            };
          });
          expect(m.chordTop, "the chord label is on the staff").not.toBeNull();
          expect(m.clippedPx, "the chord row is on screen").toBeLessThanOrEqual(
            1,
          );
        });
      }
    }
  }

  // main hides 1 of 5 strings while the selection row wraps; this branch must be no worse.
  for (const shape of ["plain", "chords", "tuplet"] as const) {
    test(`INV-012 the staff keeps its strings during a selection - ${shape}`, async ({
      page,
    }) => {
      await page.setViewportSize(PHONE);
      if (shape === "plain") {
        await startCapturing(page);
        await fret(page, "A", 5).click();
        await fret(page, "A", 7).click();
        await fret(page, "A", 9).click();
      } else {
        await captureShape(page, shape);
      }
      await columns(page).nth(0).click();
      await page.getByRole("button", { name: "select" }).click();
      await expect(page.getByText(/^1 selected/)).toBeVisible();

      const m = await page.evaluate(() => {
        const staff = document.querySelector('[data-testid="tab-staff"]')!;
        let scroller: Element | null = staff.parentElement;
        while (
          scroller &&
          !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
        ) {
          scroller = scroller.parentElement;
        }
        const band = scroller!.getBoundingClientRect();
        const rows = [...staff.querySelectorAll(".tab-cell")].map((c) =>
          c.getBoundingClientRect(),
        );
        const tops = [...new Set(rows.map((r) => Math.round(r.top)))];
        const hidden = tops.filter((t) => {
          const r = rows.find((x) => Math.round(x.top) === t)!;
          return r.top < band.top - 1 || r.bottom > band.bottom + 1;
        });
        const root = document.scrollingElement!;
        return {
          clipped: hidden.length,
          pageOver: root.scrollHeight - root.clientHeight,
        };
      });
      expect(m.pageOver).toBeLessThanOrEqual(0);
      expect(m.clipped, "no worse than main's 1 of 5").toBeLessThanOrEqual(1);
    });
  }

  // INV-012 r4: the status row above the toolbar never clips the chord label more than `main`.
  const STATUS_SYMBOLS = ["Am", "Am7", "Cmaj7", "F#m7b5", "Xyz"];
  const STATUS_STATES = ["end", "after", "stacking"] as const;
  const STATUS_SHAPES = ["chords", "chords and tuplet"] as const;

  /** The chord label px above the clipping box on `main`, by shape and whether the row wrapped. */
  const STATUS_MAIN_CLIP = {
    chords: { oneLine: 0, wrapped: 6.6 },
    "chords and tuplet": { oneLine: 7.4, wrapped: 24.2 },
  };

  async function measureStatusRow(page: Page, symbol: string) {
    return page.evaluate((symbol) => {
      const staff = document.querySelector('[data-testid="tab-staff"]')!;
      let scroller: Element | null = staff.parentElement;
      while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
        scroller = scroller.parentElement;
      }
      const band = scroller!.getBoundingClientRect();
      const walker = document.createTreeWalker(staff, NodeFilter.SHOW_TEXT);
      let chord: DOMRect | null = null;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (n.textContent?.trim() === symbol) {
          const range = document.createRange();
          range.selectNodeContents(n);
          chord = range.getBoundingClientRect();
        }
      }
      const status = [...document.querySelectorAll("span")].find((s) =>
        /^(adding|stacking)/.test(s.textContent ?? ""),
      )!;
      const range = document.createRange();
      range.selectNodeContents(status);
      const row = status.parentElement!;
      return {
        statusText: status.textContent,
        statusLines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size,
        rowHeight: Math.round(row.getBoundingClientRect().height * 10) / 10,
        band: Math.round(band.height),
        chordClippedPx: chord ? Math.max(0, Math.round((band.top - chord.top) * 10) / 10) : null,
        labelHeight: chord ? Math.round(chord.height * 10) / 10 : null,
        pageOver: document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight,
      };
    }, symbol);
  }

  for (const shape of STATUS_SHAPES) {
    for (const state of STATUS_STATES) {
      for (const symbol of STATUS_SYMBOLS) {
        test(`INV-012 r4 status row - ${shape}, ${state}, ${symbol}`, async ({ page }, info) => {
          test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
          await page.setViewportSize({ width: 375, height: 667 });
          await startCapturing(page);
          await fret(page, "A", 5).click();
          await fret(page, "A", 7).click();
          await fret(page, "A", 9).click();
          await expect(columns(page)).toHaveCount(3);
          if (shape === "chords and tuplet") await page.getByTitle(/triplet/).click();
          await page.getByRole("button", { name: "chord symbol" }).click();
          await page.getByRole("textbox", { name: "Chord" }).fill(symbol);
          await page.getByRole("button", { name: "Set", exact: true }).click();
          await expect(page.getByRole("textbox", { name: "Chord" })).toHaveCount(0);
          if (state !== "end") await columns(page).last().click();
          if (state === "stacking") {
            await page.getByRole("button", { name: /^stack/ }).click();
            await expect(page.getByText("stacking onto the marked column")).toBeVisible();
          }
          await page.mouse.move(0, 0);
          await page.waitForTimeout(200);
          const m = await measureStatusRow(page, symbol);
          expect(m.pageOver).toBeLessThanOrEqual(0);
          expect(m.chordClippedPx, "the chord label is on the staff").not.toBeNull();
          const bar = STATUS_MAIN_CLIP[shape][m.rowHeight > 40 ? "wrapped" : "oneLine"];
          expect(m.chordClippedPx!, "no more clipped than on main").toBeLessThanOrEqual(bar);
        });
      }
    }
  }
});

// The strip now holds the five real chips (stack, h, p, /, ), so measure them as rendered.
test.describe("SC-007 five latches", () => {
  test("INV-015 five latches read and nothing moves", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await captureShape(page, "tuplet");
    await expect(columns(page)).toHaveCount(3);

    const strip = page.getByTestId("latch-strip");
    const stable = page.getByTestId("toolbar-stable");
    const grid = page.getByTestId("fret-grid");
    const chips = await strip.locator("button").evaluateAll((els) =>
      els.map((e) => {
        const b = e.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(e);
        return {
          text: e.textContent,
          left: b.left,
          right: b.right,
          height: b.height,
          overflows: e.scrollWidth > e.clientWidth,
          lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size,
        };
      }),
    );
    expect(chips).toHaveLength(5);
    for (const chip of chips) {
      expect(chip.lines, `${chip.text} stays on one line`).toBe(1);
      expect(chip.overflows, `${chip.text} does not overflow`).toBe(false);
      expect(chip.height).toBe(chips[0].height);
      expect(chip.left).toBeGreaterThanOrEqual(0);
      expect(chip.right).toBeLessThanOrEqual(PHONE.width);
    }
    expect((await strip.boundingBox())!.height, "the strip keeps its height").toBeLessThanOrEqual(38.8 + 0.5);
    expect((await grid.boundingBox())!.height).toBeGreaterThan(0);
    expect((await stable.boundingBox())!.y).toBeGreaterThan(0);
  });
});

// INV-015 ("six rows need no scrolling") is superseded: the sheet now scrolls by
// design, and what must hold on a phone is INV-018 in e2e/techniques.spec.ts.

interface Surface {
  token: string | null;
  lum: number;
}

/**
 * Resolve a computed colour to the named custom-property token that produced it
 * (null when no token does) and its relative luminance.
 */
async function resolveColours(page: Page, colours: Record<string, string>) {
  return page.evaluate((input) => {
    const probe = document.createElement("span");
    document.body.append(probe);
    const resolve = (value: string) => {
      probe.style.color = value;
      return getComputedStyle(probe).color;
    };
    const names = [
      "--bg",
      "--bg-raised",
      "--bg-sunken",
      "--accent",
      "--border",
      "--fret-cell",
      "--fret-cell-inlay",
    ];
    const byColour = new Map(names.map((n) => [resolve(`var(${n})`), n]));
    const lum = (rgb: string) => {
      const [r, g, b] = (rgb.match(/[\d.]+/g) ?? []).slice(0, 3).map((v) => {
        const c = Number(v) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const out: Record<string, { token: string | null; lum: number }> = {};
    for (const [key, rgb] of Object.entries(input)) {
      out[key] = {
        token: byColour.get(resolve(rgb)) ?? null,
        lum: lum(resolve(rgb)),
      };
    }
    probe.remove();
    return out;
  }, colours);
}

function distinct(a: Surface, b: Surface) {
  expect(a.token, "first surface resolves to a token").not.toBeNull();
  expect(b.token, "second surface resolves to a token").not.toBeNull();
  expect(a.token).not.toBe(b.token);
  // WCAG contrast ratio, so dark-theme pairs (tiny absolute differences) count fairly.
  const ratio =
    (Math.max(a.lum, b.lum) + 0.05) / (Math.min(a.lum, b.lum) + 0.05);
  expect(ratio).toBeGreaterThan(1.05);
}

test.describe("contrast", () => {
  for (const theme of THEMES) {
    test(`INV-014 every surface pair is two different tokens - ${theme} theme`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize(PHONE);
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await page.mouse.move(0, 0);

      const strip = page.getByTestId("latch-strip");
      const unarmedChip = strip
        .locator('button[aria-pressed="false"]:not([disabled])')
        .first();
      const css = (loc: ReturnType<Page["locator"]>, prop: string) =>
        loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

      const stripBg = await strip.evaluate((el) => {
        // The strip is transparent over the neck wrapper that owns the surface.
        return getComputedStyle(el.parentElement!).backgroundColor;
      });
      const neckBg = await css(fret(page, "E", 2), "background-color");
      const chipBg = await css(unarmedChip, "background-color");
      const chipBorder = await css(unarmedChip, "border-top-width");
      await stackLatch(page).click();
      const armedBg = await css(stackLatch(page), "background-color");
      const armedBorder = await css(stackLatch(page), "border-top-width");

      const c = await resolveColours(page, {
        strip: stripBg,
        neck: neckBg,
        chip: chipBg,
        armed: armedBg,
      });
      distinct(c.strip, c.neck);
      distinct(c.chip, c.strip);
      distinct(c.armed, c.strip);
      expect(parseFloat(chipBorder)).toBeGreaterThan(0);
      expect(parseFloat(armedBorder)).toBe(parseFloat(chipBorder));

      // The armed chip's border disappears into its fill, and fill and ink are the accent tokens.
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300); // let the chip's colour transition settle
      const armedLook = await stackLatch(page).evaluate((el) => {
        const cs = getComputedStyle(el);
        const probe = document.createElement("span");
        document.body.append(probe);
        const resolve = (v: string) => {
          probe.style.color = v;
          return getComputedStyle(probe).color;
        };
        const out = {
          bg: cs.backgroundColor,
          border: cs.borderTopColor,
          ink: cs.color,
          accent: resolve("var(--accent)"),
          accentText: resolve("var(--accent-text)"),
        };
        probe.remove();
        return out;
      });
      expect(armedLook.bg).toBe(armedLook.accent);
      expect(armedLook.ink).toBe(armedLook.accentText);
      expect(armedLook.border, "the border disappears into the fill").toBe(
        armedLook.bg,
      );

      await page.keyboard.press("Escape");
      await fret(page, "E", 9).click();
      await hold(page, 0);
      const sheet = page.locator("dialog[open]");
      await expect(sheet).toBeVisible();
      const sheetBg = await css(sheet, "background-color");
      const backdrop = await sheet.evaluate(
        (el) => getComputedStyle(el, "::backdrop").backgroundColor,
      );
      const rowBorder = await page
        .locator("[data-property-row]")
        .first()
        .evaluate((el) => {
          const cs = getComputedStyle(el);
          return { colour: cs.borderBottomColor, width: cs.borderBottomWidth };
        });
      const s = await resolveColours(page, {
        sheet: sheetBg,
        sep: rowBorder.colour,
      });
      // The backdrop is a translucent black scrim, not a token: it must be
      // visibly dark (alpha) where the sheet is the page surface token.
      expect(s.sheet.token).toBe("--bg");
      const alpha = Number(backdrop.match(/[\d.]+/g)?.[3] ?? 1);
      expect(alpha).toBeGreaterThanOrEqual(0.4);
      expect(parseFloat(rowBorder.width)).toBeGreaterThan(0);
      distinct(s.sep, s.sheet);
    });
  }
});

/**
 * INV-001: never is an action that was reachable on the capture screen before
 * this change unreachable after it.
 *
 * Enumerated: the plan's 17 actions, each driven through the rendered screen at
 * 375x667 and checked by its visible effect on the staff / status / selection.
 */
test.describe("probe INV-001-every-action-reachable", () => {
  test("INV-001 all 17 actions are reachable and do what they did", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    const count = page.getByLabel("Repeat count");

    await fret(page, "E", 7).click();
    await expect(columns(page)).toHaveCount(1);

    // 1-3: repeat+, repeat-, x4
    await page.getByRole("button", { name: "Repeat one more time" }).click();
    await expect(count).toHaveText("×2");
    await page.getByRole("button", { name: "Repeat one fewer time" }).click();
    await expect(count).toHaveText("×1");
    await page.getByRole("button", { name: /^×4$/ }).click();
    await expect(count).toHaveText("×4");
    await expect(columns(page)).toHaveCount(4);
    await page.getByRole("button", { name: "Repeat one fewer time" }).click();
    await page.getByRole("button", { name: "Repeat one fewer time" }).click();
    await page.getByRole("button", { name: "Repeat one fewer time" }).click();
    await expect(count).toHaveText("×1");

    // 4-5: arm stack, disarm stack
    await stackLatch(page).click();
    await expect(
      page.getByText("stacking onto the marked column"),
    ).toBeVisible();
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(1);
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByText("adding at the end")).toBeVisible();

    // 6: space
    await space(page);
    await expect(columns(page)).toHaveCount(2);
    // 7: barline
    await page.getByTitle("Barline").click();
    await expect(page.locator('[data-barline="true"]')).toHaveCount(1);

    // 8: triplet
    await fret(page, "E", 5).click();
    await fret(page, "E", 7).click();
    await fret(page, "E", 9).click();
    await page.getByRole("button", { name: "Triplet" }).click();
    await expect(
      page.getByTestId("tab-staff").getByText("3", { exact: true }).first(),
    ).toBeVisible();

    // 9-10: set and clear a chord symbol
    await page.getByRole("button", { name: "chord symbol" }).click();
    await page.getByLabel("Chord", { exact: true }).fill("Am");
    await page.getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByTestId("tab-staff").getByText("Am")).toBeVisible();
    await page.getByRole("button", { name: "chord symbol" }).click();
    await page.getByLabel("Chord", { exact: true }).fill("");
    await page.getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByTestId("tab-staff").getByText("Am")).toHaveCount(0);

    const n = await columns(page).count(); // 6
    // 11 + 14: select, then selection-copy
    await page.getByRole("button", { name: /select/ }).click();
    await expect(page.getByText(/1 selected/)).toBeVisible();
    await page.getByRole("button", { name: "copy", exact: true }).click();
    await expect(page.getByText(/selected/)).toHaveCount(0);
    // 12: paste
    await page.getByRole("button", { name: /paste/ }).click();
    await expect(columns(page)).toHaveCount(n + 1);
    // 13: delete
    await page
      .getByRole("button", { name: /^Delete the (last|marked) column$/ })
      .click();
    await expect(columns(page)).toHaveCount(n);
    // 17: selection-cancel
    await page.getByRole("button", { name: /select/ }).click();
    await page.getByRole("button", { name: "cancel", exact: true }).click();
    await expect(page.getByText(/selected/)).toHaveCount(0);
    await expect(columns(page)).toHaveCount(n);
    // 15: selection-cut
    await page.getByRole("button", { name: /select/ }).click();
    await page.getByRole("button", { name: "cut", exact: true }).click();
    await expect(columns(page)).toHaveCount(n - 1);
    // 16: selection-delete
    await page.getByRole("button", { name: /select/ }).click();
    await page.getByRole("button", { name: "delete", exact: true }).click();
    await expect(columns(page)).toHaveCount(n - 2);
  });
});

/**
 * INV-002: never does the bottom toolbar render a control that cannot act on
 * the cursor's target.
 *
 * Enumerated: 6 targets x 10 controls = 60 pairs. Targets: notes column, rest
 * column, barline, start-of-part (columns exist, cursor before the first), empty
 * part, no part at all. Controls: repeat stepper, x4, triplet, chord symbol,
 * open column details (contextual: present iff playable) and space, barline, select, paste, delete
 * (stable: always present). Presence is count(), never toBeDisabled().
 */
test.describe("probe INV-002-toolbar-presence", () => {
  const stable = (page: Page) => page.getByTestId("toolbar-stable");
  const CONTROLS = {
    // contextual
    "repeat stepper": (p: Page) =>
      p.getByRole("button", { name: /^Repeat one (more|fewer) time$/ }),
    "×4": (p: Page) => p.getByRole("button", { name: /^×4$/ }),
    triplet: (p: Page) => p.getByRole("button", { name: "Triplet" }),
    "chord symbol": (p: Page) =>
      p.getByRole("button", { name: "chord symbol" }),
    "column details": (p: Page) =>
      p.getByRole("button", { name: "Open column details" }),
    // stable
    space: (p: Page) => stable(p).getByRole("button", { name: /space/ }),
    barline: (p: Page) => stable(p).getByRole("button", { name: "Barline" }),
    select: (p: Page) => stable(p).getByRole("button", { name: /select/ }),
    paste: (p: Page) => stable(p).getByRole("button", { name: /paste/ }),
    delete: (p: Page) =>
      stable(p).getByRole("button", {
        name: /^Delete the (last|marked) column$/,
      }),
  } as const;
  const CONTEXTUAL = [
    "repeat stepper",
    "×4",
    "triplet",
    "chord symbol",
    "column details",
  ] as const;
  const STABLE = ["space", "barline", "select", "paste", "delete"] as const;

  async function expectPresence(page: Page, playable: boolean) {
    for (const id of CONTEXTUAL) {
      // the stepper is two buttons
      const want = playable ? (id === "repeat stepper" ? 2 : 1) : 0;
      await expect(CONTROLS[id](page), `${id} count`).toHaveCount(want);
    }
    if (!playable) await expect(page.getByLabel("Repeat count")).toHaveCount(0);
    for (const id of STABLE)
      await expect(CONTROLS[id](page), `${id} count`).toHaveCount(1);
  }

  test.describe("INV-002 the toolbar shows only what can act on the target", () => {
    test("target: notes column", async ({ page }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await expectPresence(page, true);
    });

    test("target: rest column", async ({ page }) => {
      await startCapturing(page);
      await space(page);
      await expect(columns(page)).toHaveCount(1);
      await expectPresence(page, true);
    });

    test("target: barline", async ({ page }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await page.getByTitle("Barline").click();
      await expectPresence(page, false);
    });

    test("target: start of part (columns exist)", async ({ page }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await page.getByRole("button", { name: /start/ }).click();
      await expect(page.getByText("adding at the start")).toBeVisible();
      await expectPresence(page, false);
    });

    test("target: empty part", async ({ page }) => {
      await startCapturing(page);
      await expect(columns(page)).toHaveCount(0);
      await expectPresence(page, false);
    });

    test("target: no part at all", async ({ page }) => {
      await page.goto("/");
      await page.getByLabel("Band name").fill("Hollow Crown");
      await page.getByRole("button", { name: "Add band" }).click();
      await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
      await page.getByLabel("Song title").fill("Dirge");
      await page.getByRole("button", { name: "Add song" }).click();
      await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
      await page.getByRole("link", { name: "Capture" }).click();
      await expect(page).toHaveURL(/\/capture$/);
      await expect(
        page.getByText("Add a part to start capturing."),
      ).toBeVisible();
      await expectPresence(page, false);
    });
  });
});

/**
 * INV-003: never does a stable toolbar control change screen coordinates as the
 * cursor moves between a playable column and a barline.
 *
 * Enumerated at 375x667: 5 controls x 2 directions (notes->barline,
 * barline->notes) = 10 measurements, each direction reached by a tap (not by
 * inserting, which changes the staff too). Also asserts every stable and
 * contextual control lies wholly inside the 375px viewport -- a nowrap row that
 * overflows would keep its coordinates by clipping its last control off-screen.
 */
test.describe("probe INV-003-stable-positions", () => {
  const stable = (page: Page) => page.getByTestId("toolbar-stable");
  const STABLE = {
    space: (p: Page) => stable(p).getByRole("button", { name: /space/ }),
    barline: (p: Page) => stable(p).getByRole("button", { name: "Barline" }),
    select: (p: Page) => stable(p).getByRole("button", { name: /select/ }),
    paste: (p: Page) => stable(p).getByRole("button", { name: /paste/ }),
    delete: (p: Page) =>
      stable(p).getByRole("button", {
        name: /^Delete the (last|marked) column$/,
      }),
  };

  async function measure(page: Page) {
    const out: Record<string, { x: number; y: number; w: number; h: number }> =
      {};
    for (const [id, loc] of Object.entries(STABLE)) {
      const b = await loc(page).boundingBox();
      if (!b) throw new Error(`${id} has no box`);
      out[id] = { x: b.x, y: b.y, w: b.width, h: b.height };
    }
    return out;
  }

  test.describe("INV-003 stable controls never move", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
    });

    for (const direction of ["notes->barline", "barline->notes"] as const) {
      test(direction, async ({ page }) => {
        await startCapturing(page);
        await fret(page, "E", 7).click();
        await page.getByTitle("Barline").click();
        await fret(page, "A", 5).click();
        await expect(columns(page)).toHaveCount(3);

        const notes = columns(page).nth(0);
        const bar = columns(page).nth(1);
        const [from, to] =
          direction === "notes->barline" ? [notes, bar] : [bar, notes];

        await from.click();
        await expect(from).toHaveAttribute("aria-current", "true");
        const before = await measure(page);
        await to.click();
        await expect(to).toHaveAttribute("aria-current", "true");
        const after = await measure(page);
        expect(after).toEqual(before);
      });
    }

    test("every toolbar control is inside the 375px viewport", async ({
      page,
    }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await expect(page.getByTestId("toolbar-contextual")).toBeVisible();
      const buttons = page.locator(
        '[data-testid="toolbar-stable"] button, [data-testid="toolbar-contextual"] button',
      );
      const n = await buttons.count();
      expect(n).toBeGreaterThanOrEqual(9);
      for (let i = 0; i < n; i++) {
        const b = await buttons.nth(i).boundingBox();
        expect(b, `button ${i}`).not.toBeNull();
        expect(b!.x).toBeGreaterThanOrEqual(0);
        expect(b!.x + b!.width).toBeLessThanOrEqual(375 + 0.5);
      }
      const overflow = await page.evaluate(() => ({
        stable: (() => {
          const e = document.querySelector('[data-testid="toolbar-stable"]')!;
          return e.scrollWidth - e.clientWidth;
        })(),
        contextual: (() => {
          const e = document.querySelector(
            '[data-testid="toolbar-contextual"]',
          )!;
          return e.scrollWidth - e.clientWidth;
        })(),
        page:
          document.scrollingElement!.scrollWidth -
          document.scrollingElement!.clientWidth,
      }));
      expect(overflow).toEqual({ stable: 0, contextual: 0, page: 0 });
    });
  });
});

/**
 * INV-005: never does a long press open an inspector where the staff is
 * read-only, or while a selection is active.
 *
 * Enumerated: song-page part staff, play-view step staff, capture staff with a
 * selection active = 3, each with a mouse hold (both projects) and a touch hold
 * (mobile). Unlike the suite's probe, this one never skips: the part is put in
 * the arrangement first so the play view really has a staff, and the test
 * fails if any surface has no column to press. Also asserts the read-only
 * columns carry no press machinery at all (not buttons, no select-none) and
 * that the DOM is unchanged by the hold.
 */
test.describe("probe INV-005-no-inspector-readonly-or-selection", () => {
  async function holdAndExpectNothing(page: Page, touch: boolean) {
    const col = columns(page).first();
    await expect(col).toBeVisible();
    const before = await page.locator("main").first().innerHTML();
    if (touch) await touchHold(page, col);
    else await mouseHold(page, col);
    await expect(openDialog(page)).toHaveCount(0);
    await expect(page.getByTestId("column-inspector")).toHaveCount(0);
    expect(await page.locator("main").first().innerHTML()).toBe(before);
  }

  async function setUp(page: Page) {
    const { songUrl, partUrl } = await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(2);
    await page.goto(songUrl);
    await page
      .getByRole("button", { name: "Add part A to the arrangement" })
      .click();
    await expect(page.getByTestId("roadmap-chip")).toHaveCount(1);
    return { songUrl, partUrl };
  }

  for (const touch of [false, true]) {
    const via = touch ? "touch" : "mouse";
    test.describe(`INV-005 (${via})`, () => {
      test.beforeEach(({}, info) => {
        test.skip(
          touch && info.project.name !== "mobile",
          "touch needs a touch device",
        );
      });

      test(`song page staff: no inspector, no press machinery (${via})`, async ({
        page,
      }) => {
        const { songUrl } = await setUp(page);
        await page.goto(songUrl);
        const col = columns(page).first();
        expect(await col.evaluate((e) => e.tagName)).toBe("DIV");
        expect((await col.getAttribute("class")) ?? "").not.toContain(
          "select-none",
        );
        await holdAndExpectNothing(page, touch);
      });

      test(`play view staff: no inspector, no press machinery (${via})`, async ({
        page,
      }) => {
        const { songUrl } = await setUp(page);
        await page.goto(`${songUrl}/play`);
        await expect(page.getByTestId("tab-staff")).toHaveCount(1);
        const col = columns(page).first();
        expect(await col.evaluate((e) => e.tagName)).toBe("DIV");
        await holdAndExpectNothing(page, touch);
      });

      test(`capture staff with a selection active (${via})`, async ({
        page,
      }) => {
        const { partUrl } = await setUp(page);
        await page.goto(partUrl);
        await expect(columns(page)).toHaveCount(2);
        await page.getByRole("button", { name: /select/ }).click();
        await expect(page.getByText(/1 selected/)).toBeVisible();
        const col = columns(page).first();
        if (touch) await touchHold(page, col);
        else await mouseHold(page, col);
        await expect(openDialog(page)).toHaveCount(0);
      });
    });
  }
});

/**
 * INV-007: never does a press that moved become either a long press or a tap.
 *
 * Enumerated: drag {left, right, vertical} x released {inside, outside} the
 * originating column = 6, with a mouse (both projects) and with real touch via
 * CDP (mobile project). "Inside" drags 30px out and comes back before release.
 * Held for 650ms, past the 500ms threshold, so a long press that ignored the
 * movement would fire. Asserts: no dialog, cursor and status unchanged.
 */
test.describe("probe INV-007-moved-press-is-neither", () => {
  async function build(page: Page) {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await fret(page, "D", 3).click();
    await expect(columns(page)).toHaveCount(3);
  }

  async function state(page: Page) {
    return {
      active: await columns(page).evaluateAll((els) =>
        els.findIndex((e) => e.getAttribute("aria-current") === "true"),
      ),
      status: await status(page).first().textContent(),
    };
  }

  const DRAGS = [
    { name: "left", dx: -30, dy: 0 },
    { name: "right", dx: 30, dy: 0 },
    { name: "vertical", dx: 0, dy: -30 },
  ] as const;

  async function mouseDrag(
    page: Page,
    index: number,
    dx: number,
    dy: number,
    back: boolean,
  ) {
    const { x, y } = await centre(columns(page).nth(index));
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 6 });
    if (back) await page.mouse.move(x, y, { steps: 6 });
    await page.waitForTimeout(650);
    await page.mouse.up();
  }

  async function touchDrag(
    page: Page,
    index: number,
    dx: number,
    dy: number,
    back: boolean,
  ) {
    const { x, y } = await centre(columns(page).nth(index));
    const cdp = await page.context().newCDPSession(page);
    const at = (px: number, py: number, type: "touchStart" | "touchMove") =>
      cdp.send("Input.dispatchTouchEvent", {
        type,
        touchPoints: [{ x: px, y: py }],
      });
    await at(x, y, "touchStart");
    for (let i = 1; i <= 6; i++)
      await at(x + (dx * i) / 6, y + (dy * i) / 6, "touchMove");
    if (back)
      for (let i = 5; i >= 0; i--)
        await at(x + (dx * i) / 6, y + (dy * i) / 6, "touchMove");
    await page.waitForTimeout(650);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  }

  test.describe("INV-007 a moved press is neither gesture", () => {
    for (const drag of DRAGS) {
      for (const back of [true, false]) {
        const where = back ? "inside" : "outside";
        test(`mouse: drag ${drag.name}, release ${where}`, async ({ page }) => {
          await build(page);
          const before = await state(page);
          await mouseDrag(page, 0, drag.dx, drag.dy, back);
          await expect(openDialog(page)).toHaveCount(0);
          expect(await state(page)).toEqual(before);
        });

        test(`touch: drag ${drag.name}, release ${where}`, async ({
          page,
        }, info) => {
          test.skip(
            info.project.name !== "mobile",
            "touch needs a touch device",
          );
          await build(page);
          const before = await state(page);
          await touchDrag(page, 0, drag.dx, drag.dy, back);
          await expect(openDialog(page)).toHaveCount(0);
          expect(await state(page)).toEqual(before);
        });
      }
    }
  });
});

/**
 * INV-008: never does the inspector stay open on a column that no longer exists.
 *
 * Enumerated over the plan's 5 routes:
 *   1. the inspector's own delete
 *   2. the toolbar's delete -- unreachable while the modal sheet is open (the
 *      page behind a showModal() dialog is inert); asserted as unreachable
 *   3. a sync delete from another device (a second tab on the same store)
 *   4. switching part (history back, the only part switch reachable while the
 *      modal is open)
 *   5. deleting the part (from the song page in a second tab)
 */
test.describe("probe INV-008-inspector-closes-when-column-gone", () => {
  test.describe("INV-008 the inspector closes when its column is gone", () => {
    test("route 1/5: the inspector's own delete", async ({ page }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await fret(page, "A", 5).click();
      await mouseHold(page, columns(page).nth(0));
      await expect(openDialog(page)).toHaveCount(1);
      await inspector(page)
        .getByRole("button", { name: "delete column" })
        .click();
      await expect(openDialog(page)).toHaveCount(0);
      await expect(columns(page)).toHaveCount(1);
    });

    test("route 2/5: the toolbar's delete is unreachable while the sheet is open", async ({
      page,
    }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await mouseHold(page, columns(page).nth(0));
      await expect(openDialog(page)).toHaveCount(1);
      // Inert behind the modal: a click at the delete button's coordinates lands on
      // the backdrop (which dismisses the sheet) and must not delete anything.
      await deleteButton(page)
        .click({ force: true, timeout: 2000 })
        .catch(() => {});
      await expect(columns(page)).toHaveCount(1);
    });

    test("route 3/5: a sync delete from another device", async ({ page }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await fret(page, "A", 5).click();
      await mouseHold(page, columns(page).nth(1));
      await expect(openDialog(page)).toHaveCount(1);

      const other = await page.context().newPage();
      await other.goto(page.url());
      await expect(columns(other)).toHaveCount(2);
      await deleteButton(other).click();
      await expect(columns(other)).toHaveCount(1);
      await other.close();

      await expect(openDialog(page)).toHaveCount(0);
      await expect(columns(page)).toHaveCount(1);
    });

    test("route 4/5: switching part (history back)", async ({ page }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await addPart(page);
      await fret(page, "A", 5).click();
      await expect(columns(page)).toHaveCount(1);
      await mouseHold(page, columns(page).nth(0));
      await expect(openDialog(page)).toHaveCount(1);
      await page.goBack();
      await expect(openDialog(page)).toHaveCount(0);
    });

    test("route 5/5: deleting the part", async ({ page }) => {
      const { songUrl } = await startCapturing(page);
      await fret(page, "E", 7).click();
      await mouseHold(page, columns(page).nth(0));
      await expect(openDialog(page)).toHaveCount(1);

      const other = await page.context().newPage();
      await other.goto(songUrl);
      await other.getByRole("button", { name: "Delete part A" }).click();
      await expect(
        other.getByRole("button", { name: "Delete part A" }),
      ).toHaveCount(0);
      await other.close();

      await expect(openDialog(page)).toHaveCount(0);
    });
  });
});

/**
 * INV-009: never does dismissing the inspector without editing change any screen state.
 *
 * Enumerated: {Esc, backdrop click, close button} x cursor {at start, on a
 * column, at end} = 9. Compares the caret's box, the status line, the staff
 * text, which column is current, the latch state -- and the part's exported
 * ASCII, taken before and after.
 */
test.describe("probe INV-009-dismiss-changes-nothing", () => {
  const ROUTES = ["escape", "backdrop", "close"] as const;
  const POSITIONS = ["start", "column", "end"] as const;

  async function place(page: Page, where: (typeof POSITIONS)[number]) {
    if (where === "start")
      await page.getByRole("button", { name: /start/ }).click();
    if (where === "column") await columns(page).nth(1).click();
    if (where === "end")
      await page.getByRole("button", { name: /end/ }).click();
  }

  async function dismiss(page: Page, route: (typeof ROUTES)[number]) {
    if (route === "escape") await page.keyboard.press("Escape");
    if (route === "close")
      await inspector(page).getByRole("button", { name: "close" }).click();
    if (route === "backdrop") await page.mouse.click(8, 8); // above a bottom sheet: the ::backdrop
  }

  test.describe("INV-009 dismissing the inspector changes nothing", () => {
    for (const route of ROUTES) {
      for (const where of POSITIONS) {
        test(`${route} with the cursor ${where === "column" ? "on a column" : `at ${where}`}`, async ({
          page,
        }) => {
          const { songUrl } = await startCapturing(page);
          await fret(page, "E", 7).click();
          await fret(page, "A", 5).click();
          await fret(page, "D", 3).click();
          await expect(columns(page)).toHaveCount(3);
          const exportBefore = await exportAscii(page, songUrl);

          await place(page, where);
          const before = await screenState(page);

          await mouseHold(page, columns(page).nth(0));
          await expect(openDialog(page)).toHaveCount(1);
          await dismiss(page, route);
          await expect(openDialog(page)).toHaveCount(0);

          expect(await screenState(page)).toEqual(before);
          expect(await exportAscii(page, songUrl)).toBe(exportBefore);
        });
      }
    }
  });
});

/**
 * INV-016: never does the selection toolbar's behaviour change.
 *
 * The six behavioural members (copy, cut, delete, cancel, the selected-count
 * message, tap-to-extend) are probed by e2e/capture.spec.ts, which this branch
 * leaves unmodified -- re-run as part of `npm run test:e2e`. This probe adds
 * FR-003's "still reads correctly once the toolbar is contextual" at 375x667:
 * the count message and all four controls visible and inside the viewport, the
 * contextual row absent, the strip inert, and the screen still free of
 * page-level scrolling with a selection up.
 */
test.describe("probe INV-016-selection-toolbar", () => {
  test("INV-016 / FR-003 the selection row reads correctly at 375x667", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await fret(page, "D", 3).click();
    await columns(page).nth(0).click();
    await page.getByRole("button", { name: /select/ }).click();
    await columns(page).nth(2).click(); // tap-to-extend
    await expect(
      page.getByText("3 selected · tap another column to extend"),
    ).toBeVisible();

    for (const name of ["copy", "cut", "delete", "cancel"]) {
      const b = page.getByRole("button", { name, exact: true });
      await expect(b).toBeVisible();
      const box = (await b.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375.5);
      expect(box.y + box.height).toBeLessThanOrEqual(667.5);
    }
    await expect(page.getByTestId("toolbar-contextual")).toHaveCount(0);
    for (const chip of await page
      .getByTestId("latch-strip")
      .getByRole("button")
      .all()) {
      await expect(chip).toBeDisabled();
    }
    const over = await page.evaluate(
      () =>
        document.scrollingElement!.scrollHeight -
        document.scrollingElement!.clientHeight,
    );
    expect(over).toBeLessThanOrEqual(0);
  });
});

/**
 * Spec obligations with no probe in the project suite:
 *   FR-017 / edge case "cursor on a barline, long-pressed": the inspector opens
 *     for the barline and offers delete only -- and a rest column gets the full
 *     set, since a rest takes a repeat and a chord symbol.
 *   FR-024: once open, every control is reachable by Tab and operable by keyboard,
 *     and the sheet is dismissible without a pointer.
 */
test.describe("probe FR-017-024-inspector-scope-and-keyboard", () => {
  test("FR-017 a long-pressed barline offers delete only; a rest offers all three", async ({
    page,
  }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await page.getByTitle("Barline").click();
    await space(page);
    await expect(columns(page)).toHaveCount(3);

    await mouseHold(page, columns(page).nth(1));
    await expect(openDialog(page)).toHaveAttribute("aria-label", "Barline");
    await expect(inspector(page).locator("[data-property-row]")).toHaveCount(1);
    await expect(
      inspector(page).getByRole("button", { name: "delete column" }),
    ).toHaveCount(1);
    await expect(inspector(page).getByLabel("repeat count")).toHaveCount(0);
    await expect(inspector(page).getByLabel("chord symbol")).toHaveCount(0);
    await page.keyboard.press("Escape");

    await mouseHold(page, columns(page).nth(2));
    await expect(openDialog(page)).toHaveAttribute("aria-label", "Column");
    await expect(inspector(page).locator("[data-property-row]")).toHaveCount(4);
  });

  test("FR-024 the inspector is operable and dismissible by keyboard alone", async ({
    page,
  }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await mouseHold(page, columns(page).nth(0));
    await expect(openDialog(page)).toHaveCount(1);

    // Tab order reaches every control inside the sheet, and focus never leaves it.
    const seen = new Set<string>();
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const a = document.activeElement as HTMLElement | null;
        return {
          inside: Boolean(a?.closest("dialog[open]")),
          name: a?.getAttribute("aria-label") ?? a?.textContent?.trim() ?? "",
        };
      });
      if (where.inside) seen.add(where.name);
    }
    for (const name of [
      "close",
      "repeat count: one fewer",
      "repeat count: one more",
      "chord symbol",
      "delete column",
    ]) {
      expect([...seen], `Tab never reached "${name}"`).toContain(name);
    }

    // Operate the stepper and the chord field by keyboard.
    await inspector(page)
      .getByRole("button", { name: "repeat count: one more" })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      inspector(page).getByLabel("repeat count", { exact: true }),
    ).toHaveText("×2");
    await inspector(page).getByLabel("chord symbol").focus();
    await page.keyboard.type("Dm");
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("tab-staff").getByText("Dm")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(openDialog(page)).toHaveCount(0);
  });
});

// Review round 2 probes, adopted (T059, T062-T067).

{
  const stable = (page: Page) => page.getByTestId("toolbar-stable");
  const STABLE = {
    space: (p: Page) => stable(p).getByRole("button", { name: /space/ }),
    barline: (p: Page) => stable(p).getByRole("button", { name: "Barline" }),
    select: (p: Page) => stable(p).getByRole("button", { name: /select/ }),
    paste: (p: Page) => stable(p).getByRole("button", { name: /paste/ }),
    delete: (p: Page) =>
      stable(p).getByRole("button", {
        name: /^Delete the (last|marked) column$/,
      }),
  };

  async function coords(page: Page) {
    const out: Record<string, { x: number; y: number }> = {};
    for (const [id, loc] of Object.entries(STABLE)) {
      const b = await loc(page).boundingBox();
      if (!b) throw new Error(`${id} has no box`);
      out[id] = { x: b.x, y: b.y };
    }
    return out;
  }

  async function build(page: Page) {
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await page.getByTitle("Barline").click();
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(3);
    await columns(page).nth(0).click();
  }

  test.describe("INV-003 r2 the stable row holds across the latch's states", () => {
    test("notes (latch armed) -> barline", async ({ page }) => {
      await build(page);
      await stackLatch(page).click();
      await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
      const armed = await coords(page);
      await columns(page).nth(1).click();
      await expect(stackLatch(page)).toBeDisabled();
      expect(await coords(page)).toEqual(armed);
    });

    test("barline -> notes, then arm in place", async ({ page }) => {
      await build(page);
      await columns(page).nth(1).click();
      await expect(stackLatch(page)).toBeDisabled();
      const onBarline = await coords(page);
      await columns(page).nth(0).click();
      await stackLatch(page).click();
      await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
      expect(await coords(page)).toEqual(onBarline);
    });

    test("the strip's height does not depend on the chip's state", async ({
      page,
    }) => {
      await build(page);
      const strip = page.getByTestId("latch-strip");
      const unarmed = (await strip.boundingBox())!.height;
      await stackLatch(page).click();
      await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
      expect((await strip.boundingBox())!.height).toBe(unarmed);
    });
  });
}

{
  async function build(page: Page) {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await fret(page, "D", 3).click();
    await expect(columns(page)).toHaveCount(3);
    await columns(page).nth(1).click();
  }

  async function dismiss(page: Page, route: string) {
    if (route === "escape") await page.keyboard.press("Escape");
    if (route === "backdrop") await page.touchscreen.tap(20, 20);
    if (route === "close") {
      const b = (await inspector(page)
        .getByRole("button", { name: "close" })
        .boundingBox())!;
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    }
  }

  test.describe("INV-009 r2 touch", () => {
    test.beforeEach(({}, info) => {
      test.skip(info.project.name !== "mobile", "touch needs a touch device");
    });

    for (const route of ["escape", "backdrop", "close"]) {
      test(`${route}: opened and dismissed by touch, nothing changes, and it reopens`, async ({
        page,
      }) => {
        await build(page);
        const before = await screenState(page);
        for (let round = 0; round < 2; round++) {
          await touchHold(page, columns(page).nth(2));
          await expect(openDialog(page)).toHaveCount(1);
          await page.waitForTimeout(150);
          await expect(
            openDialog(page),
            "the sheet survived the finger lifting",
          ).toHaveCount(1);
          await dismiss(page, route);
          await expect(openDialog(page)).toHaveCount(0);
          expect(await screenState(page)).toEqual(before);
        }
      });
    }

    test("a touch tap on the held column straight after dismissal moves the cursor", async ({
      page,
    }) => {
      await build(page);
      await touchHold(page, columns(page).nth(2));
      await expect(openDialog(page)).toHaveCount(1);
      await dismiss(page, "backdrop");
      await expect(openDialog(page)).toHaveCount(0);
      const b = (await columns(page).nth(2).boundingBox())!;
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
      await expect(columns(page).nth(2)).toHaveAttribute(
        "aria-current",
        "true",
      );
    });
  });
}

{
  test("a touch drag across the columns scrolls the staff and fires neither gesture", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "touch needs a touch device");
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    for (let i = 0; i < 30; i++) {
      await fret(page, "E", 7 + (i % 5)).click();
      await expect(columns(page)).toHaveCount(i + 1);
    }

    const scroller = page.getByRole("group", { name: "Tablature" });
    const before = await scroller.evaluate((el) => el.scrollLeft);
    expect(before).toBeGreaterThan(100);
    const activeIndex = () =>
      columns(page).evaluateAll((els) =>
        els.findIndex((e) => e.getAttribute("aria-current") === "true"),
      );
    const activeBefore = await activeIndex();

    const box = (await scroller.boundingBox())!;
    const x = box.x + 60;
    const y = box.y + box.height / 2;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 15; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + i * 12, y }],
      });
      await page.waitForTimeout(16);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
    await page.waitForTimeout(700);

    const after = await scroller.evaluate((el) => el.scrollLeft);
    console.log(`scrollLeft ${before} -> ${after}`);
    expect(after, "the staff scrolled under the drag").toBeLessThan(
      before - 50,
    );
    await expect(openDialog(page)).toHaveCount(0);
    expect(await activeIndex()).toBe(activeBefore);
  });
}

{
  async function measure(page: Page) {
    return page.evaluate(() => {
      const root = document.scrollingElement!;
      const staff = document.querySelector('[data-testid="tab-staff"]')!;
      let scroller: Element | null = staff.parentElement;
      while (
        scroller &&
        !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)
      ) {
        scroller = scroller.parentElement;
      }
      const box = scroller!.getBoundingClientRect();
      const rows = [...staff.querySelectorAll(".tab-cell")].map((c) =>
        c.getBoundingClientRect(),
      );
      return {
        pageOver: root.scrollHeight - root.clientHeight,
        scrollerOver: scroller!.scrollHeight - scroller!.clientHeight,
        stringsClipped: new Set(
          rows
            .filter((r) => r.top < box.top - 1 || r.bottom > box.bottom + 1)
            .map((r) => Math.round(r.top)),
        ).size,
        staffBand: Math.round(box.height),
      };
    });
  }

  for (const theme of ["light", "dark"] as const) {
    for (const shape of ["plain", "chords", "tuplet"] as const) {
      test(`chord form open - ${theme}, ${shape}`, async ({ page }, info) => {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width: 375, height: 667 });
        await startCapturing(page);
        await fret(page, "A", 5).click();
        await fret(page, "A", 7).click();
        await fret(page, "A", 9).click();
        await expect(columns(page)).toHaveCount(3);
        if (shape === "tuplet") await page.getByTitle(/triplet/).click();
        if (shape !== "plain") {
          await mouseHold(page, columns(page).nth(0));
          await inspector(page).getByLabel("chord symbol").fill("Am");
          await inspector(page).getByRole("button", { name: "set" }).click();
          await page.keyboard.press("Escape");
          await expect(openDialog(page)).toHaveCount(0);
        }
        await page.getByRole("button", { name: "chord symbol" }).click();
        await expect(
          page.getByRole("textbox", { name: "Chord" }),
        ).toBeVisible();
        const m = await measure(page);
        console.log(
          `[${info.project.name}] ${theme}/${shape}: ${JSON.stringify(m)}`,
        );
        expect(m.pageOver).toBeLessThanOrEqual(0);
        expect(m.scrollerOver).toBeLessThanOrEqual(0);
        expect(m.stringsClipped, "no worse than main").toBeLessThanOrEqual(2);
      });
    }
  }
}

{
  for (const where of ["mid-part", "at the end"] as const) {
    test(`contextual row across fret presses, cursor ${where}`, async ({
      page,
    }, info) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await fret(page, "A", 5).click();
      await expect(columns(page)).toHaveCount(2);
      if (where === "mid-part") await columns(page).nth(0).click();

      await page.evaluate(() => {
        const w = window as unknown as {
          __gaps: number[];
          __gone: number | null;
        };
        w.__gaps = [];
        w.__gone = null;
        new MutationObserver(() => {
          const present = !!document.querySelector(
            '[data-testid="toolbar-contextual"]',
          );
          if (!present && w.__gone === null) w.__gone = performance.now();
          if (present && w.__gone !== null) {
            w.__gaps.push(Math.round((performance.now() - w.__gone) * 10) / 10);
            w.__gone = null;
          }
        }).observe(document.body, { subtree: true, childList: true });
      });

      for (let i = 0; i < 6; i++) {
        await fret(page, "D", 3 + i).click();
        await expect(columns(page)).toHaveCount(3 + i);
      }
      const gaps = await page.evaluate(
        () => (window as unknown as { __gaps: number[] }).__gaps,
      );
      console.log(
        `[${info.project.name}] ${where}: row 2 vanished ${gaps.length}x over 6 presses, ms: ${gaps.join(", ")}`,
      );
      // One frame at 60 Hz. A gap shorter than that is never painted, so nobody can see it.
      for (const gap of gaps)
        expect(gap, "row 2 must not be gone for a painted frame").toBeLessThan(
          16,
        );
    });
  }
}

{
  const SHAPES = [{ name: "portrait 375x667", width: 375, height: 667 }];

  for (const shape of SHAPES) {
    for (const index of [0, 1, 2]) {
      test(`a touch hold edits nothing when the finger lifts - ${shape.name}, column ${index}`, async ({
        page,
      }, info) => {
        test.skip(info.project.name !== "mobile", "touch needs a touch device");
        await page.setViewportSize({ width: 375, height: 667 });
        await startCapturing(page);
        await fret(page, "E", 7).click();
        await fret(page, "A", 5).click();
        await fret(page, "D", 3).click();
        await expect(columns(page)).toHaveCount(3);
        await page.setViewportSize({
          width: shape.width,
          height: shape.height,
        });
        await page.waitForTimeout(100);

        const target = columns(page).nth(index);
        await target.scrollIntoViewIfNeeded();
        const box = (await target.boundingBox())!;

        await touchHold(page, target);
        await page.waitForTimeout(250);

        const open = await openDialog(page).count();
        const left = await columns(page).count();
        const sheet = open ? await openDialog(page).boundingBox() : null;
        console.log(
          `${shape.name} col ${index}: column ${JSON.stringify(box)} open=${open} columns=${left} sheet=${JSON.stringify(sheet)}`,
        );
        expect(left, "the finger lifting must not press a sheet control").toBe(
          3,
        );
        expect(open, "the sheet is open after the finger lifts").toBe(1);
        await expect(inspector(page)).toBeVisible();
      });
    }
  }
}

test.describe("latch", () => {
  test("history back to another part leaves the latch unlit (story 1 scenario 3)", async ({
    page,
  }) => {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await addPart(page); // router.push, so there is a history entry to go back over
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(1);
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(
      page.getByRole("button", { name: /string, fret 7,.*in this column/ }),
    ).toHaveCount(1);
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "false");
  });
});

// Adopted from review-probes/INV-004-r3-stored-row-parity.spec.ts
test.describe("inspector parity with the toolbar - stored rows (INV-004 r3)", () => {
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
          if (
            [
              "id",
              "bandId",
              "partId",
              "anchorEventId",
              "rank",
              "serverSeq",
              "hlc",
              "updatedAt",
            ].includes(key)
          )
            continue;
          if (key === "deletedAt")
            out.deleted = value !== null && value !== undefined;
          else if (/clock/i.test(key) && value && typeof value === "object")
            out.stamped = Object.keys(value).sort();
          else out[key] = value;
        }
        return out;
      };
      const events = (await all("events")).filter((r) => r.partId === id);
      const annotations = (await all("annotations")).filter(
        (r) => r.partId === id,
      );
      db.close();
      return { events: events.map(strip), annotations: annotations.map(strip) };
    }, part);
  }

  const more = (p: Page) =>
    inspector(p).getByRole("button", { name: "repeat count: one more" });
  const fewer = (p: Page) =>
    inspector(p).getByRole("button", { name: "repeat count: one fewer" });
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
    {
      name: "chord set",
      toolbar: (p) => toolbarChord(p, "Am"),
      sheet: (p) => sheetChord(p, "Am"),
    },
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
        await inspector(p)
          .getByRole("button", { name: "delete column" })
          .click();
        await expect(columns(p)).toHaveCount(0);
      },
    },
  ];

  test.describe("INV-004 r3 stored rows", () => {
    for (const edit of EDITS) {
      test(`${edit.name}: both surfaces store the same rows`, async ({
        page,
      }) => {
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
      test(`deleting the cursor's column, position ${position}`, async ({
        page,
      }) => {
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
        await inspector(page)
          .getByRole("button", { name: "delete column" })
          .click();
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
        await inspector(page)
          .getByRole("button", { name: "delete column" })
          .click();
        await expect(columns(page)).toHaveCount(2);
        await expect(openDialog(page)).toHaveCount(0);
        const now = page.locator(
          '[data-testid="tab-column"][aria-current="true"]',
        );
        await expect(now).toHaveCount(1);
        expect(await now.innerText()).toBe(text);
        await expect(status(page).first()).toHaveText(
          "adding after the marked column",
        );
      });
    }
  });
});

// Adopted from review-probes/INV-003-r3-every-column-kind.spec.ts
test.describe("toolbar - every column kind (INV-003 r3)", () => {
  const STABLE = [
    "space",
    "Barline",
    "select",
    "paste",
    /^Delete the (last|marked) column$/,
  ];

  const boxes = async (page: Page) => {
    const row = page.getByTestId("toolbar-stable");
    const out = [];
    for (const name of STABLE)
      out.push(await row.getByRole("button", { name }).boundingBox());
    return out;
  };

  const KINDS: Record<string, (page: Page) => Promise<number>> = {
    notes: async (page) => {
      await fret(page, "E", 7).click();
      await expect(columns(page)).toHaveCount(1);
      return 0;
    },
    rest: async (page) => {
      await space(page);
      await expect(columns(page)).toHaveCount(1);
      return 0;
    },
    "chord-bearing": async (page) => {
      await fret(page, "E", 7).click();
      await page.getByRole("button", { name: "chord symbol" }).click();
      await page.getByLabel("Chord", { exact: true }).fill("Am");
      await page.getByRole("button", { name: "Set", exact: true }).click();
      await expect(page.getByLabel("Chord", { exact: true })).toHaveCount(0);
      return 0;
    },
    "tuplet member": async (page) => {
      await fret(page, "A", 5).click();
      await fret(page, "A", 7).click();
      await fret(page, "A", 9).click();
      await expect(columns(page)).toHaveCount(3);
      await page.getByTitle(/triplet/).click();
      await expect(page.getByTestId("tab-staff")).toContainText("3");
      return 2;
    },
  };

  for (const [kind, make] of Object.entries(KINDS)) {
    for (const armed of [false, true]) {
      test(`${kind}, ${armed ? "armed" : "unarmed"} -> barline -> back`, async ({
        page,
      }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await startCapturing(page);
        const index = await make(page);
        const barlineAt = await columns(page).count();
        await page.getByRole("button", { name: "Barline" }).click();
        await expect(columns(page)).toHaveCount(barlineAt + 1);
        await columns(page).nth(index).click();
        if (armed) {
          await stackLatch(page).click();
          await expect(stackLatch(page)).toHaveAttribute(
            "aria-pressed",
            "true",
          );
        }

        const onColumn = await boxes(page);
        const triplet = await page
          .getByRole("button", { name: "Triplet" })
          .boundingBox();
        await columns(page).nth(barlineAt).click();
        await expect(stackLatch(page)).toBeDisabled();
        await expect(page.getByTestId("toolbar-contextual")).toHaveCount(0);
        expect(await boxes(page), "column -> barline").toEqual(onColumn);

        await columns(page).nth(index).click();
        await expect(stackLatch(page)).toBeEnabled();
        expect(await boxes(page), "barline -> column").toEqual(onColumn);
        expect(
          await page.getByRole("button", { name: "Triplet" }).boundingBox(),
        ).toEqual(triplet);
      });
    }
  }
});

// Adopted from review-probes/FR-014-r3-column-shapes.spec.ts
test.describe("FR-014 r3 column shapes", () => {
  const sheetCount = (page: Page) =>
    inspector(page).getByLabel("repeat count", { exact: true });

  test.describe("FR-014 r3 shapes", () => {
    for (const repetition of [0, 1, 2]) {
      test(`a repeated column is one event from repetition ${repetition}`, async ({
        page,
      }) => {
        await startCapturing(page);
        await fret(page, "E", 7).click();
        await page
          .getByRole("button", { name: "Repeat one more time" })
          .click();
        await expect(page.getByLabel("Repeat count")).toHaveText("×2");
        await page
          .getByRole("button", { name: "Repeat one more time" })
          .click();
        await expect(page.getByLabel("Repeat count")).toHaveText("×3");
        await fret(page, "A", 5).click();
        await expect(columns(page)).toHaveCount(4);

        await mouseHold(page, columns(page).nth(repetition));
        await expect(openDialog(page)).toHaveCount(1);
        await expect(inspector(page).getByRole("heading")).toHaveText(
          "Column 1",
        );
        await expect(sheetCount(page)).toHaveText("×3");
        await page.keyboard.press("Escape");
        await expect(openDialog(page)).toHaveCount(0);

        await columns(page).nth(repetition).click();
        await expect(
          page.locator('[data-testid="tab-column"][aria-current="true"]'),
        ).toHaveCount(3);
        await expect(page.getByLabel("Repeat count")).toHaveText("×3");
      });
    }

    test("the stepper keeps working as it unrolls the column under the sheet", async ({
      page,
    }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await mouseHold(page, columns(page).first());
      const more = inspector(page).getByRole("button", {
        name: "repeat count: one more",
      });
      for (let n = 2; n <= 6; n++) {
        await more.click();
        await expect(sheetCount(page)).toHaveText(`×${n}`);
      }
      await expect(columns(page)).toHaveCount(6);
      await expect(openDialog(page)).toHaveCount(1);
    });

    test("every column in a tuplet opens its own sheet", async ({ page }) => {
      await startCapturing(page);
      await fret(page, "A", 5).click();
      await fret(page, "A", 7).click();
      await fret(page, "A", 9).click();
      await expect(columns(page)).toHaveCount(3);
      await page.getByTitle(/triplet/).click();
      await expect(page.getByTestId("tab-staff")).toContainText("3");
      for (const index of [0, 1, 2]) {
        await mouseHold(page, columns(page).nth(index));
        await expect(inspector(page).getByRole("heading")).toHaveText(
          `Column ${index + 1}`,
        );
        await page.keyboard.press("Escape");
        await expect(openDialog(page)).toHaveCount(0);
      }
    });

    test("a hold on a column's chord label inspects that column", async ({
      page,
    }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await page.getByRole("button", { name: "chord symbol" }).click();
      await page.getByLabel("Chord", { exact: true }).fill("Am");
      await page.getByRole("button", { name: "Set", exact: true }).click();
      const label = columns(page).first().getByText("Am");
      await expect(label).toBeVisible();
      await mouseHold(page, label);
      await expect(openDialog(page)).toHaveCount(1);
      await expect(inspector(page).getByLabel("chord symbol")).toHaveValue(
        "Am",
      );
    });

    test("a rest between notes counts as a column in the title", async ({
      page,
    }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      await space(page);
      await fret(page, "A", 5).click();
      await expect(columns(page)).toHaveCount(3);
      await mouseHold(page, columns(page).nth(2));
      await expect(inspector(page).getByRole("heading")).toHaveText("Column 3");
    });

    test("a long press on an empty part does nothing", async ({
      page,
    }, info) => {
      await startCapturing(page);
      await expect(columns(page)).toHaveCount(0);
      const staff = page.getByTestId("tab-staff");
      await mouseHold(page, staff);
      if (info.project.name === "mobile") await touchHold(page, staff);
      await expect(openDialog(page)).toHaveCount(0);
      await expect(caret(page)).toHaveCount(1);
    });

    test("a real touch tap still extends a selection, and a real hold does not", async ({
      page,
    }, info) => {
      test.skip(info.project.name !== "mobile", "touch needs a touch device");
      await startCapturing(page);
      await addPart(page);
      for (const n of [3, 5, 7, 9]) await fret(page, "E", n).click();
      await expect(columns(page)).toHaveCount(4);
      await columns(page).nth(0).click();
      await page.getByRole("button", { name: "select" }).click();
      await expect(page.getByText(/^1 selected/)).toBeVisible();

      await touchHold(page, columns(page).nth(3));
      await expect(openDialog(page)).toHaveCount(0);
      await expect(page.getByText(/^1 selected/)).toBeVisible();

      const { x, y } = await centre(columns(page).nth(2));
      await page.touchscreen.tap(x, y);
      await expect(page.getByText(/^3 selected/)).toBeVisible();
    });
  });
});

// Adopted from review-probes/INV-010-r3-latch-across-inspector.spec.ts
test.describe("latch across the inspector (INV-010 r3)", () => {
  async function armedOn(page: Page, index: number) {
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await fret(page, "D", 3).click();
    await expect(columns(page)).toHaveCount(3);
    await columns(page).nth(index).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
  }

  const stacksOntoCursor = async (page: Page, expected: number) => {
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    await expect(status(page).first()).toHaveText(
      "stacking onto the marked column",
    );
    await fret(page, "G", 2).click();
    await page.waitForTimeout(150);
    await expect(
      columns(page),
      "the press joined the column, it did not start one",
    ).toHaveCount(expected);
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
  };

  const inspectorDelete = async (page: Page, index: number) => {
    await mouseHold(page, columns(page).nth(index));
    await inspector(page)
      .getByRole("button", { name: "delete column" })
      .click();
    await expect(openDialog(page)).toHaveCount(0);
  };

  test.describe("INV-010 r3 the latch across the sheet", () => {
    for (const route of ["Escape", "close"] as const) {
      test(`hold another column and dismiss by ${route}: still armed on the cursor's column`, async ({
        page,
      }) => {
        await armedOn(page, 1);
        await mouseHold(page, columns(page).nth(2));
        await expect(openDialog(page)).toHaveCount(1);
        if (route === "Escape") await page.keyboard.press("Escape");
        else
          await inspector(page).getByRole("button", { name: "close" }).click();
        await expect(openDialog(page)).toHaveCount(0);
        await stacksOntoCursor(page, 3);
      });
    }

    test("edit another column's repeat: still armed, cursor unmoved", async ({
      page,
    }) => {
      await armedOn(page, 1);
      await mouseHold(page, columns(page).nth(0));
      await inspector(page)
        .getByRole("button", { name: "repeat count: one more" })
        .click();
      await expect(columns(page)).toHaveCount(4);
      await page.keyboard.press("Escape");
      await expect(openDialog(page)).toHaveCount(0);
      await stacksOntoCursor(page, 4);
    });

    test("delete another column: still armed, cursor unmoved", async ({
      page,
    }) => {
      await armedOn(page, 1);
      await inspectorDelete(page, 2);
      await expect(columns(page)).toHaveCount(2);
      await stacksOntoCursor(page, 2);
    });

    for (const surface of ["toolbar", "inspector"] as const) {
      test(`delete the cursor's column with one before it, via ${surface}: armed, as main is`, async ({
        page,
      }) => {
        await armedOn(page, 1);
        if (surface === "toolbar") await deleteButton(page).click();
        else await inspectorDelete(page, 1);
        await expect(columns(page)).toHaveCount(2);
        await stacksOntoCursor(page, 2);
      });

      test(`delete the first column with the cursor on it, via ${surface}: dark, and the next press is a new column`, async ({
        page,
      }) => {
        await armedOn(page, 0);
        if (surface === "toolbar") await deleteButton(page).click();
        else await inspectorDelete(page, 0);
        await expect(columns(page)).toHaveCount(2);
        await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "false");
        await fret(page, "G", 2).click();
        await expect(columns(page)).toHaveCount(3);
        await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "false");
      });
    }
  });
});
