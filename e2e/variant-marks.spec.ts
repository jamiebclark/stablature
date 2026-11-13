import { expect, test, type Page } from "@playwright/test";
import { partAction } from "./part-card-helpers";
import { deleteButton, fret } from "./capture-surface-helpers";
import { bar, choose, contrast, dump, dumpDatabase, g, idb, landed, n, seedReadable, seedSong, VIEWS, type Col, type PartSpec } from "./reading-helpers";
// The review probes ran with a 120 s test timeout; the sweeps need it.test.setTimeout(120_000);

/** INV-015/026/031/033 on the song page: what a variant shows, and when. */

test("a just-made variant says it is the same, and only that, and marks follow every write", async ({ page }) => {
  const { songUrl } = await seedReadable(page);

  // Everything the line or the mark row ever shows, from before the variant exists.
  await page.evaluate(() => {
    const seen: string[] = [];
    (window as unknown as { __seen: string[] }).__seen = seen;
    const record = () => {
      for (const el of document.querySelectorAll('[data-testid="variant-line"], [data-testid="tab-diff"]')) {
        seen.push(`${el.getAttribute("data-testid")}:${el.textContent}`);
      }
    };
    new MutationObserver(record).observe(document.body, { childList: true, subtree: true, characterData: true });
  });

  await partAction(page, "A", "+ variant");
  const line = page.getByTestId("variant-line");
  await expect(line).toHaveText("Same as A");
  await expect(page.getByTestId("tab-removal")).toHaveCount(0);
  await expect(page.locator('[data-diff]')).toHaveCount(0);

  const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
  for (const entry of seen) expect(entry).toMatch(/^(variant-line:Same as A|tab-diff:)$/);

  // Tapping the line changes nothing.
  const before = await dumpDatabase(page);
  const url = page.url();
  await line.click();
  expect(page.url()).toBe(url);
  expect(await dumpDatabase(page)).toBe(before);

  // Add a note to the variant: one addition.
  await partAction(page, "A'", "Edit");
  await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
  await expect(page.getByTestId("tab-column")).toHaveCount(2);
  await fret(page, "E", 3).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(3);
  await page.goto(songUrl);
  await expect(page.getByTestId("variant-line")).toHaveText("Differs from A in bar 1: 1 added");
  await expect(page.locator('[data-diff="added"]')).toHaveCount(1);

  // Delete the parent: the variant has nothing to be compared with.
  await partAction(page, "A", "Delete");
  await expect(page.getByTestId("variant-line")).toHaveCount(0);
  await expect(page.locator("[data-diff]")).toHaveCount(0);
});

/** INV-029/030 on the play view: only the pass that draws the variant carries marks. */

test("the play view marks only the pass that plays the variant", async ({ page }) => {
  const { songUrl } = await seedReadable(page);

  // A variant of A with one more note.
  await partAction(page, "A", "+ variant");
  await expect(page.getByTestId("variant-line")).toHaveText("Same as A");
  await partAction(page, "A'", "Edit");
  await expect(page.getByTestId("tab-column")).toHaveCount(2);
  await fret(page, "E", 3).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(3);
  await page.goto(songUrl);
  await expect(page.getByTestId("variant-line")).toHaveText("Differs from A in bar 1: 1 added");

  // A x4, last pass A'.
  await page.getByTestId("roadmap-chip").first().click();
  for (let i = 0; i < 3; i += 1) await page.getByRole("button", { name: "One more repeat" }).click();
  await page.getByLabel("Last pass").selectOption({ label: "A'" });
  await expect(page.getByTestId("roadmap-chip").first()).toContainText("last: A'");

  await page.getByRole("link", { name: "Play view" }).click();
  await expect(page.getByTestId("tab-staff")).toHaveCount(4);
  const passes = page.locator("ol > li");
  for (let i = 0; i < 3; i += 1) {
    await expect(passes.nth(i).getByTestId("variant-line")).toHaveCount(0);
    await expect(passes.nth(i).getByTestId("tab-diff")).toHaveCount(0);
    await expect(passes.nth(i).getByTestId("tab-removal")).toHaveCount(0);
  }
  await expect(passes.nth(3).getByTestId("variant-line")).toHaveText("Differs from A in bar 1: 1 added");
  await expect(passes.nth(3).locator('[data-diff="added"]')).toHaveCount(1);
});

