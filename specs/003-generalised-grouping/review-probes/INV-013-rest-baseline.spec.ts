/**
 * INV-013, the question its failures raise: is a clipped string this branch's doing? Reports the
 * band, the content and each row's overflow at rest for 4, 5 and 6 strings x {nothing above the
 * staff, a triplet bracket, a triplet bracket and a chord row}, and how far scrolling recovers it.
 * The script uses only what main also has (space, the triplet button, the chord form), so it
 * runs unchanged against a build of main: PROBE_PORT and an already-running server decide which.
 * It reports and does not assert; the number is what's compared.
 */
import { expect, test } from "@playwright/test";
import { addRests, setChordOn, startWith, triplet, TUNINGS } from "./probe-helpers";

// Seven strings is beyond what INV-013 names: read for the follow-up, not judged.
const SEVEN = { family: "Guitar 7", preset: "B Standard", strings: 7 };

for (const tuning of [...TUNINGS, SEVEN]) {
  for (const state of ["bare", "bracket", "bracket and chord", "chord form open"] as const) {
    test(`${tuning.strings} strings, ${state}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
      await startWith(page, tuning);
      await addRests(page, 3);
      if (state === "chord form open") {
        await page.getByRole("button", { name: "chord symbol" }).click();
        await expect(page.getByLabel("Chord")).toBeVisible();
      } else if (state !== "bare") {
        await triplet(page).click();
        await expect(page.getByTestId("tab-staff").getByText("3", { exact: true })).toHaveCount(1);
      }
      if (state === "bracket and chord") await setChordOn(page, 0, "Am");
      const report = await page.evaluate(() => {
        const staff = document.querySelector('[data-testid="tab-staff"]')!;
        let scroller = staff.parentElement as HTMLElement | null;
        while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
          scroller = scroller.parentElement;
        }
        const band = scroller!.getBoundingClientRect();
        const rows = () =>
          [...staff.querySelector('[data-testid="tab-column"]')!.querySelectorAll(".tab-cell")].map(
            (c) => {
              const r = c.getBoundingClientRect();
              return Math.round(Math.max(band.top - r.top, r.bottom - band.bottom) * 10) / 10;
            },
          );
        const atRest = rows();
        const start = scroller!.scrollTop;
        scroller!.scrollTop = -10000;
        const scrolledUp = rows();
        scroller!.scrollTop = 10000;
        const scrolledDown = rows();
        scroller!.scrollTop = start;
        return {
          band: band.height,
          clientHeight: scroller!.clientHeight,
          scrollHeight: scroller!.scrollHeight,
          staff: staff.getBoundingClientRect().height,
          atRest,
          scrolledUp,
          scrolledDown,
        };
      });
      console.log(JSON.stringify({ strings: tuning.strings, state, ...report }));
    });
  }
}
