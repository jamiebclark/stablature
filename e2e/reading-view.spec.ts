import { expect, test, type Page } from "@playwright/test";
import { addNotes, selectColumns } from "./grouping-helpers";
import { emptySong, pasteTab } from "./import-helpers";
import { startCapturing } from "./capture-surface-helpers";
import { bar, choose, columnTexts, dump, dumpDatabase, idb, n, remember, seedReadable, seedSong, view, VIEWS, type EntrySpec, type PartSpec } from "./reading-helpers";
// The review probes ran with a 120 s test timeout; the sweeps need it.
test.setTimeout(120_000);

/** The three-way staff view: INV-003 to INV-007 (control, persistence, no flash, capture untouched). */

const NOTE = /^[A-G][#b]?$/;

test("the control starts on frets, shows the choice by more than colour, and the staff follows", async ({ page }) => {
  await seedReadable(page);
  await expect(view(page, "frets")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("staff-caption")).toHaveCount(0);
  expect(await columnTexts(page)).toEqual(["7", "5"]);

  await view(page, "notes").click();
  for (const v of VIEWS) {
    await expect(view(page, v)).toHaveAttribute("aria-pressed", String(v === "notes"));
  }
  const style = await view(page, "notes").evaluate((el) => {
    const s = getComputedStyle(el);
    return { line: s.textDecorationLine, weight: Number(s.fontWeight) };
  });
  expect(style.line).toContain("underline");
  expect(style.weight).toBeGreaterThanOrEqual(600);
  const other = await view(page, "frets").evaluate((el) => getComputedStyle(el).textDecorationLine);
  expect(other).not.toContain("underline");

  expect((await columnTexts(page)).every((t) => NOTE.test(t.trim()))).toBe(true);
  await expect(page.getByTestId("staff-caption")).toHaveText("Note names");
  await expect(page.getByTestId("export-note")).toHaveText("Exports use fret numbers");

  await view(page, "intervals").click();
  await expect(page.getByTestId("staff-caption")).toHaveText("Note names: no chords to read against");
  await view(page, "frets").click();
  expect(await columnTexts(page)).toEqual(["7", "5"]);
  await expect(page.getByTestId("export-note")).toHaveCount(0);
});

test("a remembered view is there on first paint, with no fret flash and no hydration error, and the play view shares it", async ({ page }) => {
  const { songUrl } = await seedReadable(page);
  await view(page, "notes").click();
  await expect(view(page, "notes")).toHaveAttribute("aria-pressed", "true");

  const problems: string[] = [];
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  page.on("pageerror", (e) => problems.push(String(e)));
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __seen: string[] }).__seen = seen;
    new MutationObserver(() => {
      document.querySelectorAll('[data-testid="tab-column"]').forEach((c) => seen.push((c.textContent ?? "").trim()));
    }).observe(document, { childList: true, subtree: true, characterData: true });
  });

  for (const url of [songUrl, `${songUrl}/play`, songUrl]) {
    await page.goto(url);
    await expect(view(page, "notes")).toHaveAttribute("aria-pressed", "true");
    const seen = await page.evaluate(() => (window as unknown as { __seen: string[] }).__seen);
    expect(seen.filter((t) => /\d/.test(t))).toEqual([]);
  }
  expect(problems.filter((p) => /hydrat/i.test(p))).toEqual([]);

  await page.reload();
  await expect(view(page, "notes")).toHaveAttribute("aria-pressed", "true");
});

test("capture stays in fret numbers whatever view is stored", async ({ page }) => {
  const { partUrl } = await seedReadable(page);
  await view(page, "notes").click();
  await page.goto(partUrl);
  await expect(page.getByTestId("tab-column").first()).toBeVisible();
  expect(await page.getByTestId("tab-column").allInnerTexts()).toEqual(["7", "5"]);
  await expect(page.getByTestId("staff-view")).toHaveCount(0);
  await expect(page.getByTestId("staff-caption")).toHaveCount(0);
});

test("changing the view writes nothing: no rows, no outbox, no requests", async ({ page }) => {
  await seedReadable(page);
  const requests: string[] = [];
  page.on("request", (r) => r.method() !== "GET" && requests.push(r.url()));
  const before = await dumpDatabase(page);
  const sent = requests.length;
  for (let i = 0; i < 100; i++) await view(page, VIEWS[i % 3]).click();
  expect(await dumpDatabase(page)).toBe(before);
  expect(requests.length).toBe(sent);
});