const A: Col[] = [n(5, { chord: "Am" }), n(7), bar(), n(9), n(10), bar(), n(3), n(2)];

/** What one staff shows, and what its line says. */
const staffReport = (page: Page, index: number) =>
  page.evaluate((i) => {
    const staff = document.querySelectorAll('[data-testid="tab-staff"]')[i];
    let bar = 1;
    const bars: number[] = [];
    const counts = { changed: 0, added: 0, removed: 0 };
    for (const piece of staff.querySelectorAll('[data-testid="tab-column"], [data-testid="tab-removal"]')) {
      if (piece.getAttribute("data-barline") === "true") {
        bar += 1;
        continue;
      }
      if (piece.getAttribute("data-testid") === "tab-removal") {
        const text = piece.textContent ?? "";
        counts.removed += Number(/−(\d+)/.exec(text)?.[1] ?? 0);
        bars.push(bar);
        continue;
      }
      const diff = piece.getAttribute("data-diff");
      if (diff === "changed" || diff === "added") {
        counts[diff] += 1;
        bars.push(bar);
      }
    }
    const line = staff.parentElement!.querySelector('[data-testid="variant-line"]')?.textContent ?? null;
    return { counts, bars: [...new Set(bars)], line };
  }, index);
/** staffReport reads once, so wait for the song's content first: the staves can draw before the line does. */
const lineShown = (page: Page, index: number) =>
  expect(page.getByTestId("tab-staff").nth(index).locator("..").getByTestId("variant-line")).toBeVisible();

/** The line's numbers, read as a person would. */
const says = (line: string | null) => ({
  changed: Number(/(\d+) changed/.exec(line ?? "")?.[1] ?? 0),
  added: Number(/(\d+) added/.exec(line ?? "")?.[1] ?? 0),
  removed: Number(/(\d+) removed/.exec(line ?? "")?.[1] ?? 0),
});
const barsSaid = (line: string | null) => {
  const words = /in bars? ([^:]+):/.exec(line ?? "")?.[1] ?? "";
  return words
    .split(/,|and/)
    .flatMap((w) => {
      const span = /(\d+)\D+(\d+)/.exec(w);
      if (span) return Array.from({ length: Number(span[2]) - Number(span[1]) + 1 }, (_, i) => Number(span[1]) + i);
      const one = /\d+/.exec(w);
      return one ? [Number(one[0])] : [];
    })
    .sort((x, y) => x - y);
};

const marksOf = (page: Page) =>
  page.evaluate(() => ({
    diff: document.querySelectorAll('[data-diff]').length,
    removal: document.querySelectorAll('[data-testid="tab-removal"]').length,
    line: document.querySelectorAll('[data-testid="variant-line"]').length,
  }));

const NONE = { diff: 0, removal: 0, line: 0 };

