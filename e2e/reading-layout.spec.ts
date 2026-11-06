import { openCluster, openTools } from "./usability-helpers";
/**
 * INV-016/INV-017: a view change moves nothing. Every item sits within 1px of its column, the staff and
 * card keep their heights, and the caption sits inside the card without touching the staff.
 * Rows: two-digit frets, a chord. Over views x {375x667, desktop} x 2 themes.
 */
import { expect, test, type Page } from "@playwright/test";
import { addChord, fret, startCapturing } from "./capture-surface-helpers";
import { bar, choose, contrast, g, n, seedSong, VIEWS, view, type Col, type PartSpec } from "./reading-helpers";
// The review probes ran with a 120 s test timeout; the sweeps need it.test.setTimeout(120_000);

const SIZES = [
  { name: "phone", width: 375, height: 667 },
  { name: "desktop", width: 1280, height: 800 },
];

async function seed(page: Page) {
  const { songUrl } = await startCapturing(page);
  await fret(page, "E", 12).click();
  await fret(page, "A", 5).click();
  await addChord(page, 0, "Am");
  await page.goto(songUrl);
  await openTools(page);
  await expect(page.getByTestId("tab-column").first()).toBeVisible();
}

const measure = (page: Page) =>
  page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    const card = staff.parentElement!;
    const caption = card.querySelector('[data-testid="staff-caption"]')?.getBoundingClientRect() ?? null;
    const staffBox = staff.getBoundingClientRect();
    const columns = [...staff.querySelectorAll('[data-testid="tab-column"]')].map((column) => {
      const box = column.getBoundingClientRect();
      const cells = [...column.querySelectorAll(".tab-cell")].map((c) => c.getBoundingClientRect());
      return { left: box.left, right: box.right, cells: cells.map((c) => ({ left: c.left, right: c.right })) };
    });
    const chordLabels = [...staff.querySelectorAll('[data-testid="tab-column"] .truncate')].map((el) => ({
      clipped: el.scrollWidth > el.clientWidth,
    }));
    return {
      staffHeight: staffBox.height,
      cardHeight: card.getBoundingClientRect().height,
      captionBox: caption && { top: caption.top, bottom: caption.bottom, left: caption.left, right: caption.right },
      staffBottom: staffBox.bottom,
      cardBox: card.getBoundingClientRect().toJSON(),
      columns,
      chordLabels,
    };
  });

