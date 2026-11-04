import { expect, test } from "@playwright/test";
import {
  PHONE,
  THEMES,
  columns,
  inspector,
  mouseHold,
  openDialog,
  stable,
  startCapturing,
} from "./capture-surface-helpers";
import {
  addNotes,
  brackets,
  groupControl,
  selectColumns,
  selectionBar,
  tupletControl,
} from "./grouping-helpers";

test.describe("selection row layout (US1)", () => {
  test.use({ viewport: PHONE });

  for (const theme of THEMES) {
    test(`one line, inside the band, nothing over-scrolls (${theme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await startCapturing(page);
      await addNotes(page, 16);
      const stableTop = (await stable(page).boundingBox())!.y;
      await selectColumns(page, 0, 15);

      const bar = selectionBar(page);
      const fits = await bar.evaluate((el) => ({
        row: el.scrollWidth <= el.clientWidth,
        kids: [...el.children].every((c) => c.scrollWidth <= c.clientWidth),
        height: el.getBoundingClientRect().height,
        within: [...el.children].every((c) => {
          const r = c.getBoundingClientRect();
          const b = el.getBoundingClientRect();
          return r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5;
        }),
      }));
      expect(fits.row).toBe(true);
      expect(fits.kids).toBe(true);
      expect(fits.within).toBe(true);
      expect(fits.height).toBeGreaterThan(0);
      expect((await stable(page).boundingBox())!.y).toBe(stableTop);
      const overscroll = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overscroll).toBeLessThanOrEqual(0);

      const names = await bar
        .getByRole("button")
        .evaluateAll((els) =>
          els.map(
            (e) => e.getAttribute("aria-label") ?? e.textContent?.trim() ?? "",
          ),
        );
      expect(names).toEqual([
        "copy",
        "cut",
        "delete",
        "Make a tuplet of 16",
        "Group with no number",
        "cancel",
      ]);
      for (const name of names)
        expect(name.toLowerCase()).not.toContain("triplet");
    });
  }

  test("every numeral 2 to 16 clears both rails", async ({ page }) => {
    await startCapturing(page);
    await addNotes(page, 16);
    for (let n = 2; n <= 16; n++) {
      await selectColumns(page, 0, n - 1);
      const gaps = await tupletControl(page).evaluate((button) => {
        const text = button.querySelector("text")!.getBBox();
        return [...button.querySelectorAll("[data-rail]")].map((rail) => {
          const r = (rail as SVGGraphicsElement).getBBox();
          return r.x < text.x
            ? text.x - (r.x + r.width)
            : r.x - (text.x + text.width);
        });
      });
      expect(gaps).toHaveLength(2);
      for (const gap of gaps) expect(gap).toBeGreaterThan(0);
      await selectionBar(page).getByRole("button", { name: "cancel" }).click();
    }
  });
});

test.describe("bracket legibility and alignment (US1)", () => {
  test.use({ viewport: PHONE });

  for (const theme of THEMES) {
    test(`bracket contrast is at least 3:1 on base and selected (${theme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      await startCapturing(page);
      await addNotes(page, 3);
      await selectColumns(page, 0, 2);
      await tupletControl(page).click();

      const measure = () =>
        page
          .locator('[data-testid="tab-bracket"][data-start]')
          .evaluate((el) => {
            const rgb = (css: string) => {
              const c = document.createElement("canvas");
              c.width = c.height = 1;
              const g = c.getContext("2d")!;
              g.clearRect(0, 0, 1, 1);
              g.fillStyle = css;
              g.fillRect(0, 0, 1, 1);
              const [r, gr, b, a] = g.getImageData(0, 0, 1, 1).data;
              return { r, g: gr, b, a: a / 255 };
            };
            const lum = ({ r, g, b }: { r: number; g: number; b: number }) => {
              const f = (v: number) => {
                const s = v / 255;
                return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
              };
              return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
            };
            let bg = rgb("white");
            for (let n: Element | null = el; n; n = n.parentElement) {
              const c = rgb(getComputedStyle(n).backgroundColor);
              if (c.a > 0.99) {
                bg = c;
                break;
              }
            }
            let opacity = 1;
            for (let n: Element | null = el; n; n = n.parentElement) {
              opacity *= Number(getComputedStyle(n).opacity);
            }
            const fg = rgb(getComputedStyle(el).borderTopColor);
            const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
            return { ratio: (a + 0.05) / (b + 0.05), opacity };
          });

      const base = await measure();
      expect(base.opacity).toBe(1);
      expect(base.ratio).toBeGreaterThanOrEqual(3);

      await selectColumns(page, 0, 2);
      const selected = await measure();
      expect(selected.ratio).toBeGreaterThanOrEqual(3);
    });
  }

  test("bracket contrast is at least 3:1 under print emulation", async ({
    page,
  }) => {
    await startCapturing(page);
    await addNotes(page, 3);
    await selectColumns(page, 0, 2);
    await tupletControl(page).click();
    await page.emulateMedia({ media: "print", colorScheme: "light" });
    const ratio = await page
      .locator('[data-testid="tab-bracket"][data-start]')
      .evaluate((el) => {
        const px = (css: string) => {
          const c = document.createElement("canvas");
          c.width = c.height = 1;
          const g = c.getContext("2d")!;
          g.fillStyle = css;
          g.fillRect(0, 0, 1, 1);
          return Array.from(g.getImageData(0, 0, 1, 1).data);
        };
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        let bg = [255, 255, 255];
        for (let n: Element | null = el; n; n = n.parentElement) {
          const c = px(getComputedStyle(n).backgroundColor);
          if (c[3] > 250) {
            bg = c;
            break;
          }
        }
        const [a, b] = [
          lum(px(getComputedStyle(el).borderTopColor)),
          lum(bg),
        ].sort((x, y) => y - x);
        return (a + 0.05) / (b + 0.05);
      });
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  test("string labels line up with their rows on the capture staff", async ({
    page,
  }) => {
    await startCapturing(page);
    await addNotes(page, 3);
    await selectColumns(page, 0, 2);
    await tupletControl(page).click();
    const offsets = await page.getByTestId("tab-staff").evaluate((staff) => {
      const labels = [...staff.querySelectorAll("[aria-hidden] > .tab-cell")];
      const first = staff.querySelector('[data-testid="tab-column"]')!;
      const cells = [...first.querySelectorAll(".tab-cell")];
      return labels.map(
        (l, i) =>
          l.getBoundingClientRect().top - cells[i].getBoundingClientRect().top,
      );
    });
    expect(offsets.length).toBeGreaterThan(0);
    for (const d of offsets) expect(Math.abs(d)).toBeLessThan(0.5);
  });
});

test.describe("selection row across string counts and chord rows (US1 remainder)", () => {
  test.use({ viewport: PHONE });

  for (const theme of THEMES) {
    for (const chord of [false, true]) {
      for (const n of [3, 16]) {
        test(`seven controls fit, stable row and band hold (${theme}, ${chord ? "chord row" : "no chord row"}, numeral ${n})`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme: theme });
          await startCapturing(page);
          await addNotes(page, n);
          if (chord) {
            await mouseHold(page, columns(page).first());
            await inspector(page).getByLabel("chord symbol").fill("Am");
            await inspector(page).getByRole("button", { name: "set" }).click();
            await page.keyboard.press("Escape");
            await expect(openDialog(page)).toHaveCount(0);
          }
          const stableTop = (await stable(page).boundingBox())!.y;
          const rest = (await page.getByTestId("tab-staff").boundingBox())!
            .height;
          await selectColumns(page, 0, n - 1);
          const bar = selectionBar(page);
          const fits = await bar.evaluate((el) => ({
            row: el.scrollWidth <= el.clientWidth,
            kids: [...el.children].every((c) => c.scrollWidth <= c.clientWidth),
            tops: new Set(
              [...el.children].map((c) =>
                Math.round(c.getBoundingClientRect().top),
              ),
            ).size,
          }));
          expect(fits.row).toBe(true);
          expect(fits.kids).toBe(true);
          expect(fits.tops).toBe(1);
          expect((await stable(page).boundingBox())!.y).toBe(stableTop);
          expect(
            (await page.getByTestId("tab-staff").boundingBox())!.height,
          ).toBeGreaterThanOrEqual(rest - 0.5);
        });
      }
    }
  }

});

