/**
 * INV-001 to INV-004 and INV-031 over their whole sets. The suite's tests are marked "reduced matrix: one tuning,
 * 375 wide", and the Guitar 7 members were never run.
 */
import { expect, test, type Page } from "@playwright/test";
import { addChord, columns, stackLatch } from "../../../e2e/capture-surface-helpers";
import { addRests, measureBand, selectColumns, startWith, tupletControl } from "../../../e2e/probe-helpers";

test.setTimeout(240_000);
test.skip(({ isMobile }) => !isMobile, "the budget is the touch column");

const STR = [
  { family: "Bass 4", preset: "E Standard", strings: 4 },
  { family: "Bass 5", preset: "Drop A", strings: 5 },
  { family: "Guitar 6", preset: "E Standard", strings: 6 },
  { family: "Guitar 7", preset: "B Standard", strings: 7 },
] as const;

const band = (page: Page) => page.getByTestId("tab-band");

/** A chord and a bracket on one column, then the row heights and what the band can reach. */
async function chordAndBracket(page: Page) {
  await addRests(page, 4);
  await addChord(page, 0, "Am");
  await selectColumns(page, 0, 1);
  await tupletControl(page).click();
  await expect(page.getByTestId("tab-bracket").first()).toBeVisible();
}

/** A thumb lands on the part of a column the band shows. Its centre can be past the band when the band is short. */
async function tapColumn(page: Page, index: number) {
  const b = (await band(page).boundingBox())!;
  const c = (await columns(page).nth(index).boundingBox())!;
  await page.touchscreen.tap(c.x + c.width / 2, b.y + Math.max(1, b.height / 2));
}

/** A row is reachable if some scroll position shows all of it, or as much of it as the band can hold. */
const reachable = (page: Page) =>
  band(page).evaluate((el) => {
    const view = () => el.getBoundingClientRect();
    const staff = el.querySelector('[data-testid="tab-staff"]')!;
    const column = staff.querySelector('[data-testid="tab-column"]')!;
    const rows = [...column.children].flatMap((c) => (c.querySelector(".tab-cell") ? [...c.children] : [c]));
    const opened = el.scrollTop;
    const over = el.scrollHeight - el.clientHeight;
    const seen = new Set<number>();
    const look = () =>
      rows.forEach((row, i) => {
        const r = row.getBoundingClientRect();
        const shown = Math.min(r.bottom, view().bottom) - Math.max(r.top, view().top);
        if (shown >= Math.min(r.height, el.clientHeight) - 1 && shown > 0) seen.add(i);
      });
    for (let at = 0; at <= over + 2; at += 2) {
      el.scrollTop = -at;
      look();
    }
    const firstRow = rows[0].getBoundingClientRect().top - view().top;
    el.scrollTop = opened;
    return { opened, over, client: el.clientHeight, total: rows.length, seen: seen.size, firstRow };
  });