for (const size of SIZES) {
  for (const theme of ["dark", "light"]) {
    test(`views change nothing but the cell text: ${size.name}, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: theme as "dark" | "light" });
      await seed(page);

      const seen: Record<string, Awaited<ReturnType<typeof measure>>> = {};
      for (const v of VIEWS) {
        await view(page, v).click();
        await expect(view(page, v)).toHaveAttribute("aria-pressed", "true");
        seen[v] = await measure(page);
        for (const column of seen[v].columns) {
          for (const cell of column.cells) {
            expect(cell.left).toBeGreaterThanOrEqual(column.left - 1);
            expect(cell.right).toBeLessThanOrEqual(column.right + 1);
          }
        }
        expect(seen[v].chordLabels.every((l) => !l.clipped)).toBe(true);
        if (seen[v].captionBox) {
          const box = seen[v].captionBox!;
          expect(box.top).toBeGreaterThanOrEqual(seen[v].staffBottom - 1);
          expect(box.bottom).toBeLessThanOrEqual(seen[v].cardBox.bottom + 1);
          expect(box.right).toBeLessThanOrEqual(seen[v].cardBox.right + 1);
        }
      }
      for (const v of ["notes", "intervals"] as const) {
        expect(Math.abs(seen[v].staffHeight - seen.frets.staffHeight)).toBeLessThanOrEqual(1);
        expect(Math.abs(seen[v].cardHeight - seen.frets.cardHeight)).toBeLessThanOrEqual(1);
      }
    });
  }
}

test("INV-036 the group's line runs on across a removal inside it", async ({ page }) => {
  await seedSong(
    page,
    [
      { key: "a", label: "A", columns: [g("t", 5), g("t", 7), g("t", 9)] },
      { key: "v", label: "A'", variantOf: "a", columns: [g("t", 5), g("t", 9)] },
    ],
    [{ part: "a" }],
  );
  await expect(page.getByTestId("tab-removal")).toHaveCount(1);
  const seen = await page.evaluate(() => {
    const staff = document.querySelectorAll('[data-testid="tab-staff"]')[1];
    const gap = staff.querySelector('[data-testid="tab-removal"]')!.getBoundingClientRect();
    const lines = [...staff.querySelectorAll('[data-testid="tab-bracket"], .tab-bracket')].map((l) => l.getBoundingClientRect());
    const covered = lines.some((l) => l.left <= gap.left + 1 && l.right >= gap.right - 1);
    const before = lines.filter((l) => l.right <= gap.left + 1).length;
    const after = lines.filter((l) => l.left >= gap.right - 1).length;
    return { covered, before, after };
  });
  expect(seen.before).toBeGreaterThan(0);
  expect(seen.after).toBeGreaterThan(0);
  expect(seen.covered).toBe(true);
});

const AM = "Am";
/** Two-digit frets, the widest cell, a chord, a counted group, a connector, rhythm, a repeat. */
const RICH: Col[] = [
  n(12, { chord: AM, d: "q" }),
  g("t", 5, { d: "8" }),
  g("t", 7, { d: "8", techniques: { 2: ["hammer_on"] } }),
  g("t", 9, { d: "8" }),
  bar(),
  n(3, { repeat: 3 }),
  n(5, { chord: "C7#9", techniques: { 2: ["tap", "let_ring", "bend", "vibrato", "palm_mute"] } }),
  bar(),
  n(7, { chord: "N.C." }),
  n(2),
];
/** One of each mark: a change, an addition, a removal inside the group, and one at the end. */
const VARIANT: Col[] = [
  n(13, { chord: AM, d: "q" }),
  g("t", 5, { d: "8" }),
  g("t", 9, { d: "8" }),
  bar(),
  n(3, { repeat: 3 }),
  n(8),
  n(5, { chord: "C7#9", techniques: { 2: ["tap", "let_ring", "bend", "vibrato", "palm_mute"] } }),
  bar(),
  n(7, { chord: "N.C." }),
];
const SONG: PartSpec[] = [
  { key: "a", label: "A", name: "The riff with a name long enough to wrap a phone's card header onto a second row", columns: RICH },
  { key: "v", label: "A'", variantOf: "a", columns: VARIANT },
];

/** Every row of the staff against its column, in page coordinates. */
const measureRows = (page: Page, index: number) =>
  page.evaluate((i) => {
    const staff = document.querySelectorAll('[data-testid="tab-staff"]')[i];
    const box = (el: Element) => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height, width: r.width };
    };
    const off: string[] = [];
    const within = (name: string, el: Element, column: Element, tolerance = 1) => {
      const a = box(el);
      const c = box(column);
      if (a.left < c.left - tolerance || a.right > c.right + tolerance) off.push(`${name}: ${a.left}-${a.right} in ${c.left}-${c.right}`);
    };
    const parts = [...staff.querySelectorAll('[data-testid="tab-column"], [data-testid="tab-connector"], [data-testid="tab-removal"]')];
    for (let p = 1; p < parts.length; p += 1) {
      // A wrapped staff starts a new line: only parts side by side on one line must touch.
      const here = box(parts[p]);
      const before = box(parts[p - 1]);
      if (here.top >= before.bottom - 1) continue;
      if (Math.abs(here.left - before.right) > 1) off.push(`gap between ${p - 1} and ${p}`);
    }
    const rowsAt: Record<string, number[]> = {};
    const note = (name: string, value: number) => (rowsAt[name] ??= []).push(value);
    for (const column of staff.querySelectorAll('[data-testid="tab-column"]')) {
      for (const cell of column.querySelectorAll(".tab-cell")) within("cell", cell, column);
      column.querySelectorAll(".tab-cell").forEach((cell, s) => note(`string ${s}`, box(cell).top));
      for (const b of column.querySelectorAll('[data-testid="tab-bracket"]')) within("bracket", b, column);
      for (const l of column.querySelectorAll(".tab-bracket-label")) within("bracket label", l, column);
      for (const r of column.querySelectorAll('[data-testid="tab-rhythm"]')) {
        within("rhythm", r, column);
        note("rhythm", box(r).top);
      }
      for (const m of column.querySelectorAll('[data-testid="tab-diff"]')) {
        within("mark", m, column);
        note("mark", box(m).top);
      }
      const chord = column.querySelector(".truncate");
      if (chord) {
        within("chord", chord, column);
        note("chord", box(chord).top);
      }
    }
    for (const gap of staff.querySelectorAll('[data-testid="tab-removal"]')) {
      gap.querySelectorAll(".tab-cell").forEach((cell, s) => note(`string ${s}`, box(cell).top));
      const mark = gap.querySelector(".tab-diff-mark");
      if (mark) {
        note("mark", box(mark).top);
        const range = document.createRange();
        range.selectNodeContents(mark);
        const text = range.getBoundingClientRect();
        const g2 = box(gap);
        if (text.left < g2.left - 1 || text.right > g2.right + 1) off.push(`gap text ${text.left}-${text.right} in ${g2.left}-${g2.right}`);
      }
    }
    for (const [name, tops] of Object.entries(rowsAt)) {
      // Level on each line of a wrapped staff: a jump of a few px is the next line, not a drift.
      const sorted = [...tops].sort((a, b) => a - b);
      let start = sorted[0];
      for (let t = 1; t <= sorted.length; t += 1) {
        if (t === sorted.length || sorted[t] - sorted[t - 1] > 8) {
          if (sorted[t - 1] - start > 1) off.push(`${name} row not level: ${start}-${sorted[t - 1]}`);
          start = sorted[t];
        }
      }
    }
    return { off, staff: box(staff), columns: staff.querySelectorAll('[data-testid="tab-column"]').length };
  }, index);

/** The staff's own card, and what shares its bottom edge. */
const card = (page: Page, index: number) =>
  page.evaluate((i) => {
    const staff = document.querySelectorAll('[data-testid="tab-staff"]')[i];
    const box = (el: Element | null | undefined) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height };
    };
    const owner = staff.parentElement!;
    return {
      card: box(owner)!,
      staff: box(staff)!,
      caption: box(staff.querySelector('[data-testid="staff-caption"]')),
      text: staff.querySelector('[data-testid="staff-caption"]')?.textContent ?? null,
      line: box(owner.querySelector('[data-testid="variant-line"]')),
    };
  }, index);

const overlap = (a: { top: number; bottom: number }, b: { top: number; bottom: number }) =>
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

for (const size of SIZES) {
  for (const theme of ["dark", "light"] as const) {
    test(`INV-016 every row on its column, song page and play view: ${size.name}, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: theme });
      const { playUrl } = await seedSong(page, SONG, [{ part: "a" }, { part: "v" }, { part: "v", fromBar: 2, toBar: 3 }]);
      for (const density of ["expanded", "compact"] as const) {
        await page.getByRole("button", { name: density, exact: true }).click();
        for (const view of VIEWS) {
          await choose(page, view);
          for (const index of [0, 1]) {
            const seen = await measureRows(page, index);
            expect(seen.off, `song page ${density} ${view} staff ${index}`).toEqual([]);
          }
        }
      }
      await page.goto(playUrl);
      await openCluster(page);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      for (const view of VIEWS) {
        await choose(page, view);
        for (const index of [0, 1, 2]) {
          const seen = await measureRows(page, index);
          expect(seen.off, `play view ${view} pass ${index}`).toEqual([]);
        }
      }
    });

    test(`INV-017 height holds, and the caption overlaps nothing, on every surface: ${size.name}, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: theme });
      const { playUrl } = await seedSong(page, SONG, [{ part: "a" }, { part: "v" }, { part: "v", fromBar: 1, toBar: 2 }]);
      const problems: string[] = [];
      const sweep = async (surface: string, indexes: number[]) => {
        // PROBE_CANDIDATE tries a remediation in the browser before it is recommended.
        if (process.env.PROBE_CANDIDATE) await page.addStyleTag({ content: process.env.PROBE_CANDIDATE });
        const heights = new Map<string, number>();
        for (const view of VIEWS) {
          await choose(page, view);
          for (const index of indexes) {
            const seen = await card(page, index);
            const key = `${surface}#${index}`;
            const previous = heights.get(key);
            if (previous === undefined) heights.set(key, seen.card.height);
            // A wrapped staff re-flows when a view widens its cells, so only the song page holds height.
            else if (surface !== "play" && Math.abs(previous - seen.card.height) > 1) problems.push(`${key} ${view}: card ${seen.card.height}, was ${previous}`);
            if (view === "frets") {
              if (seen.caption) problems.push(`${key}: a caption in frets`);
              continue;
            }
            if (!seen.caption) {
              problems.push(`${key} ${view}: no caption`);
              continue;
            }
            const staffOverlap = overlap(seen.caption, seen.staff);
            if (staffOverlap > 1) problems.push(`${key} ${view}: caption over the staff by ${staffOverlap.toFixed(1)}px`);
            if (seen.line) {
              const lineOverlap = overlap(seen.caption, seen.line);
              if (lineOverlap > 1) problems.push(`${key} ${view}: caption over the line by ${lineOverlap.toFixed(1)}px`);
            }
            if (seen.caption.bottom > seen.card.bottom + 1 || seen.caption.right > seen.card.right + 1) problems.push(`${key} ${view}: caption outside the card`);
          }
        }
      };
      await sweep("song expanded", [0, 1]);
      await page.getByRole("button", { name: "compact", exact: true }).click();
      await sweep("song compact", [0, 1]);
      await page.goto(playUrl);
      await openCluster(page);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await sweep("play", [0, 1, 2]);
      expect(problems).toEqual([]);
    });
  }
}

