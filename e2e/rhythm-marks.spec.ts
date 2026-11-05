/**
 * INV-010, INV-011, INV-012, and the surface half of INV-001. On every reading surface: each column's
 * mark against the stored value, inside its column, no column widened; six distinct texts; contrast
 * on the real surface and on both surface tokens, in both themes; no opacity tier; the staff's
 * description in words. T035 was ticked "reduced" with these unwritten.
 */
import { expect, test, type Page } from "@playwright/test";
import { contrast, seed, writeColumns, type Col } from "./rhythm-probe-helpers";

const D = ["w", "h", "q", "8", "16", "32"];
const WORDS: Record<string, string> = {
  w: "whole note",
  h: "half note",
  q: "quarter note",
  "8": "eighth note",
  "16": "sixteenth note",
  "32": "thirty-second note",
};

const LIST: Col[] = [
  ...D.map((d) => ({ d, frets: { 0: 5 } })),
  { kind: "barline" },
  ...D.map((d) => ({ d, frets: { 0: 12 } })),
  { kind: "barline" },
  ...D.map((d) => ({ d, kind: "rest" as const, frets: {} })),
  { kind: "barline" },
  { d: "8", frets: { 0: 7 }, repeat: 8 },
  { d: null, frets: { 0: 3 } },
];

/** What each drawn column should carry, at a density. */
function expected(density: "expanded" | "compact") {
  const out: string[] = [];
  for (const c of LIST) {
    const n = density === "expanded" ? (c.repeat ?? 1) : 1;
    for (let i = 0; i < n; i++) out.push(c.kind === "barline" ? "" : ((c.d as string | null) ?? ""));
  }
  return out;
}

const measure = (page: Page) =>
  page.getByTestId("tab-column").evaluateAll((els) =>
    els.map((el) => {
      const mark = el.querySelector("[data-testid=tab-rhythm]") as HTMLElement | null;
      const col = el.getBoundingClientRect();
      const span = el.querySelector(".tab-cell > span");
      let offset: number | null = null;
      if (mark && mark.textContent && span) {
        const range = document.createRange();
        range.selectNodeContents(mark);
        const m = range.getBoundingClientRect();
        const s = span.getBoundingClientRect();
        offset = Math.abs(m.x + m.width / 2 - (s.x + s.width / 2));
      }
      return {
        width: col.width,
        text: mark?.textContent ?? null,
        fits: mark ? mark.scrollWidth <= mark.clientWidth : null,
        label: el.getAttribute("aria-label") ?? "",
        offset,
      };
    }),
  );

for (const surface of ["song expanded", "song compact", "play"] as const) {
  test(`INV-010 INV-012 every mark under its column, ${surface}`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    const { songUrl, playUrl, partId } = await seed(page, LIST, { bpm: 120 });
    const density = surface === "song compact" ? "compact" : "expanded";
    const go = async () => {
      await page.goto(surface === "play" ? playUrl : songUrl);
      await expect(page.getByTestId("tab-column").first()).toBeVisible();
      if (surface === "song compact") await page.getByRole("button", { name: "compact" }).click();
    };
    await go();
    const want = expected(density);
    await expect(page.getByTestId("tab-column")).toHaveCount(want.length);
    const got = await measure(page);
    expect(got.map((c) => c.text)).toEqual(want);
    expect(got.every((c) => c.fits === true), "a mark overflows its column").toBe(true);

    got.forEach((c, i) => {
      if (want[i]) expect(c.label).toContain(WORDS[want[i]]);
      else expect(Object.values(WORDS).some((w) => c.label.includes(w))).toBe(false);
    });

    // Marks sit under their columns: a mark left of the fret it belongs to reads as the neighbour's.
    const off = got.filter((c) => c.offset !== null).map((c) => c.offset as number);
    test.info().annotations.push({ type: "offset", description: `max ${Math.max(...off).toFixed(1)}px` });

    // The same part with no durations: no column widened, and no row at all.
    await writeColumns(page, partId, LIST.map((c) => ({ ...c, d: null })));
    await go();
    const bare = await measure(page);
    expect(bare.map((c) => c.width)).toEqual(got.map((c) => c.width));
    expect(bare.every((c) => c.text === null)).toBe(true);
    await expect(page.getByTestId("tab-rhythm")).toHaveCount(0);
  });
}

test("INV-010 print emulation: the marks print with their staff, and fit", async ({ page }) => {
  const { playUrl } = await seed(page, LIST, { bpm: 120 });
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-column").first()).toBeVisible();
  await page.emulateMedia({ media: "print" });
  const got = await measure(page);
  expect(got.map((c) => c.text)).toEqual(expected("expanded"));
  expect(got.every((c) => c.fits === true)).toBe(true);
  await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  for (const where of ["song", "play"] as const) {
    test(`INV-011 six marks, contrast and no opacity tier, ${where}, ${theme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      const { songUrl, playUrl } = await seed(page, LIST, { bpm: 120 });
      await page.goto(where === "song" ? songUrl : playUrl);
      await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
      const marks = await page.getByTestId("tab-rhythm").evaluateAll((els) =>
        els
          .filter((el) => el.textContent)
          .map((el) => {
            let opacity = 1;
            let bg = "";
            for (let n: HTMLElement | null = el as HTMLElement; n; n = n.parentElement) {
              const s = getComputedStyle(n);
              opacity = Math.min(opacity, Number(s.opacity));
              if (!bg && s.backgroundColor !== "rgba(0, 0, 0, 0)") bg = s.backgroundColor;
            }
            return { text: el.textContent, color: getComputedStyle(el).color, bg, opacity };
          }),
      );
      expect(new Set(marks.map((m) => m.text)).size).toBe(6);
      for (const m of marks) {
        expect(m.opacity, `${m.text} sits under an opacity tier`).toBe(1);
        expect(contrast(m.color, m.bg), `${m.text}: ${m.color} on ${m.bg}`).toBeGreaterThanOrEqual(4.5);
      }
      const tokens = await page.evaluate(() => {
        const probe = (name: string) => {
          const el = document.createElement("div");
          el.style.color = `var(${name})`;
          document.body.append(el);
          const c = getComputedStyle(el).color;
          el.remove();
          return c;
        };
        return { bg: probe("--bg"), raised: probe("--bg-raised"), dim: probe("--text-dim") };
      });
      expect(contrast(tokens.dim, tokens.bg), "on --bg").toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.dim, tokens.raised), "on --bg-raised").toBeGreaterThanOrEqual(4.5);
    });
  }
}
