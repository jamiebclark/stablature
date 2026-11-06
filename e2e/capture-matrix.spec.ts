/**
 * INV-001 to INV-004 and INV-031 over their whole sets. The suite's tests are marked "reduced matrix: one tuning,
 * 375 wide", and the Guitar 7 members were never run.
 */
import { expect, test, type Page } from "@playwright/test";
import { addChord, columns, fret, stackLatch } from "./capture-surface-helpers";
import { bar, n, seedSong, type Col } from "./reading-helpers";
import { cols, idb, outbox, patchSong, seed } from "./rhythm-probe-helpers";
import { addRests, measureBand, selectColumns, startWith, tupletControl } from "./probe-helpers";

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
  await patchSong(page, { title: "A very long song title ".repeat(6).slice(0, 120) });
  await page.reload();
  await expect(page.getByTestId("capture-title-row")).toBeVisible();
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
    const room = await row.evaluate((el) => {
      const chips = el.querySelector("div")!;
      const last = chips.lastElementChild!.getBoundingClientRect();
      return Math.round(el.getBoundingClientRect().right - last.right);
    });
    expect(room, "spare width in the row, one short title and one chip").toBeGreaterThan(40);
    await expect(row.getByText("Dirge"), "FR-001: the title shares the row; surfaces.md: it gives way, down to its arrow").toBeVisible();
  });
}

const TITLES = [
  { name: "a short title", title: "Riff" },
  { name: "an ordinary title", title: "Smoke Over the Water" },
  { name: "a longer title", title: "Everything in Its Right Place (Live)" },
  { name: "a 120-character title", title: "A very long song title ".repeat(6).slice(0, 120) },
];
const TITLE_WIDTHS = [375, 390];
const titleNotes: Col[] = [n(3, { d: "q" }), n(5, { d: "q" })];
const titleParts = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ key: `p${i}`, label: String.fromCharCode(65 + i), columns: titleNotes }));

const readTitleRow = (page: Page) =>
  page.getByTestId("capture-title-row").evaluate((row) => {
    const rect = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width, height: r.height };
    };
    const back = row.querySelector("button")!;
    const links = [...row.querySelectorAll("a")];
    const strip = links[0]?.parentElement ?? null;
    const add = [...row.querySelectorAll("button")].find((b) => /part/.test(b.getAttribute("aria-label") ?? ""))!;
    return {
      back: rect(back),
      strip: strip ? rect(strip) : null,
      add: rect(add),
      rowRight: row.getBoundingClientRect().right,
      chips: links.length,
    };
  });

for (const width of TITLE_WIDTHS) {
  for (const { name, title } of TITLES) {
    for (const count of [1, 2, 12]) {
      test(`FR-001 ${name}, ${count} part(s), at ${width}: the chips and + part are on the row`, async ({ page }) => {
        const { songUrl, parts: ids } = await seedSong(page, titleParts(count), [{ part: "p0" }]);
        await patchSong(page, { title });
        await page.setViewportSize({ width, height: 667 });
        await page.goto(`${songUrl}/capture/${ids.p0}`);
        await expect(page.getByTestId("tab-column").first()).toBeAttached();
        await page.waitForTimeout(200);
        const row = await readTitleRow(page);
        console.log(`ROW ${width} | ${name} | ${count} | back ${row.back.width.toFixed(1)} | strip ${row.strip?.width.toFixed(1)} | add at ${row.add.left.toFixed(0)}-${row.add.right.toFixed(0)}`);
        expect.soft(row.back.width, "the way back is at its floor").toBeGreaterThanOrEqual(43.5);
        expect(row.strip, "a strip of chips exists").not.toBeNull();
        expect(row.strip!.width, `the chips have room: ${JSON.stringify(row)}`).toBeGreaterThanOrEqual(44);
        // `+ part` is the last thing in the strip, so a swipe of the strip must bring it fully inside.
        const add = page.getByRole("button", { name: "Add a part" });
        await add.evaluate((el) => el.scrollIntoView({ inline: "nearest", block: "nearest" }));
        await page.waitForTimeout(80);
        const after = await readTitleRow(page);
        expect(after.add.right, "+ part reachable").toBeLessThanOrEqual(after.strip!.right + 0.5);
        expect(after.add.left, "+ part reachable").toBeGreaterThanOrEqual(after.strip!.left - 0.5);
      });
    }
  }
}