test("INV-017 each caption text, from what the cells could read", async ({ page }) => {
  await seedSong(page, [
    { key: "all", label: "A", columns: [n(5, { chord: AM }), n(7)] },
    { key: "some", label: "B", columns: [n(5), n(7, { chord: AM })] },
    { key: "none", label: "C", columns: [n(5), n(7)] },
    { key: "nothing", label: "D", columns: [{ kind: "rest" }, bar(), { kind: "rest" }] },
  ], [{ part: "all" }]);
  await choose(page, "intervals");
  const captions = await page.getByTestId("staff-caption").allTextContents();
  expect(captions).toEqual([
    "Intervals from the chord in force",
    "Intervals, and note names where no chord",
    "Note names: no chords to read against",
    "Intervals",
  ]);
  await choose(page, "notes");
  expect(new Set(await page.getByTestId("staff-caption").allTextContents())).toEqual(new Set(["Note names"]));
});

const carried = (page: Page, index: number) =>
  page.evaluate((i) => {
    const staff = document.querySelectorAll('[data-testid="tab-staff"]')[i];
    const label = [...staff.querySelectorAll(".text-accent")].find((el) => /^\(.*\)$/.test(el.textContent ?? "")) as HTMLElement | undefined;
    if (!label) return null;
    const columns = [...staff.querySelectorAll('[data-testid="tab-column"]')];
    return {
      text: label.textContent,
      clipped: label.scrollWidth > label.clientWidth,
      onFirstNote: columns.findIndex((c) => c.contains(label)),
      firstNote: columns.findIndex((c) => c.getAttribute("data-barline") !== "true"),
    };
  }, index);

