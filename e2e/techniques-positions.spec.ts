/**
 * INV-006 (position half), SC-010. Base part on the A string: 3, 5, h7 (spec US3 scenario 6).
 * Members: delete the source by toolbar, inspector, selection delete, cut, and from a second
 * tab; insert between; paste between; delete the arrival; paste the arrival elsewhere; variant.
 * Each reads the export, and the arrival's stored row, which must not have changed.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  columns,
  connectors,
  deleteButton,
  details,
  exportRow,
  exportText,
  fret,
  inspector,
  latch,
  openDialog,
  stable,
  startCapturing,
  storedRows,
} from "./capture-surface-helpers";

async function base(page: Page) {
  const ctx = await startCapturing(page);
  await fret(page, "A", 3).click();
  await fret(page, "A", 5).click();
  await latch(page, "hammer-on").click();
  await fret(page, "A", 7).click();
  await expect(connectors(page)).toHaveCount(1);
  await expect.poll(async () => (await storedRows(page)).length).toBe(3);
  const arrival = (await storedRows(page))[2];
  expect(arrival.techniques).toEqual({ "2": ["hammer_on"] });
  return { ...ctx, arrival };
}

async function select(page: Page, index: number) {
  await columns(page).nth(index).click();
  await stable(page).getByRole("button", { name: /select/ }).click();
}

async function expectRow(page: Page, songUrl: string, row: string) {
  expect(exportRow(await exportText(page, songUrl), "A")).toBe(row);
}

const DELETE_SOURCE: Record<string, (page: Page, partUrl: string) => Promise<void>> = {
  toolbar: async (page) => {
    await columns(page).nth(1).click();
    await deleteButton(page).click();
  },
  inspector: async (page) => {
    await columns(page).nth(1).click();
    await details(page).click();
    await inspector(page).getByRole("button", { name: "delete column" }).click();
    await expect(openDialog(page)).toHaveCount(0);
  },
  "selection delete": async (page) => {
    await select(page, 1);
    await page.getByRole("button", { name: "delete", exact: true }).click();
  },
  cut: async (page) => {
    await select(page, 1);
    await page.getByRole("button", { name: "cut", exact: true }).click();
  },
  "a second tab": async (page, partUrl) => {
    const other = await page.context().newPage();
    await other.goto(partUrl);
    await expect(columns(other)).toHaveCount(3);
    await columns(other).nth(1).click();
    await deleteButton(other).click();
    await expect(columns(other)).toHaveCount(2);
    await other.close();
  },
};

for (const [route, act] of Object.entries(DELETE_SOURCE)) {
  test(`delete the source by ${route}: reattaches to the note before it`, async ({ page }) => {
    const { songUrl, partUrl, arrival } = await base(page);
    await act(page, partUrl);
    await expect(columns(page)).toHaveCount(2);
    await expect(connectors(page)).toHaveCount(1);
    expect((await storedRows(page)).at(-1)).toEqual(arrival);
    await expectRow(page, songUrl, "-3h7-");
  });
}

test("insert between: the transition now comes from the inserted note", async ({ page }) => {
  const { songUrl, arrival } = await base(page);
  await columns(page).nth(1).click();
  await fret(page, "A", 9).click();
  await expect(columns(page)).toHaveCount(4);
  expect((await storedRows(page)).at(-1)).toEqual(arrival);
  await expectRow(page, songUrl, "-3-5-9h7-");
});

test("paste between: the transition now comes from the pasted note", async ({ page }) => {
  const { songUrl, arrival } = await base(page);
  await select(page, 0);
  await page.getByRole("button", { name: "copy", exact: true }).click();
  await columns(page).nth(1).click();
  await stable(page).getByRole("button", { name: /paste/ }).click();
  await expect(columns(page)).toHaveCount(4);
  expect((await storedRows(page)).at(-1)).toEqual(arrival);
  await expectRow(page, songUrl, "-3-5-3h7-");
});

test("delete the arrival: its transition goes with it", async ({ page }) => {
  const { songUrl } = await base(page);
  await deleteButton(page).click();
  await expect(columns(page)).toHaveCount(2);
  await expect(connectors(page)).toHaveCount(0);
  for (const row of await storedRows(page)) expect(row.techniques).toEqual({});
  await expectRow(page, songUrl, "-3-5-");
});

test("paste the arrival elsewhere: its source derives from where it lands", async ({ page }) => {
  const { songUrl } = await base(page);
  await select(page, 2);
  await page.getByRole("button", { name: "copy", exact: true }).click();
  await columns(page).nth(0).click();
  await stable(page).getByRole("button", { name: /paste/ }).click();
  await expect(columns(page)).toHaveCount(4);
  await expectRow(page, songUrl, "-3h7-5h7-");
});

test("paste the arrival at the very start: no source, nothing drawn, still stored", async ({
  page,
}) => {
  const { songUrl } = await base(page);
  await select(page, 2);
  await page.getByRole("button", { name: "copy", exact: true }).click();
  await page.getByRole("button", { name: /start/ }).click();
  await stable(page).getByRole("button", { name: /paste/ }).click();
  await expect(columns(page)).toHaveCount(4);
  expect((await storedRows(page))[0].techniques).toEqual({ "2": ["hammer_on"] });
  await expectRow(page, songUrl, "-7-3-5h7-");
});

test("a variant carries the transition", async ({ page }) => {
  const { songUrl } = await base(page);
  await page.goto(songUrl);
  await page.getByRole("button", { name: /variant/ }).first().click();
  await expect(page.getByText(/variant of/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download/ }).click();
  const chunks: Buffer[] = [];
  for await (const c of await (await download).createReadStream()) chunks.push(c as Buffer);
  const text = Buffer.concat(chunks).toString("utf-8");
  expect(exportRow(text, "A", 0)).toBe("-3-5h7-");
  expect(exportRow(text, "A", 1)).toBe("-3-5h7-");
});