test.describe("INV-026 only a live parent in this song", () => {
  for (const surface of ["song page", "play view"] as const) {
    const open = async (page: Page, playUrl: string) => {
      if (surface === "play view") await page.goto(playUrl);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await page.waitForTimeout(200);
    };
    const parts = (extra: Partial<PartSpec>): PartSpec[] => [
      { key: "a", label: "A", columns: A },
      { key: "v", label: "V", columns: [n(1), n(2)], ...extra },
    ];
    const entries = [{ part: "v" }];

    test(`none declared: ${surface}`, async ({ page }) => {
      const { playUrl } = await seedSong(page, parts({}), entries);
      await open(page, playUrl);
      expect(await marksOf(page)).toEqual(NONE);
    });
    test(`live, same song: ${surface}`, async ({ page }) => {
      const { playUrl } = await seedSong(page, parts({ variantOf: "a" }), entries);
      await open(page, playUrl);
      expect((await marksOf(page)).line).toBe(1);
    });
    test(`deleted: ${surface}`, async ({ page }) => {
      const { playUrl, parts: ids, songUrl } = await seedSong(page, parts({ variantOf: "a" }), entries);
      await idb(page, `await write("parts", (s) => { const r = s.get(arg); r.onsuccess = () => s.put({ ...r.result, deletedAt: 1 }); });`, ids.a);
      await page.goto(songUrl);
      await open(page, playUrl);
      expect(await marksOf(page)).toEqual(NONE);
    });
    test(`in another song: ${surface}`, async ({ page }) => {
      const { playUrl, parts: ids, songUrl } = await seedSong(page, parts({ variantOf: "a" }), entries);
      await idb(page, `await write("parts", (s) => { const r = s.get(arg); r.onsuccess = () => s.put({ ...r.result, songId: crypto.randomUUID() }); });`, ids.a);
      await page.goto(songUrl);
      await open(page, playUrl);
      expect(await marksOf(page)).toEqual(NONE);
    });
    test(`itself: ${surface}`, async ({ page }) => {
      const { playUrl, parts: ids, songUrl } = await seedSong(page, parts({}), entries);
      await idb(page, `await write("parts", (s) => { const r = s.get(arg); r.onsuccess = () => s.put({ ...r.result, variantOfPartId: arg }); });`, ids.v);
      await page.goto(songUrl);
      await open(page, playUrl);
      expect(await marksOf(page)).toEqual(NONE);
    });
    test(`an id with no row: ${surface}`, async ({ page }) => {
      const { playUrl, parts: ids, songUrl } = await seedSong(page, parts({}), entries);
      await idb(page, `await write("parts", (s) => { const r = s.get(arg); r.onsuccess = () => s.put({ ...r.result, variantOfPartId: crypto.randomUUID() }); });`, ids.v);
      await page.goto(songUrl);
      await open(page, playUrl);
      expect(await marksOf(page)).toEqual(NONE);
    });
    test(`a chain compares C with B only: ${surface}`, async ({ page }) => {
      const { playUrl } = await seedSong(
        page,
        [
          { key: "a", label: "A", columns: [n(1), n(2)] },
          { key: "b", label: "B", variantOf: "a", columns: [n(1), n(3)] },
          { key: "c", label: "C", variantOf: "b", columns: [n(1), n(3)] },
        ],
        [{ part: "c" }],
      );
      await open(page, playUrl);
      await expect(page.getByTestId("variant-line").last()).toHaveText("Same as B");
    });
  }

  test("last-pass substitutes on the play view", async ({ page }) => {
    const { playUrl } = await seedSong(
      page,
      [
        { key: "a", label: "A", columns: [n(1), n(2)] },
        { key: "same", label: "A'", variantOf: "a", columns: [n(1), n(3)] },
        { key: "plain", label: "P", columns: [n(4), n(5)] },
        { key: "b", label: "B", columns: [n(6), n(7)] },
        { key: "other", label: "B'", variantOf: "b", columns: [n(6), n(8)] },
      ],
      [
        { part: "a", repeat: 2, last: "same" },
        { part: "a", repeat: 2, last: "plain" },
        { part: "a", repeat: 2, last: "other" },
        { part: "same" },
      ],
    );
    await page.goto(playUrl);
    await expect(page.getByTestId("tab-staff").nth(6)).toBeVisible();
    await expect(page.getByTestId("variant-line")).toHaveCount(3);
    const lines = [];
    for (let i = 0; i < 7; i += 1) lines.push((await staffReport(page, i)).line);
    expect(lines).toEqual([
      null,
      "Differs from A in bar 1: 1 changed",
      null,
      null,
      null,
      "Differs from B in bar 1: 1 changed",
      "Differs from A in bar 1: 1 changed",
    ]);
  });
});

