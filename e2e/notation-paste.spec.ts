/**
 * INV-001 (paste): the paste preview's markup is the same as before spec 009 drew rhythm notation. The
 * fixture was recorded on the unedited tree with `PASTE_RECORD=1`; every other run compares to it, and fails
 * when the fixture is absent rather than recording over it. It passes on unchanged code by design and can
 * fail only when the preview markup moves.
 */
import { expect, test } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { emptySong, pasteTab, startWith, TUNINGS } from "./import-helpers";

const FIXTURE = "e2e/fixtures/paste-preview-before.json";
const RECORD = process.env.PASTE_RECORD === "1";

const staff = (names: string, bodies: string[]) => bodies.map((b, i) => `${names[i]} |${b}|`).join("\n");
const four = (top: string) => {
  const rails = top.replace(/[^|]/g, "-");
  return staff("GDAE", [top, rails, rails, rails]);
};

/** The import fixtures: plain, five strings, chords and a barline, a long staff, a refused paste. */
const PASTES: Record<string, string> = {
  plain: four("-5-7-"),
  five: staff("GDAEB", ["-5-7-", "-----", "-----", "-----", "-3---"]),
  rich: `    Am\n    ,-3-,\n${four("-5-7-9-|-7-7-7-7-")}`,
  long: four("-5-7-9-12-|-7-7-7-7-|-0-3-5-7-|-2-4-5-7-"),
};

test("INV-001 the paste preview's markup is unchanged", async ({ page }) => {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
  const got: Record<string, string[]> = {};
  for (const [name, text] of Object.entries(PASTES)) {
    await pasteTab(page, text);
    const staves = page.getByTestId("paste-tab").getByTestId("tab-staff");
    await expect(staves.first()).toBeVisible();
    got[name] = await staves.evaluateAll((els) => els.map((e) => e.outerHTML));
  }
  if (RECORD) {
    writeFileSync(FIXTURE, JSON.stringify(got, null, 2) + "\n");
    return;
  }
  const before = JSON.parse(readFileSync(FIXTURE, "utf8"));
  expect(got).toEqual(before);
});