for (const tuning of STR) {
  for (const height of [667, 553]) {
    test(`INV-003 ${tuning.family} at 375x${height}: at rest, selecting, chord form open`, async ({ page }) => {
      await startWith(page, tuning);
      await chordAndBracket(page);
      await page.setViewportSize({ width: 375, height });
      // A reload, because making the bracket just revealed it (INV-005) and that is not how the band opens.
      await page.reload();
      await expect(columns(page).first()).toBeAttached();
      await page.waitForTimeout(250);
      expect.soft(Math.abs((await reachable(page)).opened), "opens at the strings nearest the neck").toBeLessThanOrEqual(1);
      const check = async (state: string) => {
        await page.waitForTimeout(150);
        const r = await reachable(page);
        console.log(`BAND ${tuning.strings}@${height} ${state}: ${JSON.stringify(r)}`);
        expect.soft(r.client, `${state}: the band has room for a string`).toBeGreaterThanOrEqual(18);
        expect.soft(r.seen, `${state}: every row reachable ${JSON.stringify(r)}`).toBe(r.total);
        expect.soft(r.firstRow, `${state}: nothing above the scroll origin`).toBeGreaterThanOrEqual(-1);
      };
      await check("at rest");
      await tapColumn(page, 0);
      await page.getByRole("button", { name: /^select$/ }).click();
      await tapColumn(page, 3);
      await expect(page.getByTestId("toolbar-selection")).toBeVisible();
      await check("selecting");
      await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click();
      await tapColumn(page, 0);
      await page.getByRole("button", { name: "chord symbol" }).click();
      await check("chord form open");
    });

    test(`INV-004 ${tuning.family} at 375x${height}: a selection hides nothing and moves nothing`, async ({ page }) => {
      await startWith(page, tuning);
      await addRests(page, 4);
      await page.setViewportSize({ width: 375, height });
      await page.waitForTimeout(150);
      const read = () =>
        page.evaluate(() => {
          const b = document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect();
          const cells = [...document.querySelectorAll('[data-testid="tab-column"]')][0].querySelectorAll(".tab-cell");
          return {
            y: b.y,
            h: b.height,
            inView: [...cells].filter((c) => {
              const r = c.getBoundingClientRect();
              return r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
            }).length,
            stable: document.querySelector('[data-testid="toolbar-stable"]')!.getBoundingClientRect().y,
          };
        });
      const before = await read();
      await selectColumns(page, 0, 2);
      const after = await read();
      expect(after.y).toBe(before.y);
      expect(after.h).toBe(before.h);
      expect(after.inView).toBeGreaterThanOrEqual(before.inView);
      expect(after.stable).toBe(before.stable);
    });
  }
}

test("INV-004 the stable row does not move as the cursor crosses a note, a rest, a barline and the start", async ({ page }) => {
  await startWith(page, STR[2]);
  await addRests(page, 2);
  await page.getByRole("button", { name: /string, fret 5,/ }).first().click();
  await page.getByTitle("Barline").click();
  await expect(columns(page)).toHaveCount(4);
  const y = async () => (await page.getByTestId("toolbar-stable").boundingBox())!.y;
  const first = await y();
  for (const i of [0, 1, 2, 3]) {
    await columns(page).nth(i).click();
    expect(await y(), `column ${i}`).toBe(first);
  }
  await page.getByRole("button", { name: /start$/ }).click();
  expect(await y(), "the start").toBe(first);
});

for (const theme of ["dark", "light"] as const) {
  for (const tuning of STR.slice(0, 3)) {
    test(`INV-001 INV-002 ${tuning.family}, ${theme}: rows and strings over every cursor state`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await startWith(page, tuning);
      await chordAndBracket(page);
      const hold = async (where: string) => {
        await page.waitForTimeout(100);
        const h = (id: string) =>
          page.evaluate((x) => document.querySelector(`[data-testid="${x}"]`)?.getBoundingClientRect().height ?? 0, id);
        expect(await h("capture-title-row"), where).toBeLessThanOrEqual(45);
        expect(await h("status-row"), where).toBeLessThanOrEqual(26);
        expect(await h("toolbar-stable"), where).toBeLessThanOrEqual(46);
        for (const id of ["toolbar-contextual", "toolbar-selection", "toolbar-reserved"]) {
          expect(await h(id), `${where} ${id}`).toBeLessThanOrEqual(46);
        }
        const m = await measureBand(page);
        expect(m.stringsClipped, `${where}: no string lost`).toBe(0);
        expect(m.pageOver, `${where}: the page does not scroll`).toBeLessThanOrEqual(0);
        const clipped = await page.evaluate(() => {
          const b = document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect();
          const inside = (s: string) =>
            [...document.querySelectorAll(s)].filter((e) => e.textContent || s.includes("bracket")).every((e) => {
              const r = e.getBoundingClientRect();
              return r.top >= b.top - 1 && r.bottom <= b.bottom + 1;
            });
          return { chord: inside('[data-testid="tab-column"] > div.text-accent'), bracket: inside('[data-testid="tab-bracket"]') };
        });
        expect(clipped, where).toEqual({ chord: true, bracket: true });
      };
      await hold("at rest");
      await columns(page).nth(1).click();
      await hold("mid-part");
      await page.getByRole("button", { name: /start$/ }).click();
      await hold("at the start, nothing focused");
      await page.getByRole("button", { name: /end/ }).first().click();
      await page.getByTitle("Barline").click();
      await hold("on a barline");
      await selectColumns(page, 0, 3);
      await hold("selecting");
    });
  }
}

