/** Shared drivers for e2e/capture-surface.spec.ts (adopted from the review probes). */
import { expect, type Locator, type Page } from "@playwright/test";

export const BASS5 = "B Standard";

export async function startCapturing(
  page: Page,
  band = "Hollow Crown",
  song = "Dirge",
) {
  await page.goto("/");
  await page.getByLabel("Band name").fill(band);
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  await expect(page.getByText(BASS5)).toBeVisible();
  await page.getByLabel("Song title").fill(song);
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  const songUrl = page.url();
  await page.getByRole("link", { name: "Capture" }).click();
  await expect(page).toHaveURL(/\/capture$/);
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
  return { songUrl, partUrl: page.url() };
}

export const columns = (page: Page) => page.getByTestId("tab-column");
export const caret = (page: Page) => page.getByTestId("tab-caret");
export const openDialog = (page: Page) => page.locator("dialog[open]");
export const inspector = (page: Page) => page.getByTestId("column-inspector");
export const status = (page: Page) =>
  page.getByText(
    /^(adding at the end|adding at the start|adding after the marked column|stacking onto the marked column)$/,
  );

export const fret = (page: Page, string: string, number: number) =>
  page.getByRole("button", {
    name: new RegExp(`^${string} string, fret ${number},`),
  });

export const stackLatch = (page: Page) =>
  page
    .getByTestId("latch-strip")
    .getByRole("button", { name: "stack notes onto the marked column" });

export const deleteButton = (page: Page) =>
  page.getByRole("button", { name: /^Delete the (last|marked) column$/ });

export async function addPart(page: Page) {
  const before = page.url();
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect(page).not.toHaveURL(before);
  await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
  await expect(columns(page)).toHaveCount(0);
}

/** A space column: a rest. */
export async function space(page: Page) {
  await page
    .getByTestId("toolbar-stable")
    .getByRole("button", { name: /space/ })
    .click();
}

export async function centre(loc: Locator) {
  const box = await loc.boundingBox();
  if (!box) throw new Error("no box");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, box };
}

/** Mouse press-and-hold, drifting (dx, dy) while held. */
export async function mouseHold(
  page: Page,
  loc: Locator,
  ms = 650,
  dx = 0,
  dy = 0,
) {
  const { x, y } = await centre(loc);
  await page.mouse.move(x, y);
  await page.mouse.down();
  if (dx || dy) await page.mouse.move(x + dx, y + dy, { steps: 6 });
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/** Real touch press-and-hold via CDP (Chromium only), drifting (dx, dy) while held. */
export async function touchHold(
  page: Page,
  loc: Locator,
  ms = 650,
  dx = 0,
  dy = 0,
) {
  const { x, y } = await centre(loc);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y }],
  });
  if (dx || dy) {
    for (let i = 1; i <= 6; i++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x: x + (dx * i) / 6, y: y + (dy * i) / 6 }],
      });
    }
  }
  await page.waitForTimeout(ms);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await cdp.detach();
}

/** Download the song's plain-text export. */
export async function exportText(page: Page, songUrl: string): Promise<string> {
  const back = page.url();
  await page.goto(songUrl);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download/ }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  await page.goto(back);
  await expect(page.getByTestId("latch-strip")).toBeVisible();
  return Buffer.concat(chunks).toString("utf-8");
}

/** Everything a dismissal must leave untouched, read from the rendered screen. */
export async function screenState(page: Page) {
  const caretBox = (await caret(page).count())
    ? await caret(page).first().boundingBox()
    : null;
  return {
    caret: caretBox,
    status: (await status(page).count())
      ? await status(page).first().textContent()
      : null,
    staff: await page.getByTestId("tab-staff").innerText(),
    active: await page
      .locator('[data-testid="tab-column"][aria-current="true"]')
      .count(),
    activeIndex: await columns(page).evaluateAll((els) =>
      els.findIndex((e) => e.getAttribute("aria-current") === "true"),
    ),
    latchPressed: await stackLatch(page).getAttribute("aria-pressed"),
  };
}