test("the control fits at 375 wide, hides in print, and is absent with nothing to read", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await seedReadable(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("staff-view")).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  // A song with no arrangement has no play-view staves to act on.
  const { songUrl } = await startCapturing(page, "Empty Band", "Nothing");
  await page.goto(`${songUrl}/play`);
  await expect(page.getByTestId("staff-view")).toHaveCount(0);
});

// A second tab (review F5).
const MARKED: PartSpec[] = [
  { key: "a", label: "A", columns: [n(5, { chord: "Am" }), n(7), bar(), n(9), n(10)] },
  { key: "v", label: "A'", variantOf: "a", columns: [n(6, { chord: "Am" }), n(7), n(8), bar(), n(9)] },
];
const ENTRIES = [{ part: "a" }, { part: "v" }];

test("INV-006 a second tab's change reaches the first, cleared storage too", async ({ page, context }) => {
  const { playUrl } = await seedSong(page, MARKED, ENTRIES);
  const second = await context.newPage();
  await second.goto(playUrl);
  await choose(second, "intervals");
  await expect(page.getByTestId("staff-view-intervals")).toHaveAttribute("aria-pressed", "true");
  await page.evaluate(() => localStorage.removeItem("stablature.staffView"));
  await expect(second.getByTestId("staff-view-frets")).toHaveAttribute("aria-pressed", "true");
  await choose(second, "notes");
  await expect(page.getByTestId("staff-view-notes")).toHaveAttribute("aria-pressed", "true");
  await second.evaluate(() => localStorage.clear());
  await expect(page.getByTestId("staff-view-frets")).toHaveAttribute("aria-pressed", "true");
});

test("INV-006 a tab with no control open comes back to what another tab chose", async ({ page, context }) => {
  const { songUrl, playUrl } = await seedSong(page, MARKED, ENTRIES);
  const second = await context.newPage();
  await second.goto(playUrl);
  await choose(page, "intervals");
  await page.getByRole("link", { name: "Band" }).click();
  await expect(page.getByTestId("staff-view")).toHaveCount(0);
  await expect(second.getByTestId("staff-view-intervals")).toHaveAttribute("aria-pressed", "true");
  await choose(second, "notes");
  await page.locator(`a[href$="${new URL(songUrl).pathname}"]`).first().click();
  await expect(page).toHaveURL(songUrl);
  await expect(page.getByTestId("staff-view-notes")).toHaveAttribute("aria-pressed", "true");
});

const cells = (page: Page) =>
  page.getByTestId("tab-column").evaluateAll((all) => all.map((c) => (c as HTMLElement).innerText.trim()));

test("INV-002 Copy text and Download read the same in every view, with a marked variant", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __copied: string[]; __saved: Blob[] };
    w.__copied = [];
    w.__saved = [];
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (text: string) => void w.__copied.push(text) },
      configurable: true,
    });
    const real = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      w.__saved.push(blob as Blob);
      return real(blob);
    };
  });
  await seedSong(page, MARKED, ENTRIES);
  await expect(page.getByTestId("tab-diff").first()).toBeVisible();
  for (const density of ["expanded", "compact"] as const) {
    await page.getByRole("button", { name: density, exact: true }).click();
    for (const view of VIEWS) {
      await choose(page, view);
      await page.getByRole("button", { name: /^(Copy text|Copied)$/ }).click();
      await page.getByRole("button", { name: "Download" }).click();
    }
    await expect.poll(() => page.evaluate(() => (window as unknown as { __saved: Blob[] }).__saved.length)).toBe(3);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.length)).toBe(3);
    const { copied, saved } = await page.evaluate(async () => {
      const w = window as unknown as { __copied: string[]; __saved: Blob[] };
      return { copied: w.__copied.splice(0), saved: await Promise.all(w.__saved.splice(0).map((b) => b.text())) };
    });
    expect(new Set([...copied, ...saved]).size, density).toBe(1);
    expect(copied[0]).toContain("|");
    expect(copied[0]).not.toMatch(/Same as|Differs from|−|Intervals|Note names|\*/);
  }
});