const EACH: Col[] = [n(6, { chord: "Am" }), n(7), n(8), bar(), n(9), bar(), n(3), n(2)];
const CASES: Record<string, Col[]> = {
  "one of each op": EACH,
  "only additions": [...A, n(4), n(6)],
  "only removals": A.slice(0, 7),
  none: A,
};

test.describe("INV-027 the marks and the line count the same things", () => {
  for (const [name, columns] of Object.entries(CASES)) {
    test(`${name}, on every surface`, async ({ page }) => {
      const { playUrl } = await seedSong(
        page,
        [
          { key: "a", label: "A", columns: A },
          { key: "v", label: "A'", variantOf: "a", columns },
        ],
        [{ part: "v" }, { part: "v", fromBar: 1, toBar: 1 }, { part: "v", fromBar: 2, toBar: 3 }],
      );
      const check = async (where: string, index: number) => {
        const seen = await staffReport(page, index);
        expect(seen.line, where).not.toBeNull();
        expect(seen.counts, `${where}: ${seen.line}`).toEqual(says(seen.line));
        expect(seen.bars.sort((x, y) => x - y), `${where}: ${seen.line}`).toEqual(barsSaid(seen.line));
      };
      await lineShown(page, 1);
      await check("expanded", 1);
      const expanded = await staffReport(page, 1);
      await page.getByRole("button", { name: "compact", exact: true }).click();
      await lineShown(page, 1);
      await check("compact", 1);
      expect((await staffReport(page, 1)).line).toBe(expanded.line);
      await page.goto(playUrl);
      await expect(page.getByTestId("tab-staff").nth(2)).toBeVisible();
      await lineShown(page, 0);
      expect((await staffReport(page, 0)).line).toBe(expanded.line);
      await check("play whole", 0);
      // A slice keeps the part's own bar numbers in its words, so only the counts compare.
      for (const index of [1, 2]) {
        const seen = await staffReport(page, index);
        expect(seen.counts, `slice ${index}: ${seen.line}`).toEqual(says(seen.line));
      }
    });
  }
});

test("INV-030 passes, parents and text entries draw nothing but the pass that plays the variant", async ({ page }) => {
  const { songUrl, playUrl } = await seedSong(
    page,
    [
      { key: "a", label: "A", columns: A },
      { key: "v", label: "A'", variantOf: "a", columns: EACH },
      { key: "p", label: "P", columns: [n(1)] },
    ],
    [{ part: "a", repeat: 4, last: "v" }, { kind: "text", label: "Breakdown" }, { part: "p" }, { part: "a", repeat: 2, last: "p" }],
  );
  const onSongPage = await staffReport(page, 1);
  expect(onSongPage.line).toContain("Differs");
  await expect(page.locator('[id^="part-"]').first().locator("[data-diff], [data-testid='tab-removal'], [data-testid='variant-line']")).toHaveCount(0);
  expect(songUrl).toBeTruthy();
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-staff").nth(6)).toBeVisible();
  const lines: (string | null)[] = [];
  for (let i = 0; i < 7; i += 1) lines.push((await staffReport(page, i)).line);
  expect(lines).toEqual([null, null, null, onSongPage.line, null, null, null]);
  expect(await staffReport(page, 3)).toEqual(onSongPage);
  for (const i of [0, 1, 2, 4, 5, 6]) {
    expect((await staffReport(page, i)).counts).toEqual({ changed: 0, added: 0, removed: 0 });
  }
});

