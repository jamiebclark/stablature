import { openTools } from "./usability-helpers";
/**
 * INV-016: the sheet disturbs nothing, on capture x {cursor mid-part, latch armed, selection open,
 * chord draft open} x {closed with no set, set}.
 * INV-017: a tapped tempo against a typed one, on every surface, in the stored row and the outbox.
 * INV-018: T through the real screen, and typing 120.5 on the song page.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  caret,
  columns,
  stackLatch,
} from "./capture-surface-helpers";
import { cols, idb, outbox, recorder, seed, setStoredTempo, setTempoBySheet, songRows, tapAt, tapsFor } from "./rhythm-probe-helpers";

/** What the screen is holding, read off the screen. */
const held = (page: Page) =>
  page.evaluate(() => {
    const caretEl = document.querySelector("[data-testid=tab-caret]");
    const staff = document.querySelector("[data-testid=tab-staff]");
    const everyColumn = [...(staff?.querySelectorAll("[data-testid=tab-column],[data-testid=tab-caret]") ?? [])];
    return {
      url: location.href,
      caretAt: caretEl ? everyColumn.indexOf(caretEl) : -1,
      selected: [...document.querySelectorAll("[data-testid=tab-column][data-selected=true]")].length,
      latches: [...document.querySelectorAll("[data-testid=latch-strip] button")].map((b) =>
        b.getAttribute("aria-pressed"),
      ),
      chordDraft: (document.querySelector("input[aria-label=Chord]") as HTMLInputElement | null)?.value ?? null,
    };
  });

const SETUPS: Record<string, (page: Page) => Promise<void>> = {
  "cursor mid-part": async (page) => {
    await columns(page).nth(1).click();
    await expect(caret(page)).toBeVisible();
  },
  "latch armed": async (page) => {
    await columns(page).nth(1).click();
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
  },
  "selection open": async (page) => {
    await columns(page).nth(1).click();
    await page.getByRole("button", { name: /select/ }).click();
    await columns(page).nth(2).click();
    await expect(page.getByText(/selected/)).toBeVisible();
  },
  "chord draft open": async (page) => {
    await columns(page).nth(1).click();
    await page.getByRole("button", { name: "chord symbol" }).click();
    await page.getByRole("textbox", { name: "Chord" }).fill("Am7");
  },
};

for (const [name, setup] of Object.entries(SETUPS)) {
  for (const ending of ["closed with no set", "set"] as const) {
    test(`INV-016 capture, ${name}, ${ending}`, async ({ page }) => {
      const { partUrl } = await seed(page, cols(null, null, null, null), { arrange: false, bpm: 96 });
      await page.goto(partUrl);
      await expect(columns(page)).toHaveCount(4);
      await setup(page);
      const before = await held(page);

      await page.getByTestId("tempo-control").click();
      await tapAt(page, tapsFor(120));
      await expect(page.getByTestId("tempo-reading")).toHaveText("120");
      if (ending === "set") await page.getByTestId("tempo-set").click();
      else await page.keyboard.press("Escape");
      await expect(page.locator("dialog[open]")).toHaveCount(0);
      await expect(page.getByTestId("tempo-control")).toHaveText(ending === "set" ? "120 bpm" : "96 bpm");
      expect(await held(page)).toEqual(before);
    });
  }
}

test("INV-017 a tapped tempo behaves as a typed one on every surface and in every record", async ({ page }) => {
  await recorder(page);
  const { songUrl, partUrl, playUrl } = await seed(page, cols(null), {});
  await page.goto(partUrl);
  const clean = (await outbox(page)).length;
  await setTempoBySheet(page, 118);
  const tapped = (await songRows(page))[0];
  const entry = (await outbox(page)).filter((r) => r.table === "songs").at(-1)!;
  expect((await outbox(page)).length).toBe(clean + 1);

  await page.goto(songUrl);
  await openTools(page);
  await expect(page.getByRole("spinbutton", { name: "Beats per minute" })).toHaveValue("118");
  const bandId = await idb<string>(
    page,
    `return new Promise((res) => {
       const r = db.transaction("bands").objectStore("bands").getAll();
       r.onsuccess = () => res(r.result[0].id);
     });`,
  );
  await page.goto(`/bands/${bandId}`);
  await expect(page.getByText("118 bpm")).toBeVisible();
  await page.goto(playUrl);
  await expect(page.getByText(/— 118 bpm/)).toBeVisible();
  await expect(page.getByTestId("tempo-control")).toHaveText("118 bpm");
  await expect(page.getByTestId("click-start")).toBeEnabled();

  await page.goto(songUrl);
  await openTools(page);
  await page.getByRole("spinbutton", { name: "Beats per minute" }).fill("119");
  await expect.poll(async () => (await songRows(page))[0].bpm).toBe(119);
  const typed = (await songRows(page))[0];
  const typedEntry = (await outbox(page)).filter((r) => r.table === "songs").at(-1)!;
  expect(Object.keys(typed).sort()).toEqual(Object.keys(tapped).sort());
  expect(typeof tapped.bpm).toBe(typeof typed.bpm);
  expect(Object.keys(entry).sort()).toEqual(Object.keys(typedEntry).sort());
  expect(Object.keys(entry.row).sort()).toEqual(Object.keys(typedEntry.row).sort());
});

const T: { stored: unknown; usable: number | null }[] = [
  { stored: null, usable: null },
  { stored: 0, usable: null },
  { stored: -1, usable: null },
  { stored: 1, usable: 1 },
  { stored: 19, usable: 19 },
  { stored: 20, usable: 20 },
  { stored: 120, usable: 120 },
  { stored: 400, usable: 400 },
  { stored: 401, usable: 401 },
  { stored: 999, usable: 999 },
  { stored: 1000, usable: null },
  { stored: 120.5, usable: null },
  { stored: Number.NaN, usable: null },
  { stored: "120", usable: null },
];

test("INV-018 every stored tempo through the real screen", async ({ page }) => {
  test.setTimeout(120_000);
  await recorder(page);
  const { playUrl } = await seed(page, cols(null), { bpm: null });
  for (const t of T) {
    await page.goto(playUrl);
    await expect(page.getByTestId("click-bar")).toBeVisible();
    await setStoredTempo(page, t.stored);
    await page.goto(playUrl);
    await expect(page.getByTestId("click-bar")).toBeVisible();
    await expect(page.getByTestId("tempo-control"), String(t.stored)).toHaveText(
      t.usable === null ? "no tempo" : `${t.usable} bpm`,
    );
    if (t.usable === null) {
      await expect(page.getByTestId("click-start"), String(t.stored)).toBeDisabled();
      await expect(page.getByTestId("click-state")).toHaveText("Set a tempo to use the click.");
    } else {
      await expect(page.getByTestId("click-start"), String(t.stored)).toBeEnabled();
    }
  }
  expect((await (async () => (await page.evaluate(() => (window as unknown as { __rec: { contexts: number } }).__rec.contexts)))())).toBe(0);
});

test("INV-018 typing 120.5 on the song page reads as no tempo on the play view", async ({ page }) => {
  await recorder(page);
  const { songUrl, playUrl } = await seed(page, cols(null), { bpm: 120 });
  await page.goto(songUrl);
  await openTools(page);
  await page.getByRole("spinbutton", { name: "Beats per minute" }).fill("120.5");
  await expect.poll(async () => (await songRows(page))[0].bpm).toBe(120.5);
  await page.goto(playUrl);
  await expect(page.getByTestId("tempo-control")).toHaveText("no tempo");
  await expect(page.getByTestId("click-start")).toBeDisabled();
});
