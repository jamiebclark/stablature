/**
 * Out of scope for 006, kept as the evidence for its follow-up. Named `OOS-` so `run-probes.sh` does not count it
 * against an invariant. Run it with PROBE_MATCH='OOS-.*\.spec\.ts$'.
 *
 * `layout.tsx` says JetBrains Mono carries the tablature. It does not: `.tab-staff` asks for `var(--font-mono)`,
 * which `:root` declares from `--font-mono-face`, and `<body>` is the only element that has `--font-mono-face`. The
 * declaration is invalid at computed time, so the staff inherits the system stack. `.font-mono` utilities are
 * fine, because `@theme inline` writes the value straight into them. Same on `main`.
 */
import { expect, test } from "@playwright/test";
import { n, seedSong } from "./helpers";

test("the staff is painted in the face the layout names", async ({ page }) => {
  await seedSong(page, [{ key: "a", label: "A", columns: [n(5)] }], [{ part: "a" }]);
  const family = await page.evaluate(() => getComputedStyle(document.querySelector(".tab-staff")!).fontFamily);
  expect(family).toContain("JetBrains");
});