for (const surface of ["song page", "play view"] as const) {
  test(`INV-003 a hundred changes reach no table, queue or write: ${surface}`, async ({ page }) => {
    const { playUrl } = await seedSong(page, MARKED, ENTRIES);
    if (surface === "play view") await page.goto(playUrl);
    await expect(page.getByTestId("staff-view")).toBeVisible();
    await page.waitForTimeout(600);
    const before = await dump(page);
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") writes.push(`${r.method()} ${r.url()}`);
    });
    for (let i = 0; i < 100; i += 1) {
      await page.getByTestId(`staff-view-${VIEWS[(i + 1) % 3]}`).click();
      if (i === 50) {
        await page.reload();
        await expect(page.getByTestId("staff-view")).toBeVisible();
      }
    }
    await page.waitForTimeout(300);
    expect(JSON.parse(await dump(page))).toEqual(JSON.parse(before));
    expect(writes).toEqual([]);
  });
}

for (const view of ["notes", "intervals"] as const) {
  test(`INV-004 capture, a selection and the paste preview stay in frets: ${view}`, async ({ page }) => {
    const { songUrl, partUrl } = await startCapturing(page);
    await addNotes(page, 3);
    await page.evaluate((v) => localStorage.setItem("stablature.staffView", v), view);
    await page.goto(partUrl);
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    const plain = await cells(page);
    expect(plain.every((c) => /^\d+$/.test(c)), plain.join()).toBe(true);
    await expect(page.getByTestId("staff-view")).toHaveCount(0);
    await selectColumns(page, 0, 1);
    expect(await cells(page)).toEqual(plain);
    await expect(page.getByTestId("staff-caption")).toHaveCount(0);

    await emptySong(page, songUrl);
    const lines = ["G|-----|", "D|-----|", "A|-5-7-|", "E|-----|", "B|-----|"].join("\n");
    await pasteTab(page, lines);
    const preview = page.getByTestId("paste-tab").getByTestId("tab-column");
    await expect(preview.first()).toBeVisible();
    const read = () => preview.evaluateAll((all) => all.map((c) => (c as HTMLElement).innerText.trim()));
    const previewed = await read();
    expect(previewed.join(" ")).toMatch(/5.*7/);
    expect(previewed.join(" ")).not.toMatch(/[A-G]/);
    await pasteTab(page, "G|--nonsense--\nD|---\n");
    await expect(page.getByTestId("paste-refusals")).toBeVisible();
    await pasteTab(page, lines);
    await expect(preview.first()).toBeVisible();
    expect(await read()).toEqual(previewed);
    await expect(page.getByTestId("paste-tab").getByTestId("staff-caption")).toHaveCount(0);
  });
}

/** Records every column text from the first node on. */
const watch = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __texts: string[] };
    w.__texts = [];
    const read = () => {
      for (const column of document.querySelectorAll('[data-testid="tab-column"]')) {
        w.__texts.push((column as HTMLElement).textContent ?? "");
      }
    };
    new MutationObserver(read).observe(document, { subtree: true, childList: true, characterData: true });
  });
const seen = (page: Page) => page.evaluate(() => (window as unknown as { __texts: string[] }).__texts);
const forget = (page: Page) =>
  page.evaluate(() => void ((window as unknown as { __texts: string[] }).__texts.length = 0));
/**
 * A fret number on the screen. In notes no cell holds a digit. In intervals digits are degrees, and degrees fold
 * to 1 to 7, so the seeded frets 9 and 10 are the ones that can only be frets.
 */
const fretNumbers = (view: "notes" | "intervals", texts: string[]) =>
  texts.filter((t) => (view === "notes" ? /\d/.test(t.replace("Am", "")) && !/[A-G]/.test(t.replace("Am", "")) : /^(9|10)$/.test(t.trim())));

