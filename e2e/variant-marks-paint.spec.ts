import { expect, test, type Page } from "@playwright/test";
import { fret } from "./capture-surface-helpers";
import { bar, choose, n, seedReadable, seedSong } from "./reading-helpers";

/** INV-032/034/010-font: what the variant marks actually paint, in both themes and in print. */

async function seedVariant(page: Page) {
  const { songUrl } = await seedReadable(page);
  await page.getByRole("button", { name: "+ variant" }).click();
  await page.getByRole("link", { name: "Edit" }).nth(1).click();
  await fret(page, "E", 3).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(3);
  await page.goto(songUrl);
  await expect(page.getByTestId("variant-line")).toBeVisible();
  await expect(page.locator('[data-diff="added"]')).toHaveCount(1);
}

/** Marks beyond `+` are cloned from the real one so every kind is measured on its real surface. */
async function addSyntheticMarks(page: Page) {
  await page.evaluate(() => {
    const real = Array.from(document.querySelectorAll('[data-testid="tab-diff"]')).find((e) => e.textContent === "+") as HTMLElement;
    real.setAttribute("data-real", "");
    for (const text of ["*", "−1"]) {
      const clone = real.cloneNode(true) as HTMLElement;
      clone.textContent = text;
      clone.setAttribute("data-synthetic", text);
      real.parentElement!.appendChild(clone);
    }
  });
}

type Rgb = [number, number, number];

/** Resolves any CSS colour to sRGB by painting it on a canvas pixel. */
const MEASURE = `(() => {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgb = (css) => {
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = "#000";
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
  };
  const surface = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const bg = getComputedStyle(n).backgroundColor;
      if (bg !== "rgba(0, 0, 0, 0)" && bg !== "transparent") return bg;
    }
    return "#ffffff";
  };
  const opacity = (el) => {
    let o = 1;
    for (let n = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
    return o;
  };
  return { rgb, surface, opacity };
})()`;

function luminance([r, g, b]: Rgb) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

async function paint(page: Page, selector: string) {
  return page.evaluate(
    ({ selector, measure }) => {
      const m = eval(measure) as {
        rgb: (c: string) => Rgb;
        surface: (e: Element) => string;
        opacity: (e: Element) => number;
      };
      const el = document.querySelector(selector) as HTMLElement;
      const style = getComputedStyle(el);
      return {
        text: el.textContent,
        ink: m.rgb(style.color),
        surface: m.rgb(m.surface(el)),
        opacity: m.opacity(el),
        weight: Number(style.fontWeight),
      };
    },
    { selector, measure: MEASURE },
  );
}

