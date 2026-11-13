/**
 * Review probe (round 3), for the eye: INV-010's "never are two of Sym indistinguishable" and FR-027's "three flags
 * told apart by eye", after round 2's fix (T064) made the staff flag a short straight stroke.
 *
 * `e2e/notation-screens.spec.ts` beams every 8th, 16th and 32nd it draws, so no screenshot it writes shows a flag.
 * This writes the song page's staff with every Sym member alone in its beat (and a beamed pair of each, for the
 * flag-versus-stub comparison) at 375×667 and 1280×800, dark and light, to test-results/review-009/screens/.
 * It asserts only that each file is written; the judgement is a person's (T043, T044).
 *
 *   npx playwright test --config specs/009-rhythm-notation/review-probes/playwright.review.config.ts \
 *     INV-010-lone-symbols-screens < /dev/null
 */
import { expect, test } from "@playwright/test";
import { mkdirSync, statSync } from "node:fs";
import { seed, type Col } from "../../../e2e/rhythm-probe-helpers";

const F = { 0: 12, 5: 3 };
const n = (d: string): Col => ({ d, frets: F });
const r = (d: string): Col => ({ d, kind: "rest", frets: {} });
const bar: Col = { kind: "barline" };

const LIST: Col[] = [
  n("w"), bar, n("h"), n("h"), bar,
  n("q"), n("8"), n("q"), n("16"), bar,
  n("q"), n("32"), n("q"), { frets: F }, bar,
  n("8"), n("8"), n("16"), n("16"), n("16"), n("16"), bar,
  n("32"), n("32"), n("32"), n("32"), n("q"), bar,
  r("w"), bar, r("h"), r("h"), bar,
  r("q"), r("8"), r("16"), r("32"),
];

for (const size of [
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
])
  for (const theme of ["dark", "light"] as const)
    test(`INV-010 lone symbols at ${size.width}, ${theme}`, async ({ page }, info) => {
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: theme });
      const urls = await seed(page, LIST, { bpm: 120 });
      await page.goto(urls.songUrl);
      await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
      const dir = "test-results/review-009/screens";
      mkdirSync(dir, { recursive: true });
      const path = `${dir}/${info.project.name}-${size.width}-${theme}.png`;
      await page.getByTestId("tab-staff").first().screenshot({ path });
      expect(statSync(path).size).toBeGreaterThan(1000);
    });
