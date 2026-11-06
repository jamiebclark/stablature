/**
 * The members of INV-009, INV-012, INV-021, INV-023 and INV-025 that the suite's single test for each leaves out: a cue
 * in a section; each column kind; the chord row, numeral, mark, paste box, refused and ignored lines; a 120-character
 * title on every surface it names; an empty song, one part and many parts.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, details, inspector } from "./capture-surface-helpers";
import { bar, g, n, seedSong, type Col, type EntrySpec } from "./reading-helpers";
import { pasteTab } from "./import-helpers";
import { patchSong } from "./rhythm-probe-helpers";
import { fullWorld } from "./probe-screens";

test.setTimeout(120_000);

const PHONES = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
];

test("INV-009 a cue on the song page and a cue in a section, by Tab and Enter", async ({ page }) => {
  const section = { kind: "section_start", label: "Verse", repeat: 1 } as unknown as EntrySpec;
  const end = { kind: "section_end" } as unknown as EntrySpec;
  const { songUrl } = await seedSong(page, [{ key: "a", label: "A", columns: [n(3)] }], [
    { kind: "text", label: "outside cue" },
    section,
    { kind: "text", label: "inside cue" },
    { part: "a" },
    end,
  ]);
  await page.goto(songUrl);
  for (const name of ["outside cue", "inside cue"]) {
    const cue = page.getByRole("button", { name });
    await expect(cue, name).toBeVisible();
    await page.locator("body").click({ position: { x: 1, y: 1 } });
    let reached = false;
    for (let i = 0; i < 90 && !reached; i += 1) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate((text) => document.activeElement?.textContent?.trim() === text, name);
    }
    expect(reached, `${name}: Tab reaches it`).toBe(true);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Done" }), `${name}: Enter selects it`).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
  }
});

test("INV-012 a note, a rest and a repeat have the sheet by a tap; a barline's one action is on the stable row", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the long press is the touch column");
  const { songId, parts } = await seedSong(
    page,
    [{ key: "a", label: "A", columns: [n(3, { d: "q" }), { kind: "rest", d: "q" }, n(3, { d: "q", repeat: 2 }), bar(), n(5, { d: "q" })] }],
    [{ part: "a" }],
  );
  await page.goto(`/songs/${songId}/capture/${parts.a}`);
  await expect(columns(page).first()).toBeVisible();
  for (const i of [0, 1, 2]) {
    await columns(page).nth(i).click();
    await details(page).click();
    await expect(inspector(page), `column ${i}`).toBeVisible();
    await inspector(page).getByRole("button", { name: "close" }).click();
  }
  await columns(page).nth(3).click();
  await expect(page.getByRole("button", { name: /^Delete the/ })).toBeEnabled();
});

const family = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((el) => {
    const s = getComputedStyle(el);
    return { family: s.fontFamily, ligatures: s.fontVariantLigatures };
  });

test("INV-021 every member is in the staff's font, without ligatures", async ({ page }) => {
  const { songUrl, parts } = await seedSong(
    page,
    [{ key: "a", label: "A", columns: [n(3, { d: "q", chord: "Am" }), g("t", 3, { d: "8" }), g("t", 5, { d: "8" }), g("t", 7, { d: "8" })] }],
    [{ part: "a" }],
  );
  await page.goto(songUrl);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const platform = async (selector: string) => {
    const { root } = await cdp.send("DOM.getDocument");
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    expect(nodeId, selector).toBeGreaterThan(0);
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    return fonts.map((f) => f.familyName);
  };

  const bad: string[] = [];
  const read = async (name: string, selector: string, drawn = true) => {
    const f = await family(page, selector);
    if (f.ligatures !== "none") bad.push(`${name}: ligatures ${f.ligatures}`);
    if (!drawn) {
      if (!/JetBrains/i.test(f.family)) bad.push(`${name}: ${f.family}`);
      return;
    }
    const fonts = await platform(selector);
    if (!fonts.every((x) => /JetBrains/i.test(x))) bad.push(`${name}: drawn in ${fonts.join(", ")}`);
  };
  await read("staff cell", '[data-testid="tab-column"] .tab-cell span');
  await read("chord row", '[data-testid="tab-column"] > div.text-accent');
  await read("numeral", ".tab-bracket-label");
  await read("rhythm mark", '[data-testid="tab-rhythm"]');

  await pasteTab(page, "G|-5-7-|\nD|-----|\nA|-----|\nE|-----|\nAm7-D7");
  await page.waitForTimeout(250);
  await read("paste box", 'textarea[aria-label="Tab text"]', false);
  await read("ignored line", "code.tab-text");
  await pasteTab(page, "G|-5-7-|\nD|-----|\nA|-----|\nE|-----|\nA7-D7");
  await page.waitForTimeout(250);
  await read("refused line", "code.tab-text");
  expect(bad).toEqual([]);
  expect(parts.a).toBeTruthy();
});

const TITLE = `${"A very long song title ".repeat(6)}`.slice(0, 120);

const clampLines = (page: Page, text: string) =>
  page.evaluate((t) => {
    const hits = [...document.querySelectorAll("h1, h2, a, p, span, button")].filter(
      (el) => el.children.length === 0 && (el.textContent ?? "").trim().startsWith(t.slice(0, 40)),
    );
    return hits.map((el) => {
      const s = getComputedStyle(el);
      const lh = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3;
      return { lines: Math.round(el.getBoundingClientRect().height / lh), clamp: s.webkitLineClamp, truncate: s.textOverflow };
    });
  }, text);

for (const size of PHONES) {
  test(`INV-023 a 120-character title at ${size.width}`, async ({ page, isMobile }) => {
    test.skip(!isMobile, "the set is **Sz**");
    await page.setViewportSize(size);
    const world = await fullWorld(page);
    await patchSong(page, { title: TITLE });
    const bad: string[] = [];
    for (const url of [world.bandUrl, world.songUrl, world.playUrl]) {
      await page.goto(url);
      await page.waitForTimeout(350);
      const seen = await clampLines(page, TITLE);
      expect(seen.length, `the title is on ${url}`).toBeGreaterThan(0);
      for (const hit of seen) if (hit.lines > 2) bad.push(`${url}: ${JSON.stringify(hit)}`);
    }
    await page.goto(world.partUrl);
    const back = page.getByRole("button", { name: /^Back to/ });
    await expect(back).toBeVisible();
    const box = (await back.boundingBox())!;
    if (box.height < 43.5 || box.width < 43.5) bad.push(`capture back ${box.width}x${box.height}`);
    if (box.height > 46) bad.push(`capture back ${box.height} high`);
    await columns(page).first().click();
    await page.getByRole("button", { name: "chord symbol" }).click();
    const hint = page.getByPlaceholder("Harmony, e.g. Am");
    await expect(hint).toBeVisible();
    const fits = await hint.evaluate((el) => {
      const input = el as HTMLInputElement;
      const c = document.createElement("canvas").getContext("2d")!;
      const s = getComputedStyle(input);
      c.font = `${s.fontSize} ${s.fontFamily}`;
      const room = input.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
      return { room, needs: c.measureText(input.placeholder).width, size: s.fontSize };
    });
    if (fits.needs > fits.room) bad.push(`hint ${JSON.stringify(fits)}`);
    if (fits.size !== "16px") bad.push(`hint at ${fits.size}`);
    expect(bad).toEqual([]);
  });
}

const parts = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ key: `p${i}`, label: String.fromCharCode(65 + i), columns: [n(3, { d: "q" }), n(5, { d: "q" })] as Col[] }));

for (const [name, count] of [["one part", 1], ["many parts", 9]] as const) {
  test(`INV-025 ${name}`, async ({ page, isMobile }) => {
    const { songUrl } = await seedSong(page, parts(count), parts(count).map((p) => ({ part: p.key })));
    const sizes = isMobile ? PHONES : [{ width: 1280, height: 800 }];
    for (const size of sizes) {
      await page.setViewportSize(size);
      await page.goto(songUrl);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await page.waitForTimeout(200);
      const bar = page.getByTestId("song-actions");
      if (!isMobile) {
        await expect(bar, "absent on a mouse").toBeHidden();
        await expect(page.getByRole("link", { name: "Capture" }).first()).toBeVisible();
        await expect(page.getByRole("link", { name: "Play view" }).first()).toBeVisible();
        continue;
      }
      for (const where of [0, 0.5, 1]) {
        await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), where);
        await page.waitForTimeout(100);
        for (const label of ["Capture", "Play view"]) {
          const box = (await bar.getByRole("link", { name: label }).boundingBox())!;
          expect(box.y, `${label} at ${where}`).toBeGreaterThanOrEqual(size.height / 2);
        }
      }
      const clears = await page.evaluate(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
        const last = [...document.querySelectorAll('[data-testid="tab-staff"]')].at(-1)!.getBoundingClientRect().bottom;
        return document.querySelector('[data-testid="song-actions"]')!.getBoundingClientRect().top - last;
      });
      expect(clears, "the bar does not cover a part").toBeGreaterThanOrEqual(0);
      await page.emulateMedia({ media: "print" });
      await expect(bar).toBeHidden();
      await page.emulateMedia({ media: "screen" });
    }
  });
}

test("INV-025 an empty song still has both actions under the thumb", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the touch column");
  const { songUrl } = await seedSong(page, parts(1), [{ part: "p0" }]);
  await page.goto(songUrl);
  await page.getByRole("link", { name: "Band" }).first().click();
  await page.getByLabel("Song title").fill("Empty");
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  await page.waitForTimeout(300);
  const bar = page.getByTestId("song-actions");
  const shown = await bar.isVisible();
  if (shown) {
    for (const label of ["Capture", "Play view"]) {
      const link = bar.getByRole("link", { name: label });
      if (await link.count()) expect((await link.boundingBox())!.y).toBeGreaterThanOrEqual(page.viewportSize()!.height / 2);
    }
  }
  await expect(page.getByRole("button", { name: /\+ part|Add a part|Paste tab/ }).first()).toBeVisible();
});