test.describe("INV-031 a write reaches the marks with the page open", () => {
  const seed = (page: Page) =>
    seedSong(
      page,
      [
        { key: "a", label: "A", columns: [n(5), n(7)] },
        { key: "v", label: "A'", variantOf: "a", columns: [n(5), n(7)] },
      ],
      [{ part: "a" }, { part: "v" }],
    );
  const line = (page: Page) => page.getByTestId("variant-line");

  for (const surface of ["song page", "play view"] as const) {
    for (const who of ["a", "v"] as const) {
      test(`a column from another tab, then one deleted, on ${who}: ${surface}`, async ({ page, context }) => {
        const { songUrl, playUrl, parts, songId } = await seed(page);
        if (surface === "play view") await page.goto(playUrl);
        await expect(line(page)).toHaveText("Same as A");
        const other = await context.newPage();
        await other.goto(`/songs/${songId}/capture/${parts[who]}`);
        await expect(other.getByTestId("tab-column")).toHaveCount(2);
        await fret(other, "E", 3).click();
        await expect(other.getByTestId("tab-column")).toHaveCount(3);
        await expect(line(page)).toHaveText(`Differs from A in bar 1: 1 ${who === "a" ? "removed" : "added"}`);
        await deleteButton(other).click();
        await expect(other.getByTestId("tab-column")).toHaveCount(2);
        await expect(line(page)).toHaveText("Same as A");
        await other.close();
        expect(songUrl).toBeTruthy();
      });
    }

    test(`a chord on either part, by a write landing: ${surface}`, async ({ page }) => {
      const { playUrl, parts, events } = await seed(page);
      if (surface === "play view") await page.goto(playUrl);
      await expect(line(page)).toHaveText("Same as A");
      const put = (part: string, anchor: string) =>
        idb(
          page,
          `const [template] = await all("parts");
           await write("annotations", (s) => s.put({
             id: crypto.randomUUID(), bandId: template.bandId, partId: arg.part, anchorEventId: arg.anchor, kind: "chord", value: "Am",
             updatedAt: template.updatedAt, deletedAt: null, fieldClocks: {}, serverSeq: template.serverSeq,
           }));`,
          { part, anchor },
        );
      await put(parts.v, events.v[0]);
      await landed(page);
      await expect(line(page)).toHaveText("Differs from A in bar 1: 1 changed");
      await put(parts.a, events.a[0]);
      await landed(page);
      await expect(line(page)).toHaveText("Same as A");
    });
  }

  test("deleting the parent from this tab clears line and marks", async ({ page }) => {
    await seed(page);
    await expect(line(page)).toHaveText("Same as A");
    await partAction(page, "A", "Delete");
    await expect(line(page)).toHaveCount(0);
    expect(await marksOf(page)).toEqual(NONE);
  });
});

const BRACKETED: Col[] = [n(5, { chord: "Am", d: "q" }), g("t", 7, { d: "8" }), g("t", 8, { d: "8" }), g("t", 9, { d: "8" }), bar(), n(3)];
const MARKED: Col[] = [n(6, { chord: "Am", d: "q" }), g("t", 7, { d: "8" }), g("t", 10, { d: "8" }), g("t", 9, { d: "8" }), bar(), n(3), n(4)];

