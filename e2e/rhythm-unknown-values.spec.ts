/**
 * INV-005 / FR-007. U x {inspector, cursor status, song expanded, song compact, play view, the walk},
 * and `undefined` on an old row: no error, no lit position, no mark, no rewrite. Then a tap on `8`.
 * T035 was ticked "reduced" with these unwritten.
 */
import { expect, test } from "@playwright/test";
import { columns, details, inspector } from "./capture-surface-helpers";
import { dump, eventRows, outbox, recorder, seed } from "./rhythm-probe-helpers";

const U: { name: string; value: unknown }[] = [
  { name: `"64"`, value: "64" },
  { name: `""`, value: "" },
  { name: `"Q"`, value: "Q" },
  { name: "7", value: 7 },
  { name: "true", value: true },
  { name: "absent", value: "__absent__" },
];

for (const u of U) {
  test(`INV-005 ${u.name} reads as unset on every surface and stays`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await recorder(page);
    const { partUrl, songUrl, playUrl } = await seed(page, [{ d: u.value }, { d: u.value }], { bpm: 120 });
    const before = await dump(page);
    const boxBefore = (await outbox(page)).length;

    await page.goto(playUrl);
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    await expect(page.getByTestId("tab-rhythm")).toHaveCount(0);
    await expect(page.getByTestId("click-follow")).toHaveCount(0);
    await expect(page.getByTestId("click-state")).toHaveText("Click is a plain beat.");

    await page.goto(songUrl);
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    await expect(page.getByTestId("tab-rhythm")).toHaveCount(0);
    await page.getByRole("button", { name: "compact" }).click();
    await expect(page.getByTestId("tab-rhythm")).toHaveCount(0);

    await page.goto(partUrl);
    await columns(page).first().click();
    await expect(page.getByTestId("cursor-duration")).toHaveCount(0);
    await details(page).click();
    await expect(inspector(page)).toBeVisible();
    const pressed = await page
      .getByTestId("duration-row")
      .getByRole("button")
      .evaluateAll((els) => els.filter((el) => el.getAttribute("aria-pressed") === "true").length);
    expect(pressed).toBe(0);
    expect(await dump(page), "reading rewrote something").toBe(before);
    expect((await outbox(page)).length).toBe(boxBefore);

    await page.getByTestId("duration-row").getByRole("button", { name: "eighth note" }).click();
    await expect(
      page.getByTestId("duration-row").getByRole("button", { name: "eighth note" }),
    ).toHaveAttribute("aria-pressed", "true");
    const rows = (await eventRows(page)).sort((a, b) => (a.rank as string < (b.rank as string) ? -1 : 1));
    expect(rows[0].durationHint).toBe("8");
    if (u.value === "__absent__") expect("durationHint" in rows[1]).toBe(false);
    else expect(rows[1].durationHint).toBe(u.value);
    expect(errors).toEqual([]);
  });
}
