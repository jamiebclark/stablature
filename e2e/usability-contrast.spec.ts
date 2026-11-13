import { expect, test } from "@playwright/test";
import { startCapturing } from "./capture-surface-helpers";
import { bar, g, n, seedSong } from "./reading-helpers";
test.setTimeout(120_000);

/** INV-021: the staff is drawn in JetBrains Mono with no ligatures, so `|-` is two advances. */
test("INV-021 the staff is JetBrains Mono, without ligatures", async ({ page }) => {
  await startCapturing(page);
  await page.getByRole("button", { name: /string, fret 5,/ }).first().click();
  await expect(page.getByTestId("tab-column").first()).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const fontsOf = async (selector: string) => {
    const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
    expect(nodeId, selector).toBeGreaterThan(0);
    const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId });
    return fonts.map((f) => f.familyName);
  };

  expect(await fontsOf('[data-testid="tab-column"] .tab-cell span')).toContain("JetBrains Mono");
  // The control: a node known to use the interface face must NOT report the mono face.
  expect(await fontsOf('[data-testid="toolbar-stable"] button')).not.toContain("JetBrains Mono");

  const ligatures = await page
    .locator(".tab-staff")
    .first()
    .evaluate((el) => getComputedStyle(el).fontVariantLigatures);
  expect(ligatures).toBe("none");

  const advances = await page.locator(".tab-staff").first().evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.cssText = "position:absolute;white-space:pre";
    el.appendChild(probe);
    const width = (t: string) => ((probe.textContent = t), probe.getBoundingClientRect().width);
    const one = width("-");
    const pair = width("|-");
    probe.remove();
    return pair / one;
  });
  expect(advances).toBeCloseTo(2, 1);
});

/**
 * INV-018: every text node's colour against its real painted surface, opacity multiplied through, is at least
 * 4.5:1. A disabled control is identified by `disabled` only, never by looking dim.
 */
const RUNS = `(() => {
  const px = (css) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const g = c.getContext("2d");
    g.fillStyle = css; g.fillRect(0, 0, 1, 1);
    return Array.from(g.getImageData(0, 0, 1, 1).data);
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, under) => { const a = top[3] / 255; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(255); };
  const bad = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = walker.nextNode(); t; t = walker.nextNode()) {
    const el = t.parentElement;
    if (!el || !t.textContent.trim() || el.closest("script,style,noscript,[hidden],[aria-hidden=true]")) continue;
    if (el.closest("[disabled],[aria-disabled=true]")) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;
    let opacity = 1;
    for (let n = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
    const layers = [];
    for (let n = el; n; n = n.parentElement) {
      const c = px(getComputedStyle(n).backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] > 250) break;
    }
    let bg = [255, 255, 255, 255];
    for (const layer of layers.reverse()) bg = over(layer, bg);
    const ink = px(cs.color);
    const fg = over([ink[0], ink[1], ink[2], Math.round(ink[3] * opacity)], bg);
    const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
    const ratio = (hi + 0.05) / (lo + 0.05);
    if (ratio < 4.5) bad.push(el.tagName.toLowerCase() + ":" + t.textContent.trim().slice(0, 20) + " " + ratio.toFixed(2));
  }
  return bad;
})()`;

for (const theme of ["dark", "light"] as const) {
  test(`INV-018 capture text is 4.5:1 - ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await startCapturing(page);
    await page.getByRole("button", { name: /string, fret 5,/ }).first().click();
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    await expect.poll(() => page.evaluate(RUNS), { timeout: 5000 }).toEqual([]);
  });

  test(`INV-018 song page text, selection and numerals are 4.5:1 - ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await seedSong(
      page,
      [{ key: "a", label: "A", columns: [g("t", 3, { d: "32", chord: "Em7" }), g("t", 5, { d: "16" }), g("t", 7), bar(), n(2, { d: "8" })] }],
      [{ part: "a" }],
    );
    await expect.poll(() => page.evaluate(RUNS), { timeout: 5000, message: "base" }).toEqual([]);
    await page.getByTestId("tab-column").first().click();
    await page.getByTestId("tab-column").nth(1).click();
    await expect.poll(() => page.evaluate(RUNS), { timeout: 5000, message: "selected" }).toEqual([]);
  });
}

/**
 * INV-019: numerals, rhythm marks and bar numbers are at least 12px; the numeral sits inside its row.
 */
test("INV-019 numerals, marks and bar numbers are 12px or more and inside their rows", async ({ page }) => {
  await seedSong(
    page,
    [{ key: "a", label: "A", columns: [g("t", 3, { d: "32" }), g("t", 5, { d: "q" }), g("t", 7, { d: "8" }), bar(), n(2, { d: "16" })] }],
    [{ part: "a" }],
  );
  const sizes = await page.evaluate(() => {
    const px = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
    const pick = (sel: string) => [...document.querySelectorAll(sel)].filter((e) => e.textContent).map(px);
    const label = document.querySelector(".tab-bracket-label")!;
    const column = label.closest('[data-testid="tab-column"]')!;
    const line = column.querySelector(".tab-bracket")!;
    return {
      numerals: pick(".tab-bracket-label"),
      marks: [...document.querySelectorAll('[data-testid="tab-rhythm"][data-duration]')].length,
      bars: pick('[data-testid="tab-bar-number"]'),
      numeralBottomAboveLine: label.getBoundingClientRect().top >= line.getBoundingClientRect().bottom - 0.5, // spec 009: numeral under the line
    };
  });
  expect(sizes.numerals.length).toBeGreaterThan(0);
  expect(sizes.marks).toBeGreaterThan(0); // drawn marks have no font size; their own sizes are in notation-alignment
  for (const size of [...sizes.numerals, ...sizes.bars]) expect(size).toBeGreaterThanOrEqual(12);
  expect(sizes.numeralBottomAboveLine).toBe(true);
});