test("INV-014 the carried chord, whole and in its place, in intervals only", async ({ page }) => {
  const columns: Col[] = [n(5, { chord: AM }), bar(), n(7), bar(), n(9), bar(), n(2, { chord: "Cmaj7#11" }), n(3), bar(), n(4, { chord: "N.C." }), bar(), n(5)];
  const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns }], [
    { part: "a", fromBar: 3, toBar: 3 }, // under Am
    { part: "a", fromBar: 1, toBar: 1 }, // on the anchor
    { part: "a", fromBar: 4, toBar: 4 }, // holds its own chord
    { part: "a", fromBar: 6, toBar: 6 }, // under N.C.
  ]);
  await page.goto(playUrl);
  await openCluster(page);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible();
  await choose(page, "intervals");
  const under = await carried(page, 0);
  expect(under).toMatchObject({ text: "(Am)", clipped: false });
  expect(under!.onFirstNote).toBe(under!.firstNote);
  expect(await carried(page, 1)).toBeNull();
  expect(await carried(page, 2)).toBeNull();
  expect(await carried(page, 3)).toMatchObject({ text: "(N.C.)", clipped: false });
  for (const view of ["frets", "notes"] as const) {
    await choose(page, view);
    for (const index of [0, 1, 2, 3]) expect(await carried(page, index), `${view} ${index}`).toBeNull();
  }
});

