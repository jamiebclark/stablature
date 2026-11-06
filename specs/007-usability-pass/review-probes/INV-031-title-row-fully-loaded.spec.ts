/**
 * FR-001, INV-031, INV-023, round 3. T158's title gives way first. Round 2's probe held every other thing on the row at
 * its lightest: a seeded bpm and a small sync word. This loads the row: title length x parts x tempo x a long sync word,
 * at both widths and on a mouse, and asks that every action on it is on the row, and that `+ part` takes one tap after a
 * swipe. Filter: rects against the row, and the URL the tap lands on. No class is read.
 */
import { expect, test, type Page } from "@playwright/test";
import { n, seedSong, type Col } from "../../../e2e/reading-helpers";
import { idb, outbox, patchSong } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(200_000);

const TITLES = [
  { name: "short", title: "Riff" },
  { name: "36", title: "Everything in Its Right Place (Live)" },
  { name: "120", title: "A very long song title ".repeat(6).slice(0, 120) },
];
const TEMPOS = [
  { name: "no tempo", bpm: null },
  { name: "300 bpm", bpm: 300 },
];
const short: Col[] = [n(3, { d: "q" }), n(5, { d: "q" })];

/** Seeded columns skip the outbox, so the sync word is short. This queues copies of a real row, to make it three digits. */
const manyUnsynced = async (page: Page) => {
  const [row] = await outbox(page);
  await idb(
    page,
    `const { seq, ...rest } = arg.row; const tx = db.transaction("outbox", "readwrite"); const store = tx.objectStore("outbox"); for (let i = 0; i < 130; i++) store.add({ ...rest, rowId: "probe-" + i }); await new Promise((done) => { tx.oncomplete = done; });`,
    { row },
  );
};

const parts = (count: number, columns: Col[]) =>
  Array.from({ length: count }, (_, i) => ({ key: `p${i}`, label: String.fromCharCode(65 + i), columns }));

const readRow = (page: Page) =>
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
  for (const { name, title } of TITLES) {
    for (const tempo of TEMPOS) {
      for (const count of [1, 12]) {
        for (const load of ["few", "many"] as const) {
          test(`FR-001 ${name} title, ${tempo.name}, ${count} part(s), ${load} unsynced, at ${width}`, async ({ page, isMobile }) => {
            test.skip(!isMobile, "the row is budgeted at 375 on touch");
            const { songUrl, parts: ids } = await seedSong(page, parts(count, short), [{ part: "p0" }]);
            await patchSong(page, { title, bpm: tempo.bpm });
            if (load === "many") await manyUnsynced(page);
            await page.setViewportSize({ width, height: 667 });
            await page.goto(`${songUrl}/capture/${ids.p0}`);
            await expect(page.getByTestId("tab-column").first()).toBeAttached();
            await page.waitForTimeout(200);
            const row = await readRow(page);
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

for (const width of [500, 820, 1280]) {
  test(`FR-001 on a mouse at ${width}: a 120-character title, twelve parts`, async ({ page, isMobile }) => {
    test.skip(isMobile, "the fine pointer has its own floors");
    const { songUrl, parts: ids } = await seedSong(page, parts(12, short), [{ part: "p0" }]);
    await patchSong(page, { title: TITLES[2].title, bpm: 300 });
    await page.setViewportSize({ width, height: 800 });
    await page.goto(`${songUrl}/capture/${ids.p0}`);
    await expect(page.getByTestId("tab-column").first()).toBeAttached();
    await page.waitForTimeout(200);
    const row = await readRow(page);
    console.log(`ROW mouse ${width}: back ${row.back.toFixed(0)} strip ${row.strip.toFixed(0)} over ${row.over.toFixed(1)} | ${row.text}`);
    expect.soft(row.over).toBeLessThanOrEqual(0.5);
    expect.soft(row.strip).toBeGreaterThanOrEqual(36);
    await page.getByTestId("capture-title-row").locator("a").first().evaluate((a) => {
      const s = a.parentElement!;
      s.scrollLeft = s.scrollWidth;
    });
    const before = page.url();
    await page.getByRole("button", { name: "Add a part" }).click({ timeout: 4000 });
    await expect(page).not.toHaveURL(before);
  });
}
