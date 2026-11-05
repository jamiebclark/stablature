/**
 * INV-009 / FR-012 / FR-016 / FR-018 / SC-010. The capture screen at 375x667: the header's height and
 * the staff's box, with and without a duration, against the same screen with this entry's two
 * additions taken out (a stand-in for main: nothing else on this screen changed). 3 tunings x
 * none-and-each-of-D x cursor mid-part and at the end x 2 themes, a long title, `N unsynced`.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, details, inspector, startWith } from "../../../e2e/capture-surface-helpers";
import { idb, writeColumns } from "./helpers";

const WORDS: [string, string][] = [
  ["w", "whole note"],
  ["h", "half note"],
  ["q", "quarter note"],
  ["8", "eighth note"],
  ["16", "sixteenth note"],
  ["32", "thirty-second note"],
];

const TUNINGS = [
  { strings: 4, family: "Bass 4", preset: "E Standard" },
  { strings: 5, family: "Bass 5", preset: "B Standard" },
  { strings: 6, family: "Guitar 6", preset: "E Standard" },
];

const boxes = (page: Page) =>
  page.evaluate(() => {
    const r = (el: Element | null) => {
      const b = el?.getBoundingClientRect();
      return b ? [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 100) / 100) : null;
    };
    const staff = document.querySelector("[data-testid=tab-staff]");
    return {
      header: r(document.querySelector("header")),
      staff: r(staff),
      band: r(staff?.parentElement ?? null),
      scroll: document.documentElement.scrollHeight <= innerHeight,
    };
  });

/** The same screen with this entry's additions out of the layout. */
async function withoutThisEntry(page: Page) {
  const tag = await page.addStyleTag({
    content: "[data-testid=tempo-control],[data-testid=cursor-duration]{display:none!important}",
  });
  const b = await boxes(page);
  await tag.evaluate((el) => (el as HTMLElement).remove());
  return b;
}

for (const theme of ["light", "dark"] as const) {
  for (const t of TUNINGS) {
    test(`INV-009 ${t.strings} strings, ${theme}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 375, height: 667 });
      await page.emulateMedia({ colorScheme: theme });
      const { partUrl } = await startWith(page, t.family, t.preset, t.strings);
      await page.getByRole("button", { name: /string, fret 5,/ }).first().click();
      await expect(columns(page)).toHaveCount(1);
      const partId = partUrl.split("/capture/")[1];
      await writeColumns(page, partId, [
        { d: null },
        ...WORDS.map(([d]) => ({ d })),
        { d: null },
      ]);
      await page.goto(partUrl);
      await expect(columns(page)).toHaveCount(8);

      const first = await withoutThisEntry(page);
      expect(first.scroll).toBe(true);
      expect(first.header?.[3]).toBe(37);
      const staffHeight = first.staff?.[3];

      // Mid-part: walk the cursor over none and each of D.
      for (const [i, entry] of [[null, null] as const, ...WORDS].entries()) {
        await columns(page).nth(i).click();
        const words = entry[1];
        const shown = page.getByTestId("cursor-duration");
        if (words) await expect(shown).toHaveText(words);
        else await expect(shown).toHaveCount(0);
        // The band may scroll with the cursor on six strings, so compare at the same moment.
        expect(await boxes(page), `mid-part ${entry[0]}`).toEqual(await withoutThisEntry(page));
        expect((await boxes(page)).staff?.[3], `mid-part ${entry[0]}`).toBe(staffHeight);
        if (words) {
          const fits = await shown.evaluate((el) => {
            const b = el.getBoundingClientRect();
            const row = el.parentElement!.getBoundingClientRect();
            return b.right <= row.right && b.width > 0;
          });
          expect(fits, `${words} clipped by the status row`).toBe(true);
        }
      }

      // At the end: the last column takes each value through the inspector.
      await page.getByRole("button", { name: /end/ }).click();
      expect(await boxes(page), "at the end, none").toEqual(await withoutThisEntry(page));
      await expect(page.getByTestId("cursor-duration")).toHaveCount(0);
      for (const [id, words] of WORDS) {
        await details(page).click();
        await expect(inspector(page)).toBeVisible();
        await page
          .getByTestId("duration-row")
          .getByRole("button", { name: words, exact: true })
          .click();
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("cursor-duration")).toHaveText(words);
        expect(await boxes(page), `at the end ${id}`).toEqual(await withoutThisEntry(page));
        expect((await boxes(page)).staff?.[3], `at the end ${id}`).toBe(staffHeight);
      }
      await expect(page.getByTestId("tab-rhythm")).toHaveCount(0);
    });
  }
}

test("INV-009 a long title and `N unsynced` leave the header as it was, and the control in view", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
  await page.setViewportSize({ width: 375, height: 667 });
  const { partUrl } = await startWith(page, "Bass 5", "B Standard", 5);
  await page.getByRole("button", { name: /string, fret 5,/ }).first().click();
  await idb(
    page,
    `const tx = db.transaction("songs", "readwrite");
     const s = tx.objectStore("songs");
     const r = s.getAll();
     r.onsuccess = () => { for (const row of r.result) s.put({ ...row, title: "A very long song title that goes on and on and on past any phone screen", bpm: 118 }); };
     await new Promise((res) => (tx.oncomplete = res));`,
  );
  await page.goto(partUrl);
  await expect(page.getByText(/\d+ unsynced/)).toBeVisible();
  const base = await withoutThisEntry(page);
  expect(await boxes(page)).toEqual(base);
  const control = (await page.getByTestId("tempo-control").boundingBox())!;
  expect(control.x).toBeGreaterThan(0);
  expect(control.x + control.width).toBeLessThanOrEqual(375);
  await expect(page.getByTestId("tempo-control")).toHaveText("118 bpm");
});