for (const scheme of ["dark", "light"] as const) {
  test(`marks and line are legible in the ${scheme} theme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await seedVariant(page);
    await addSyntheticMarks(page);

    const texts = (await page.locator('[data-testid="tab-diff"]').allTextContents()).filter(Boolean);
    expect(new Set(texts).size).toBe(texts.length);
    expect(new Set(texts)).toEqual(new Set(["+", "*", "−1"]));

    for (const selector of ['[data-real]:not([data-synthetic])', '[data-synthetic="*"]', '[data-synthetic="−1"]', '[data-testid="variant-line"]']) {
      const p = await paint(page, selector);
      expect(p.opacity, selector).toBe(1);
      expect(contrast(p.ink, p.surface), `${selector} contrast`).toBeGreaterThanOrEqual(4.5);
    }

    // A marked cell is heavier than an unmarked one, and its mask is the tint.
    const cells = await page.evaluate(() => {
      const marked = document.querySelector(".tab-diff-cells .tab-cell > span") as HTMLElement;
      const wrapper = marked.closest(".tab-diff-cells") as HTMLElement;
      const plain = Array.from(document.querySelectorAll(".tab-cell > span")).find((s) => !s.closest(".tab-diff-cells")) as HTMLElement;
      return {
        marked: Number(getComputedStyle(marked).fontWeight),
        plain: Number(getComputedStyle(plain).fontWeight),
        mask: getComputedStyle(marked).backgroundColor,
        tint: getComputedStyle(wrapper).backgroundColor,
      };
    });
    expect(cells.marked).toBeGreaterThan(cells.plain);
    expect(cells.mask).toBe(cells.tint);
  });
}

test("INV-010 the face that actually paints every decoration character is the staff's own", async ({ page }) => {
  await seedSong(page, [{ key: "a", label: "A", columns: [n(5, { techniques: { 2: ["palm_mute"] } })] }], [{ part: "a" }]);
  await choose(page, "notes");
  await page.evaluate(() => document.fonts.ready);
  // `document.fonts.check` answers true for a character no face covers, so it cannot fail. The browser's own
  // account of the face it painted with can: that is what falling back would change.
  const client = await page.context().newCDPSession(page);
  await client.send("DOM.enable");
  await client.send("CSS.enable");
  const painted: Record<string, string> = {};
  for (const c of ["0", "A", "·", "−", "#", "♭", "b", "?", "<", "~", "×"]) {
    await page.evaluate((text) => {
      document.getElementById("probe-glyph")?.remove();
      const span = document.createElement("span");
      span.id = "probe-glyph";
      span.textContent = text;
      document.querySelector(".tab-staff")!.append(span);
      return new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(span.getBoundingClientRect().width))));
    }, c);
    const { root } = await client.send("DOM.getDocument", { depth: -1 });
    const { nodeId } = await client.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#probe-glyph" });
    const { fonts } = await client.send("CSS.getPlatformFontsForNode", { nodeId });
    painted[c] = fonts.map((font) => font.familyName).join(" + ");
  }
  const own = painted["0"];
  // ♭ and × are not decorations the feature writes: they are here to show this probe can see a fallback.
  const { "♭": flat, "×": times, ...decorations } = painted;
  void flat;
  void times;
  for (const [c, face] of Object.entries(decorations)) expect(face, c).toBe(own);
  expect(painted["♭"], "the control: a character the face lacks").not.toBe(own);
});

for (const scheme of ["dark", "light"] as const) {
  test(`print keeps marks, line and captions legible against white from the ${scheme} scheme`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await seedVariant(page);
    await addSyntheticMarks(page);
    await page.emulateMedia({ media: "print", colorScheme: scheme });

    for (const selector of ['[data-real]:not([data-synthetic])', '[data-synthetic="*"]', '[data-synthetic="−1"]', '[data-testid="variant-line"]']) {
      await expect(page.locator(selector)).toBeVisible();
      const p = await paint(page, selector);
      expect(p.opacity, selector).toBe(1);
      expect(contrast(p.ink, [255, 255, 255]), `${selector} on white`).toBeGreaterThanOrEqual(4.5);
    }
    const caption = page.locator(".staff-caption").first();
    if (await caption.count()) {
      await expect(caption).toBeVisible();
      const p = await paint(page, ".staff-caption");
      expect(contrast(p.ink, [255, 255, 255])).toBeGreaterThanOrEqual(4.5);
    }
  });
}

const printTokens = (page: Page) =>
  page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    return {
      tint: root.getPropertyValue("--diff-tint").trim(),
      ink: root.getPropertyValue("--diff-ink").trim(),
    };
  });

test("INV-034 the tokens are the print values in dark, and the screen values off paper", async ({ page }) => {
  test.setTimeout(120_000);
  const { playUrl } = await seedSong(
    page,
    [
      { key: "a", label: "A", columns: [n(5), n(7), bar(), n(8)] },
      { key: "v", label: "A'", variantOf: "a", columns: [n(5), n(9), bar(), n(8)] },
    ],
    [{ part: "v" }],
  );
  await page.goto(playUrl);
  await expect(page.getByTestId("variant-line")).toBeVisible();

  await page.emulateMedia({ media: "screen", colorScheme: "dark" });
  expect(await printTokens(page)).toEqual({ tint: "#1b2f45", ink: "#8ecbff" });

  await page.emulateMedia({ media: "print", colorScheme: "dark" });
  expect(await printTokens(page)).toEqual({ tint: "#fff", ink: "#000" });
  // What the tokens are for: the marked cell's mask and its mark, on paper, in dark.
  const painted = await page.evaluate(() => {
    const column = document.querySelector('[data-diff="changed"]')!;
    const mark = column.querySelector('[data-testid="tab-diff"]') ?? column;
    return { mark: getComputedStyle(mark).color };
  });
  expect(painted.mark).toBe("rgb(0, 0, 0)");
});