test("INV-031 every control of the two rows and the toolbars is one tap away, in every capture state", async ({ page }) => {
  await startWith(page, STR[2]);
  await addRests(page, 4);
  await addChord(page, 1, "Am");
  const need = async (state: string, selecting = false) => {
    const row = page.getByTestId("capture-title-row");
    await expect(row.getByRole("button", { name: /^Back to/ }), state).toBeVisible();
    await expect(row.getByRole("button", { name: "Add a part" }), state).toBeVisible();
    await expect(row.getByTestId("tempo-control"), state).toBeVisible();
    await expect(row.getByRole("link").first(), state).toBeVisible();
    const stable = page.getByTestId("toolbar-stable");
    await expect(stable.getByRole("button", { name: /space/ }), state).toBeVisible();
    await expect(stable.getByRole("button", { name: /^Delete the/ }), state).toBeVisible();
    await expect(stable.getByRole("button", { name: /^select$/ }), state).toBeVisible();
    if (selecting) await expect(page.getByTestId("toolbar-selection"), state).toBeVisible();
    expect(await page.locator('[data-testid^="panel-"]').count(), `${state}: no panel on capture`).toBe(0);
  };
  await need("at rest, at the end");
  await columns(page).nth(1).click();
  await need("a chord in force, mid-part");
  await page.getByRole("button", { name: /start$/ }).click();
  await need("at the start");
  await page.getByRole("button", { name: /end/ }).first().click();
  await stackLatch(page).click();
  await need("stack armed");
  await stackLatch(page).click();
  await columns(page).nth(1).click();
  await page.getByRole("button", { name: "chord symbol" }).click();
  await need("chord form open");
  await page.getByRole("button", { name: "Cancel" }).click();
  await selectColumns(page, 0, 3);
  await need("selecting", true);
});

test("FR-001 the merged row holds twelve parts, a long title and N unsynced at 375", async ({ page }) => {
  await startWith(page, STR[2]);
  await addRests(page, 2);
  for (let i = 0; i < 11; i++) {
    const url = page.url();
    await page.getByRole("button", { name: "Add a part" }).click();
    await expect(page).not.toHaveURL(url);
  }
  await page.waitForTimeout(250);
  const r = await page.getByTestId("capture-title-row").evaluate((row) => {
    const b = row.getBoundingClientRect();
    const scroller = row.querySelector("div")!.getBoundingClientRect();
    const open = [...row.querySelectorAll("a")].find((a) => a.className.includes("bg-accent"))!.getBoundingClientRect();
    return {
      fit: row.scrollWidth <= row.clientWidth,
      h: b.height,
      openInView: open.left >= scroller.left - 1 && open.right <= scroller.right + 1,
      kids: [...row.children].map((k) => Math.round(k.getBoundingClientRect().right)),
      right: Math.round(b.right),
    };
  });
  expect(r.h).toBeLessThanOrEqual(45);
  expect(r.fit, JSON.stringify(r)).toBe(true);
  expect(r.openInView, "the open part is kept in view").toBe(true);
});

for (const width of [375, 390]) {
  test(`FR-001 the title shares the row at ${width} when there is room for it`, async ({ page }) => {
    await startWith(page, STR[2]);
    await page.setViewportSize({ width, height: 667 });
    await page.waitForTimeout(200);
    const row = page.getByTestId("capture-title-row");
    // Round 3: F28's fix makes the strip hug its chips, so spare room is read against the row, as e2e/capture-matrix.spec.ts does.
    const room = await row.evaluate((el) => {
      const chips = el.querySelector("div")!;
      const last = chips.lastElementChild!.getBoundingClientRect();
      return Math.round(el.getBoundingClientRect().right - last.right);
    });
    expect(room, "spare width in the row, one short title and one chip").toBeGreaterThan(40);
    await expect(row.getByText("Dirge"), "FR-001: the title shares the row; surfaces.md: it gives way, down to its arrow").toBeVisible();
  });
}