for (const [view, surface] of (["notes", "intervals"] as const).flatMap((v) => (["song page", "play view"] as const).map((s) => [v, s] as const))) {
  test(`INV-005 no fret number ever paints, by every way in: ${view}, ${surface}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error" && /hydrat|did not match/i.test(m.text())) errors.push(m.text());
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await watch(page);
    const { songUrl, playUrl } = await seedSong(page, MARKED, ENTRIES);
    await remember(page, view);
    const url = surface === "song page" ? songUrl : playUrl;
    const settle = async (how: string) => {
      await expect(page.getByTestId("tab-column").first()).toBeVisible();
      await expect(page.getByTestId(`staff-view-${view}`)).toHaveAttribute("aria-pressed", "true");
      const texts = await seen(page);
      expect(texts.length, how).toBeGreaterThan(0);
      expect(fretNumbers(view, texts), how).toEqual([]);
    };
    await page.goto(url);
    await settle("direct open");
    await page.reload();
    await settle("reload");

    // In app, from the band page, and on to the play view by its link.
    await page.goto(songUrl);
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    await page.getByRole("link", { name: "Band" }).click();
    await expect(page).not.toHaveURL(songUrl);
    await expect(page.getByTestId("tab-column")).toHaveCount(0);
    await forget(page);
    await page.locator(`a[href$="${new URL(songUrl).pathname}"]`).first().click();
    await expect(page).toHaveURL(songUrl);
    await settle("in-app link from the band page");
    if (surface === "play view") {
      await forget(page);
      await page.locator('a[href$="/play"]').first().click();
      await expect(page).toHaveURL(/\/play/);
      await settle("in-app link between the two");
    }
    expect(errors).toEqual([]);
  });
}

test("INV-005 offline after a visit, on both surfaces, in a remembered view", async ({ page, context }) => {
  await watch(page);
  const { songUrl, playUrl } = await seedSong(page, MARKED, ENTRIES);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 30_000 });
  await remember(page, "intervals");
  for (const url of [songUrl, playUrl]) {
    await page.goto(url);
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    const key = new URL(url).pathname;
    await expect
      .poll(
        () =>
          page.evaluate(
            async (k) => Boolean(await (await caches.open("stablature-pages-v1")).match(k, { ignoreVary: true })),
            key,
          ),
        { timeout: 30_000 },
      )
      .toBe(true);
  }
  await context.setOffline(true);
  for (const url of [songUrl, playUrl]) {
    await page.goto(url);
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    await expect(page.getByTestId("staff-view-intervals")).toHaveAttribute("aria-pressed", "true");
    const texts = await seen(page);
    expect(texts.length, url).toBeGreaterThan(0);
    expect(fretNumbers("intervals", texts), url).toEqual([]);
  }
  await context.setOffline(false);
});

const STORAGE: Record<string, () => void> = {
  "localStorage undefined": () => {
    Object.defineProperty(window, "localStorage", { value: undefined, configurable: true });
  },
  "getItem throws": () => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = function getItem(key: string) {
      if (key === "stablature.staffView") throw new DOMException("blocked", "SecurityError");
      return real.call(this, key);
    };
  },
  "setItem throws": () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === "stablature.staffView") throw new DOMException("full", "QuotaExceededError");
      real.call(this, key, value);
    };
  },
};

for (const [name, install] of Object.entries(STORAGE)) {
  test(`INV-006 ${name}: the control still works and nothing throws`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const { songUrl } = await seedSong(page, MARKED, ENTRIES);
    await page.addInitScript(install);
    await page.goto(songUrl);
    await expect(page.getByTestId("staff-view-frets")).toHaveAttribute("aria-pressed", "true");
    // The first line of a column is its chord, so read the cell.
    const firstCell = async () => (await cells(page))[0].split("\n").at(-1);
    await choose(page, "notes");
    expect(await firstCell()).toMatch(/^[A-G]/);
    await choose(page, "frets");
    expect(await firstCell()).toBe("5");
    expect(errors).toEqual([]);
  });
}

for (const stored of ["sideways", "", "null", "NOTES", '{"view":"notes"}']) {
  test(`INV-006 stored ${JSON.stringify(stored)} reads as frets`, async ({ page }) => {
    const { songUrl } = await seedSong(page, MARKED, ENTRIES);
    await remember(page, stored);
    await page.goto(songUrl);
    await expect(page.getByTestId("staff-view-frets")).toHaveAttribute("aria-pressed", "true");
  });
}

for (const theme of ["dark", "light"] as const) {
  for (const surface of ["song page", "play view"] as const) {
    test(`INV-007 the control at 375, ${surface}, ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.emulateMedia({ colorScheme: theme });
      const { playUrl } = await seedSong(page, MARKED, ENTRIES);
      if (surface === "play view") await page.goto(playUrl);
      const set = page.getByTestId("staff-view");
      await expect(set).toBeVisible();
      for (const view of VIEWS) {
        await choose(page, view);
        const report = await page.evaluate(() => {
          const row = document.querySelector('[data-testid="staff-view"]')!;
          const r = row.getBoundingClientRect();
          const buttons = [...row.querySelectorAll("button")].map((b) => {
            const s = getComputedStyle(b);
            return {
              on: b.getAttribute("aria-pressed") === "true",
              line: s.textDecorationLine,
              weight: Number(s.fontWeight),
              right: b.getBoundingClientRect().right,
            };
          });
          return { left: r.left, right: r.right, scroll: row.scrollWidth, client: row.clientWidth, buttons };
        });
        // Against the width set, not `innerWidth`: phone emulation grows the layout viewport to fit an overflow.
        expect(report.right).toBeLessThanOrEqual(375);
        expect(report.left).toBeGreaterThanOrEqual(0);
        expect(report.scroll).toBeLessThanOrEqual(report.client);
        expect(report.buttons.filter((b) => b.on)).toHaveLength(1);
        for (const b of report.buttons) {
          expect(b.right).toBeLessThanOrEqual(375);
          expect(b.on).toBe(b.line.includes("underline"));
          if (b.on) expect(b.weight).toBeGreaterThanOrEqual(600);
        }
        // What sits beside it: export, BPM, density and the note, at their widest.
        const beside = await page.evaluate(() =>
          [...document.querySelectorAll('main button, main a, main input, [data-testid="export-note"]')]
            .filter((el) => el.closest('[data-testid="tab-staff"]') === null)
            .map((el) => ({ what: el.textContent?.trim() || el.getAttribute("aria-label") || el.tagName, right: el.getBoundingClientRect().right }))
            .filter((el) => el.right > 375),
        );
        expect(beside, `${view}: past the width set`).toEqual([]);
      }
      await page.emulateMedia({ media: "print", colorScheme: theme });
      await expect(set).toBeHidden();
    });
  }
}