const openShort = async (page: Page, list = [n(3, { d: "q" }), bar(), n(5, { d: "q" }), n(7, { d: "q" })]) => {
  const { songUrl, parts } = await seedSong(page, [{ key: "a", label: "A", columns: list }], [{ part: "a" }]);
  await page.setViewportSize({ width: 375, height: 553 });
  await page.goto(`${songUrl}/capture/${parts.a}`);
  await expect(columns(page).first()).toBeAttached();
};

const chordForm = (page: Page) => page.getByPlaceholder("Harmony, e.g. Am");

/** The form or the neck: a person needs one of them to carry on. */
const formOrNeck = async (page: Page) => {
  await page.waitForTimeout(250);
  return { form: await chordForm(page).isVisible(), neck: await fret(page, "G", 3).isVisible() };
};

test("INV-003 the chord form takes the neck's place at 553, and Cancel gives it back", async ({ page }) => {
  await openShort(page);
  await page.getByRole("button", { name: "chord symbol" }).click();
  expect(await formOrNeck(page)).toEqual({ form: true, neck: false });
  await page.getByRole("button", { name: "Cancel" }).click();
  expect(await formOrNeck(page)).toEqual({ form: false, neck: true });
});

test("INV-003 moving the cursor to a barline with the form open leaves the form or the neck", async ({ page }) => {
  await openShort(page);
  await page.getByRole("button", { name: "chord symbol" }).click();
  await columns(page).nth(1).click();
  const seen = await formOrNeck(page);
  expect(seen.form || seen.neck, JSON.stringify(seen)).toBe(true);
});

test("INV-003 the start button with the form open leaves the form or the neck", async ({ page }) => {
  await openShort(page);
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByRole("button", { name: /start$/ }).click();
  const seen = await formOrNeck(page);
  expect(seen.form || seen.neck, JSON.stringify(seen)).toBe(true);
});

test("INV-003 deleting the only column with the form open leaves the form or the neck", async ({ page }) => {
  await openShort(page, [n(3, { d: "q" })]);
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByRole("button", { name: "Delete the last column" }).click();
  await expect(columns(page)).toHaveCount(0);
  const seen = await formOrNeck(page);
  expect(seen.form || seen.neck, JSON.stringify(seen)).toBe(true);
});

const LANDSCAPE_PART = cols(...Array.from({ length: 160 }, (_, i) => (i % 5 === 4 ? "|" : "q")));

test("landscape: the neck stays reachable on a phone on its side", async ({ page, isMobile }) => {
  test.skip(!isMobile, "a phone on its side");
  const { partUrl } = await seed(page, LANDSCAPE_PART, { bpm: 120 });
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto(partUrl);
  await expect(page.getByTestId("tab-column").first()).toBeAttached();
  await page.waitForTimeout(200);
  // The lowest string's cell, the last the neck draws: scrolling must bring it fully on screen.
  const lowest = fret(page, "B", 7);
  await lowest.evaluate((el) => el.scrollIntoView({ block: "nearest" }));
  await page.waitForTimeout(100);
  const box = (await lowest.boundingBox())!;
  const seen = await page.evaluate(() => ({
    band: Math.round(document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect().height),
    docHeight: document.scrollingElement!.scrollHeight,
    inner: innerHeight,
  }));
  console.log(`landscape: ${JSON.stringify({ ...seen, top: box.y, bottom: box.y + box.height })}`);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(seen.inner + 0.5);
});

