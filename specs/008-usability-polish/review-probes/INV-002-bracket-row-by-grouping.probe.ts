/**
 * Review probe, spec 008 round 3, INV-002: the mode is re-decided when the line's height changes through the
 * bracket row (a group made or taken apart), not only through the chord row (round 2's probe).
 *
 * A 4-string part with a chord and no bracket at 375x667: one line is ~116.8px, so two lines and the gap fit the
 * 258px band and it wraps. Grouping three columns adds the bracket row (line ~134.4, two lines need ~280.75), so it
 * must leave wrapped mode; ungrouping them must bring it back. Each state is checked against the plan's rule,
 * `.tab-staff-wrapped` exists ⇔ band ≥ 2·line + gap, read from the DOM.
 */
import { expect, test } from "@playwright/test";
import { columns, selectColumns, tupletControl, TUNINGS } from "../../../e2e/probe-helpers";
import { bandGeometry, longPart } from "./helpers";

test.setTimeout(300_000);

test("INV-002 a bracket row made or removed by grouping re-decides the mode (4 + chord at 375x667)", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  const four = TUNINGS.find((t) => t.strings === 4)!;
  await longPart(page, { tuning: four, chord: true, bracket: false, bars: 16, size: { width: 375, height: 667 } });
  const check = async (label: string) => {
    await page.waitForTimeout(900);
    const g = await bandGeometry(page);
    const fits = g.content >= 2 * g.line + g.gap;
    console.log(`${label}: wrapped ${g.wrapped}, band ${g.content}, line ${g.line}, need ${2 * g.line + g.gap}`);
    expect(g.wrapped, `${label}: wrapped must equal "two lines fit"`).toBe(fits);
    return g;
  };
  const before = await check("no bracket");
  expect(before.wrapped, "precondition: 4 + chord wraps at 375x667").toBe(true);

  await selectColumns(page, 4, 6);
  await tupletControl(page).click();
  await expect(page.locator('[data-testid="tab-bracket"][data-start]')).toHaveCount(1);
  await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click({ timeout: 1000 }).catch(() => undefined);
  const grouped = await check("after grouping");
  expect(grouped.line, "the bracket row must have made the line taller").toBeGreaterThan(before.line);

  await selectColumns(page, 4, 6);
  await page.getByTestId("toolbar-selection").getByRole("button", { name: "Ungroup", exact: true }).click();
  await expect(page.locator('[data-testid="tab-bracket"][data-start]')).toHaveCount(0);
  await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click({ timeout: 1000 }).catch(() => undefined);
  await check("after ungrouping");
  await expect(columns(page).first()).toBeVisible();
});
