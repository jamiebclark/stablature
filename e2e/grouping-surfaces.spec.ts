/**
 * INV-022 / FR-032: 4 surfaces (capture, song expanded, song compact, play) x {plain-only,
 * counted-only, both} x {no chord row, chord row}: every label on its row, brackets counted.
 * INV-023 / FR-033 on screen: numerals counted and the line checked for gaps, with a repeat;
 * INV-023-connector-shape.spec.ts has the connector.
 * INV-024 / FR-034: {base, raised, selected} x {dark, light}, then print x {dark, light}, on the
 * line and on a gap segment; no opacity below 1 on the line or its ancestors.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  addNotes,
  brackets,
  chip,
  columns,
  connectors,
  fret,
  groupControl,
  measureContrast,
  PHONE,
  selectColumns,
  setChordOn,
  startCapturing,
  THEMES,
  tupletControl,
} from "./probe-helpers";

type Kind = "plain" | "tuplet" | "both";

async function captured(page: Page, kind: Kind, chord: boolean) {
  const { songUrl, partUrl } = await startCapturing(page);
  await addNotes(page, kind === "both" ? 6 : 3);
  await selectColumns(page, 0, 2);
  await (kind === "plain" ? groupControl(page) : tupletControl(page)).click();
  if (kind === "both") {
    await selectColumns(page, 3, 5);
    await groupControl(page).click();
  }
  if (chord) await setChordOn(page, 0, "Am");
  await expect(brackets(page).first()).toBeVisible();
  return { songUrl, partUrl };
}

/** Each string label's top against its row's, on the first staff drawn. */
const alignment = (page: Page) =>
  page
    .getByTestId("tab-staff")
    .first()
    .evaluate((staff) => {
      const labels = [...staff.querySelectorAll("[aria-hidden] > .tab-cell")];
      const cells = [
        ...staff.querySelector('[data-testid="tab-column"]')!.querySelectorAll(".tab-cell"),
      ];
      return labels.map(
        (l, i) => l.getBoundingClientRect().top - cells[i].getBoundingClientRect().top,
      );
    });

async function expectSurface(page: Page, kind: Kind) {
  await expect(brackets(page).first()).toBeVisible({ timeout: 15_000 });
  await expect(brackets(page)).toHaveCount(kind === "both" ? 2 : 1);
  await expect(page.locator(".tab-bracket-label")).toHaveCount(kind === "plain" ? 0 : 1);
  const offsets = await alignment(page);
  expect(offsets).toHaveLength(5);
  for (const d of offsets) expect(Math.abs(d)).toBeLessThan(0.5);
}

test.describe("INV-022", () => {
  for (const kind of ["plain", "tuplet", "both"] as const) {
    for (const chord of [false, true]) {
      test(`${kind}${chord ? ", chord row" : ""}, all four surfaces`, async ({ page }) => {
        const { songUrl } = await captured(page, kind, chord);
        await expectSurface(page, kind);

        await page.goto(songUrl);
        await page.getByRole("button", { name: "expanded", exact: true }).click();
        await expectSurface(page, kind);
        await page.getByRole("button", { name: "compact", exact: true }).click();
        await expectSurface(page, kind);

        await page.getByRole("button", { name: /^Add part .* to the arrangement$/ }).first().click();
        await expect(page.getByRole("button", { name: "Each part once" })).toHaveCount(0);
        await page.goto(`${songUrl}/play`);
        await expect(page.getByTestId("tab-staff").first()).toBeVisible();
        await expectSurface(page, kind);
      });
    }
  }
});

/** Adjacent segments of one bracket touch: no gap, on the drawn line. */
async function expectUnbroken(line: Locator) {
  const boxes = await line.evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top };
    }),
  );
  boxes.sort((a, b) => a.left - b.left);
  for (let i = 1; i < boxes.length; i++) {
    expect(Math.abs(boxes[i].left - boxes[i - 1].right)).toBeLessThan(0.51);
    expect(boxes[i].top).toBe(boxes[0].top);
  }
  return boxes.length;
}

test.describe("INV-023", () => {
  for (const kind of ["tuplet", "plain"] as const) {
    for (const at of [0, 1, 2]) {
      test(`repeat: 8 at ${at}, ${kind}: one line, at most one number`, async ({ page }, info) => {
        test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
        const { songUrl } = await startCapturing(page);
        await addNotes(page, 3);
        await selectColumns(page, 0, 2);
        await (kind === "plain" ? groupControl(page) : tupletControl(page)).click();
        await columns(page).nth(at).click();
        for (let i = 0; i < 7; i++) {
          await page.getByRole("button", { name: "Repeat one more time" }).click();
        }
        await expect(columns(page)).toHaveCount(10);
        await expect(brackets(page)).toHaveCount(1);
        await expect(page.locator(".tab-bracket-label")).toHaveCount(kind === "plain" ? 0 : 1);
        await page.getByRole("button", { name: /^end/ }).click();
        expect(await expectUnbroken(page.locator(".tab-bracket"))).toBe(10);

        await page.goto(songUrl);
        await page.getByRole("button", { name: "compact", exact: true }).click();
        await expect(brackets(page)).toHaveCount(1);
        await expect(page.locator(".tab-bracket-label")).toHaveCount(kind === "plain" ? 0 : 1);
        expect(await expectUnbroken(page.locator(".tab-bracket"))).toBe(3);
      });
    }

  }
});

test.describe("INV-024", () => {
  test.use({ viewport: PHONE });

  async function read(line: Locator) {
    const fn = new Function(`return (${measureContrast})`)() as never;
    void fn;
    return line.evaluate(
      (el, source) => (new Function(`return (${source})`)() as (e: Element) => unknown)(el),
      measureContrast,
    ) as Promise<{ ratio: number; opacity: number; fg: string; bg: string }>;
  }

  for (const theme of THEMES) {
    test(`base, raised and selected (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      const { songUrl, partUrl } = await captured(page, "plain", false);
      const line = page.locator('[data-testid="tab-bracket"][data-start]').first();
      const base = await read(line);

      await selectColumns(page, 0, 2);
      const selected = await read(line);
      await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click();

      await page.goto(songUrl);
      await expect(line).toBeVisible();
      const raised = await read(line);
      console.log(JSON.stringify({ theme, base, selected, raised }));
      for (const [name, m] of Object.entries({ base, selected, raised })) {
        expect(m.opacity, name).toBe(1);
        expect(m.ratio, name).toBeGreaterThanOrEqual(3);
      }
      void partUrl;
    });

    test(`a gap segment on the selection band (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await startCapturing(page);
      await fret(page, "E", 5).click();
      await expect(columns(page)).toHaveCount(1);
      await chip(page, "hammer-on").click();
      await fret(page, "E", 7).click();
      await expect(columns(page)).toHaveCount(2);
      await selectColumns(page, 0, 1);
      await groupControl(page).click();
      await selectColumns(page, 0, 1);
      const m = await read(connectors(page).first().locator(".tab-bracket"));
      console.log(JSON.stringify({ theme, gap: m }));
      expect(m.ratio).toBeGreaterThanOrEqual(3);
    });

    test(`print (${theme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      const { songUrl } = await captured(page, "plain", false);
      await page.goto(songUrl);
      const line = page.locator('[data-testid="tab-bracket"][data-start]').first();
      await expect(line).toBeVisible();
      await page.emulateMedia({ media: "print", colorScheme: theme });
      const m = await read(line);
      console.log(JSON.stringify({ theme, print: m }));
      expect(m.opacity).toBe(1);
      expect(m.ratio).toBeGreaterThanOrEqual(3);
    });
  }
});