test.describe("raised surfaces: contrast and label alignment (US1 remainder)", () => {
  test.use({ viewport: PHONE });

  /** Capture the part, then land on the song page (expanded) with the bracket drawn. */
  async function captured(
    page: import("@playwright/test").Page,
    kind: "tuplet" | "plain" | "both",
    chord: boolean,
  ) {
    const { songUrl } = await startCapturing(page);
    await addNotes(page, kind === "both" ? 6 : 3);
    await selectColumns(page, 0, 2);
    await (kind === "plain" ? groupControl(page) : tupletControl(page)).click();
    if (kind === "both") {
      await selectColumns(page, 3, 5);
      await groupControl(page).click();
    }
    if (chord) {
      await mouseHold(page, columns(page).first());
      await inspector(page).getByLabel("chord symbol").fill("Am");
      await inspector(page).getByRole("button", { name: "set" }).click();
      await page.keyboard.press("Escape");
      await expect(openDialog(page)).toHaveCount(0);
    }
    await expect(brackets(page).first()).toBeVisible();
    return songUrl;
  }

  /** Each string label's top against its row's, on the first staff drawn. */
  const alignment = (page: import("@playwright/test").Page) =>
    page
      .getByTestId("tab-staff")
      .first()
      .evaluate((staff) => {
        const labels = [...staff.querySelectorAll("[aria-hidden] > .tab-cell")];
        const cells = [
          ...staff
            .querySelector('[data-testid="tab-column"]')!
            .querySelectorAll(".tab-cell"),
        ];
        return labels.map(
          (l, i) =>
            l.getBoundingClientRect().top -
            cells[i].getBoundingClientRect().top,
        );
      });

  for (const theme of THEMES) {
    test(`bracket contrast is at least 3:1 on the raised surface (${theme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: theme });
      const songUrl = await captured(page, "plain", false);
      await page.goto(songUrl);
      const bracket = page.locator('[data-testid="tab-bracket"][data-start]').first();
      await expect(bracket).toBeVisible();
      const m = await bracket.evaluate((el) => {
        const px = (css: string) => {
          const c = document.createElement("canvas");
          c.width = c.height = 1;
          const g = c.getContext("2d")!;
          g.fillStyle = css;
          g.fillRect(0, 0, 1, 1);
          return Array.from(g.getImageData(0, 0, 1, 1).data);
        };
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        let bg = [255, 255, 255];
        let opacity = 1;
        for (let n: Element | null = el; n; n = n.parentElement)
          opacity *= Number(getComputedStyle(n).opacity);
        for (let n: Element | null = el; n; n = n.parentElement) {
          const c = px(getComputedStyle(n).backgroundColor);
          if (c[3] > 250) {
            bg = c;
            break;
          }
        }
        const [a, b] = [
          lum(px(getComputedStyle(el).borderTopColor)),
          lum(bg),
        ].sort((x, y) => y - x);
        return { ratio: (a + 0.05) / (b + 0.05), opacity };
      });
      expect(m.opacity).toBe(1);
      expect(m.ratio).toBeGreaterThanOrEqual(3);
    });
  }

  for (const kind of ["plain", "tuplet", "both"] as const) {
    for (const chord of [false, true]) {
      for (const density of ["expanded", "compact"] as const) {
        test(`labels line up on the song page (${kind}, ${density}${chord ? ", chord row" : ""})`, async ({
          page,
        }) => {
          const songUrl = await captured(page, kind, chord);
          await page.goto(songUrl);
          await page.getByRole("button", { name: density, exact: true }).click();
          await expect(brackets(page).first()).toBeVisible({ timeout: 15000 });
          if (kind === "plain")
            await expect(page.locator(".tab-bracket-label")).toHaveCount(0);
          const offsets = await alignment(page);
          expect(offsets.length).toBeGreaterThan(0);
          for (const d of offsets) expect(Math.abs(d)).toBeLessThan(0.5);
        });
      }
    }
  }

  for (const kind of ["plain", "both"] as const) {
    test(`labels line up on the play view (${kind})`, async ({ page }) => {
      const songUrl = await captured(page, kind, true);
      await page.goto(songUrl);
      const add = page.getByRole("button", {
        name: /^Add part .* to the arrangement$/,
      });
      await add.first().click();
      await expect(
        page.getByRole("button", { name: "Each part once" }),
      ).toHaveCount(0); // the write landed
      await page.goto(`${songUrl}/play`);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await expect(brackets(page).first()).toBeVisible();
      const offsets = await alignment(page);
      expect(offsets.length).toBeGreaterThan(0);
      for (const d of offsets) expect(Math.abs(d)).toBeLessThan(0.5);
    });
  }
});