test("INV-014 a long chord whole, and nothing before any chord or under a blank one", async ({ page }) => {
  const columns: Col[] = [n(5), bar(), n(7, { chord: "Cmaj7#11" }), bar(), n(9), bar(), n(2, { chord: "   " }), bar(), n(3)];
  const { playUrl } = await seedSong(page, [{ key: "a", label: "A", columns }], [
    { part: "a", fromBar: 1, toBar: 1 }, // before any chord
    { part: "a", fromBar: 3, toBar: 3 }, // under the long chord
    { part: "a", fromBar: 5, toBar: 5 }, // under a blank chord
  ]);
  await page.goto(playUrl);
  await openCluster(page);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible();
  await choose(page, "intervals");
  expect(await carried(page, 0)).toBeNull();
  const long = await carried(page, 1);
  expect(long).toMatchObject({ text: "(Cmaj7#11)", clipped: false });
  expect(await carried(page, 2)).toBeNull();
});

/** Each column's left and width from its staff's own left edge, gaps taken out, and the cells' height. */
const geometry = (page: Page, index: number) =>
  page.evaluate((i) => {
    const staff = document.querySelectorAll('[data-testid="tab-staff"]')[i];
    const left = staff.querySelector('[data-testid="tab-column"]')!.getBoundingClientRect().left;
    let gaps = 0;
    const columns: { x: number; width: number; top: number }[] = [];
    for (const piece of staff.querySelectorAll('[data-testid="tab-column"], [data-testid="tab-removal"]')) {
      const r = piece.getBoundingClientRect();
      if (piece.getAttribute("data-testid") === "tab-removal") {
        gaps += r.width;
        continue;
      }
      const cell = piece.querySelector(".tab-cell")!.getBoundingClientRect();
      columns.push({ x: Math.round(r.left - left - gaps), width: Math.round(r.width), top: Math.round(cell.top - staff.getBoundingClientRect().top) });
    }
    return { columns, height: Math.round(staff.getBoundingClientRect().height), html: staff.innerHTML };
  }, index);

const SHARED: Col[] = [
  n(5, { chord: AM, d: "q" }),
  g("t", 5, { d: "8" }),
  g("t", 7, { d: "8", techniques: { 2: ["hammer_on"] } }),
  g("t", 9, { d: "8" }),
  bar(),
  n(3),
];
const CHANGED: Col[] = [n(6, { chord: AM, d: "q" }), ...SHARED.slice(1), n(4)];
const REMOVED: Col[] = [SHARED[0], SHARED[1], SHARED[3], SHARED[4]];

for (const density of ["expanded", "compact"] as const) {
  for (const view of VIEWS) {
    test(`INV-036 a mark moves no column and adds no row to a clean staff: ${density}, ${view}`, async ({ page }) => {
      await seedSong(
        page,
        [
          { key: "a", label: "A", columns: SHARED },
          { key: "plain", label: "P", columns: SHARED },
          { key: "same", label: "A1", variantOf: "a", columns: SHARED },
          { key: "marked", label: "A2", variantOf: "a", columns: CHANGED },
          { key: "cut", label: "A3", variantOf: "a", columns: REMOVED },
          { key: "cutPlain", label: "P3", columns: REMOVED },
          { key: "markedPlain", label: "P2", columns: CHANGED },
        ],
        [{ part: "a" }],
      );
      await page.getByRole("button", { name: density, exact: true }).click();
      await choose(page, view);
      const strip = (html: string) => html.replace(/ (?:id|data-column)="[^"]*"/g, "").replace(/(data-testid="tab-bar-number"[^>]*>)\d+/g, "$1");
      const [plain, same, marked, cut, cutPlain, markedPlain] = await Promise.all([1, 2, 3, 4, 5, 6].map((i) => geometry(page, i)));
      expect(strip(same.html)).toBe(strip(plain.html));
      expect(marked.columns.map(({ x, width, top }) => ({ x, width, top }))).toEqual(markedPlain.columns);
      expect(cut.columns).toEqual(cutPlain.columns);
    });
  }
}