test("INV-007 no control on a song with no tuning, on either page", async ({ page }) => {
  const { songUrl, playUrl, songId } = await seedSong(page, MARKED, ENTRIES);
  // A song falls back to the band's default, so no tuning means the band has none left either.
  await idb(
    page,
    `const tunings = await all("tunings");
     await write("tunings", (s) => { for (const t of tunings) s.put({ ...t, deletedAt: 1 }); });
     await write("songs", (s) => { const r = s.get(arg); r.onsuccess = () => s.put({ ...r.result, tuningId: crypto.randomUUID() }); });`,
    songId,
  );
  for (const url of [songUrl, playUrl]) {
    await page.goto(url);
    await expect(page.getByRole("heading").first()).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.getByTestId("staff-view")).toHaveCount(0);
  }
});

test("INV-007 no control on a play view with no arrangement", async ({ page }) => {
  const { playUrl, songUrl } = await seedSong(page, MARKED, []);
  await page.goto(playUrl);
  await expect(page.getByRole("heading").first()).toBeVisible();
  await page.waitForTimeout(300);
  await expect(page.getByTestId("tab-staff")).toHaveCount(0);
  await expect(page.getByTestId("staff-view")).toHaveCount(0);
  await page.goto(songUrl);
  await expect(page.getByTestId("staff-view")).toBeVisible();
});

// --- INV-006, round 2: the choice crosses the in-app link when storage is absent or refuses ---
const ACROSS_PARTS: PartSpec[] = [{ key: "a", label: "A", columns: [n(5), n(7), bar(), n(8)] }];
const ACROSS_ENTRIES: EntrySpec[] = [{ part: "a" }];

const NO_STORAGE: Record<string, () => void> = {
  "localStorage undefined": () => {
    Object.defineProperty(window, "localStorage", { value: undefined, configurable: true });
  },
  "localStorage getter throws": () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    });
  },
  "getItem throws": () => {
    const real = Storage.prototype.getItem;
    Storage.prototype.getItem = function getItem(key: string) {
      if (key === "stablature.staffView") throw new DOMException("blocked", "SecurityError");
      return real.call(this, key);
    };
  },
  "setItem throws": () => {
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === "stablature.staffView") throw new DOMException("full", "QuotaExceededError");
      real.call(this, key, value);
    };
  },
};

for (const [name, install] of Object.entries(NO_STORAGE)) {
  test(`INV-006 ${name}: the choice crosses the link to the play view and back`, async ({ page }) => {
    const { songUrl } = await seedSong(page, ACROSS_PARTS, ACROSS_ENTRIES);
    await page.addInitScript(install);
    await page.goto(songUrl);
    await choose(page, "notes");
    await page.getByRole("link", { name: "Play view" }).click();
    await expect(page).toHaveURL(/\/play$/);
    await expect(page.getByTestId("staff-view-notes")).toHaveAttribute("aria-pressed", "true");
    await choose(page, "intervals");
    await page.goBack();
    await expect(page).toHaveURL(songUrl);
    await expect(page.getByTestId("staff-view-intervals")).toHaveAttribute("aria-pressed", "true");
  });
}