/** FR-001, INV-031: the title row fully loaded: title length x tempo x parts x a long sync word, at both widths. */
const FULL_TITLES = [
  { name: "short", title: "Riff" },
  { name: "36", title: "Everything in Its Right Place (Live)" },
  { name: "120", title: "A very long song title ".repeat(6).slice(0, 120) },
];
const FULL_TEMPOS = [
  { name: "no tempo", bpm: null },
  { name: "300 bpm", bpm: 300 },
];
const fullShort: Col[] = [n(3, { d: "q" }), n(5, { d: "q" })];

/** Seeded columns skip the outbox, so the sync word is short. This queues copies of a real row, to make it three digits. */
const manyUnsynced = async (page: Page) => {
  const [row] = await outbox(page);
  await idb(
    page,
    `const { seq, ...rest } = arg.row; const tx = db.transaction("outbox", "readwrite"); const store = tx.objectStore("outbox"); for (let i = 0; i < 130; i++) store.add({ ...rest, rowId: "probe-" + i }); await new Promise((done) => { tx.oncomplete = done; });`,
    { row },
  );
};

const fullParts = (count: number, columns: Col[]) =>
  Array.from({ length: count }, (_, i) => ({ key: `p${i}`, label: String.fromCharCode(65 + i), columns }));

const readFullRow = (page: Page) =>
  page.getByTestId("capture-title-row").evaluate((row) => {
    const box = row.getBoundingClientRect();
    const right = box.right - parseFloat(getComputedStyle(row).paddingRight);
    const back = row.querySelector("button")!;
    const links = [...row.querySelectorAll("a")];
    const strip = links[0].parentElement!;
    const kids = [...row.children].filter((k) => getComputedStyle(k).display !== "none") as HTMLElement[];
    return {
      h: box.height,
      back: back.getBoundingClientRect().width,
      strip: strip.getBoundingClientRect().width,
      over: Math.max(...kids.map((k) => k.getBoundingClientRect().right)) - right,
      cut: kids.filter((k) => k !== back && k !== strip && k.scrollWidth > k.clientWidth + 0.5).map((k) => k.textContent),
      text: (row as HTMLElement).innerText.replace(/\s+/g, " ").slice(-40),
    };
  });

for (const width of [375, 390]) {
  for (const { name, title } of FULL_TITLES) {
    for (const tempo of FULL_TEMPOS) {
      for (const count of [1, 12]) {
        for (const load of ["few", "many"] as const) {
          test(`FR-001 ${name} title, ${tempo.name}, ${count} part(s), ${load} unsynced, at ${width}`, async ({ page, isMobile }) => {
            test.skip(!isMobile, "the row is budgeted at 375 on touch");
            const { songUrl, parts: ids } = await seedSong(page, fullParts(count, fullShort), [{ part: "p0" }]);
            await patchSong(page, { title, bpm: tempo.bpm });
            if (load === "many") await manyUnsynced(page);
            await page.setViewportSize({ width, height: 667 });
            await page.goto(`${songUrl}/capture/${ids.p0}`);
            await expect(page.getByTestId("tab-column").first()).toBeAttached();
            await page.waitForTimeout(200);
            const row = await readFullRow(page);
            console.log(`ROW ${width} ${name} ${tempo.name} ${count} ${load}: back ${row.back.toFixed(0)} strip ${row.strip.toFixed(0)} over ${row.over.toFixed(1)} | ${row.text}`);
            expect.soft(row.h, "row height").toBeLessThanOrEqual(45);
            expect.soft(row.back, "the way back is at its floor").toBeGreaterThanOrEqual(43.5);
            expect.soft(row.over, "nothing past the row").toBeLessThanOrEqual(0.5);
            expect.soft(row.cut, "tempo and sync word whole").toEqual([]);
            expect.soft(row.strip, "room for at least one chip").toBeGreaterThanOrEqual(36);
            // One swipe, then one tap, and the new part is open.
            await page.getByTestId("capture-title-row").locator("a").first().evaluate((a) => {
              const s = a.parentElement!;
              s.scrollLeft = s.scrollWidth;
            });
            const before = page.url();
            await page.getByRole("button", { name: "Add a part" }).click({ timeout: 4000 });
            await expect(page).not.toHaveURL(before);
          });
        }
      }
    }
  }
}