test("INV-034 marks, lines and real captions survive print against white", async ({ page }) => {
  const { playUrl } = await seedSong(page, SONG, [{ part: "v" }]);
  await page.goto(playUrl);
  await openCluster(page);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible();
  await choose(page, "intervals");
  for (const scheme of ["dark", "light"] as const) {
    await page.emulateMedia({ media: "print", colorScheme: scheme });
    await expect(page.getByTestId("staff-view")).toBeHidden();
    const seen = await page.evaluate(() => {
      const read = (selector: string) =>
        [...document.querySelectorAll(selector)].map((el) => {
          const style = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return { color: style.color, visible: r.width > 0 && r.height > 0 && style.visibility !== "hidden", text: el.textContent ?? "" };
        });
      return {
        marks: read('[data-testid="tab-diff"]').filter((m) => m.text !== ""),
        gaps: read('[data-testid="tab-removal"] .tab-diff-mark'),
        lines: read('[data-testid="variant-line"]'),
        captions: read('[data-testid="staff-caption"]'),
      };
    });
    expect(seen.marks.length).toBeGreaterThan(0);
    expect(seen.gaps.length).toBeGreaterThan(0);
    expect(seen.lines.length).toBeGreaterThan(0);
    expect(seen.captions.length).toBeGreaterThan(0);
    for (const item of [...seen.marks, ...seen.gaps, ...seen.lines, ...seen.captions]) {
      expect(item.visible, item.text).toBe(true);
      expect(contrast(item.color, "rgb(255,255,255)"), `${scheme} ${item.text}`).toBeGreaterThanOrEqual(4.5);
    }
  }
});


const WIDEST = { 2: ["tap", "let_ring", "bend", "vibrato", "palm_mute"] };
const chords = ["Am", "Db", "F#", "Cmaj7#11", "Ebm7b5"];
const columns: Col[] = chords.flatMap((chord) => [
  ...Array.from({ length: 12 }, (_, fret) => n(fret, { chord: fret === 0 ? chord : undefined, techniques: WIDEST })),
  ...Array.from({ length: 12 }, (_, fret) => n(fret + 12, { techniques: { 2: ["palm_mute"] } })),
  bar(),
]);

const family = (page: Page) => page.evaluate(() => getComputedStyle(document.querySelector(".tab-staff")!).fontFamily);

/** The fix the plan assumed had already happened. */
const asMeant = async (page: Page) => {
  await page.evaluate(() => {
    document.documentElement.className = [...document.body.classList].filter((c) => c.endsWith("_variable")).join(" ");
  });
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => family(page)).toContain("JetBrains");
};

const overruns = (page: Page) =>
  page.evaluate(() => {
    const out: string[] = [];
    for (const column of document.querySelectorAll('[data-testid="tab-column"]')) {
      const c = column.getBoundingClientRect();
      for (const span of column.querySelectorAll(".tab-cell span")) {
        const range = document.createRange();
        range.selectNodeContents(span);
        const r = range.getBoundingClientRect();
        const over = Math.max(c.left - r.left, r.right - c.right);
        if (over > 1) out.push(`${span.textContent} over by ${over.toFixed(1)}px`);
      }
    }
    return [...new Set(out)];
  });

for (const size of SIZES) {
  for (const face of ["as shipped", "as meant"] as const) {
    test(`INV-016 every cell's text inside its column: ${size.name}, ${face}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await seedSong(page, [{ key: "a", label: "A", columns }], [{ part: "a" }]);
      if (face === "as meant") await asMeant(page);
      const seen: string[] = [];
      for (const density of ["expanded", "compact"] as const) {
        await page.getByRole("button", { name: density, exact: true }).click();
        for (const view of VIEWS) {
          await choose(page, view);
          for (const over of await overruns(page)) seen.push(`${density} ${view}: ${over}`);
        }
      }
      expect(seen).toEqual([]);
    });
  }
}