for (const theme of ["dark", "light"] as const) {
  test(`INV-032 each mark and line, by text, weight and contrast on its real surface: ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    const { playUrl } = await seedSong(
      page,
      [
        { key: "a", label: "A", columns: BRACKETED },
        { key: "v", label: "A'", variantOf: "a", columns: MARKED },
        { key: "w", label: "A''", variantOf: "a", columns: BRACKETED.slice(0, 4) },
      ],
      [{ part: "v" }, { part: "w" }],
    );
    for (const url of [null, playUrl]) {
      if (url) await page.goto(url);
      await expect(page.getByTestId("variant-line").first()).toBeVisible();
      const seen = await page.evaluate(() => {
        const opaque = (el: Element) => {
          for (let node: Element | null = el; node; node = node.parentElement) {
            if (Number(getComputedStyle(node).opacity) < 1) return false;
          }
          return true;
        };
        const ground = (el: Element) => {
          for (let node: Element | null = el; node; node = node.parentElement) {
            const c = getComputedStyle(node).backgroundColor;
            if (c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
          }
          return getComputedStyle(document.documentElement).backgroundColor;
        };
        const read = (el: Element) => ({
          text: el.textContent ?? "",
          color: getComputedStyle(el).color,
          ground: ground(el),
          opaque: opaque(el),
        });
        const marked = document.querySelector('[data-diff="changed"] .tab-cell span');
        const plain = document.querySelector('[data-testid="tab-staff"] [data-testid="tab-column"]:not([data-diff]) .tab-cell span');
        return {
          marks: [...document.querySelectorAll('[data-testid="tab-diff"]')].filter((m) => m.textContent).map(read),
          gaps: [...document.querySelectorAll('[data-testid="tab-removal"] .tab-diff-mark')].map(read),
          lines: [...document.querySelectorAll('[data-testid="variant-line"]')].map(read),
          cells: [...document.querySelectorAll('[data-diff] .tab-cell span')].map(read),
          weights: { marked: Number(getComputedStyle(marked!).fontWeight), plain: Number(getComputedStyle(plain!).fontWeight) },
        };
      });
      expect(new Set(seen.marks.map((m) => m.text))).toEqual(new Set(["*", "+"]));
      expect(seen.gaps.length).toBeGreaterThan(0);
      expect(seen.gaps.every((m) => /^−\d+$/.test(m.text))).toBe(true);
      expect(seen.weights.marked).toBeGreaterThan(seen.weights.plain);
      for (const item of [...seen.marks, ...seen.gaps, ...seen.lines, ...seen.cells]) {
        expect(item.opaque, item.text).toBe(true);
        expect(contrast(item.color, item.ground), `${theme} ${item.text} ${item.color} on ${item.ground}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
}

test("INV-033 nothing in the marks is interactive, on every surface and in every view", async ({ page }) => {
  const { playUrl } = await seedSong(
    page,
    [
      { key: "a", label: "A", columns: A },
      { key: "v", label: "A'", variantOf: "a", columns: EACH },
    ],
    [{ part: "v" }, { part: "v", fromBar: 1, toBar: 2 }],
  );
  const sweep = async () => {
    for (const view of VIEWS) {
      await choose(page, view);
      const report = await page.evaluate(() => {
        const inner = "a, button, input, select, textarea, [tabindex], [role=button], [role=link], [contenteditable]";
        const marks = [...document.querySelectorAll('[data-testid="tab-diff"], [data-testid="tab-removal"], [data-testid="variant-line"]')];
        return {
          count: marks.length,
          interactive: marks.filter((m) => m.matches(inner) || m.querySelector(inner)).length,
          columns: [...document.querySelectorAll("[data-diff]")].filter((c) => c.getAttribute("role") !== "img").length,
        };
      });
      expect(report.count).toBeGreaterThan(0);
      expect(report.interactive).toBe(0);
      expect(report.columns).toBe(0);
    }
    const before = await dump(page);
    const url = page.url();
    for (const selector of ['[data-testid="variant-line"]', '[data-testid="tab-removal"]', '[data-diff="changed"]']) {
      await page.locator(selector).first().click({ force: true });
    }
    expect(page.url()).toBe(url);
    expect(JSON.parse(await dump(page))).toEqual(JSON.parse(before));
  };
  await sweep();
  await page.getByRole("button", { name: "compact", exact: true }).click();
  await sweep();
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-staff").nth(1)).toBeVisible();
  await sweep();
});

test("INV-015 a just-made variant says only Same as A, in each labelling view", async ({ page }) => {
  for (const view of ["notes", "intervals"] as const) {
    await seedSong(page, [{ key: "a", label: "A", columns: A }], [{ part: "a" }]);
    await choose(page, view);
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as unknown as { __seen: string[] }).__seen = seen;
      new MutationObserver(() => {
        for (const el of document.querySelectorAll('[data-testid="variant-line"], [data-diff], [data-testid="tab-removal"]')) {
          seen.push(el.getAttribute("data-testid") === "variant-line" ? (el.textContent ?? "") : `mark ${el.textContent}`);
        }
      }).observe(document.body, { childList: true, subtree: true, characterData: true });
    });
    await partAction(page, "A", "+ variant");
    await expect(page.getByTestId("variant-line")).toHaveText("Same as A");
    const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
    expect(new Set(seen)).toEqual(new Set(["Same as A"]));
    await page.evaluate(() => indexedDB.deleteDatabase("stablature"));
    await page.context().clearCookies();
  }
});
