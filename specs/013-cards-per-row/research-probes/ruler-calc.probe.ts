/**
 * Spec 013 research R3: the 16-bar part's ruler measures 0px. Is a long `calc()` sum dropped by the engine, from how
 * many column terms, and does it matter that `--staff-ch` is a registered `<length>` set to `1ch`? Static HTML, no app.
 * Run with mech.config.ts. A 0 in the output is a dropped declaration.
 */
import { test } from "@playwright/test";
import { writeFileSync } from "node:fs";

/** One column's terms, as `widthTerms` writes them for a one-digit column. */
const term = "1 * var(--staff-ch) + var(--col-pad)";
/** The ruler as `rulerWidth` writes it today: one flat sum. */
const flat = (n: number) =>
  `calc(${[...Array(n).fill(term), "0 * var(--staff-ch)", "0 * 3 * var(--staff-ch)", "var(--gutter)"].join(" + ")})`;
/** The same sum, nested by groups of 8 columns. */
const grouped = (n: number) => {
  const groups: string[] = [];
  for (let i = 0; i < n; i += 8) groups.push(`calc(${Array(Math.min(8, n - i)).fill(term).join(" + ")})`);
  return `calc(${[...groups, "0 * var(--staff-ch)", "0 * 3 * var(--staff-ch)", "var(--gutter)"].join(" + ")})`;
};
/** The same sum with the like terms collected: one ch count and one pad count (what a fix could write). */
const collected = (n: number) => `calc(${n} * var(--staff-ch) + ${n} * var(--col-pad) + var(--gutter))`;

const REGISTERED = `<style>@property --staff-ch { syntax: "<length>"; inherits: true; initial-value: 0px; }</style>`;
const HOSTS: Record<string, { pre: string; host: string }> = {
  px: { pre: "", host: "--staff-ch: 8.4px;" },
  ch: { pre: "", host: "--staff-ch: 1ch;" },
  registeredCh: { pre: REGISTERED, host: "--staff-ch: 1ch;" },
};

test("long calc sums", async ({ page, browserName }) => {
  const counts = [8, 16, 24, 32, 39, 40, 44, 48, 49, 56, 64, 79, 100, 160, 320];
  const out: Record<string, number[]> = {};
  for (const [hostName, { pre, host }] of Object.entries(HOSTS)) {
    for (const [name, f] of [["flat", flat], ["grouped", grouped], ["collected", collected]] as const) {
      const key = `${hostName}/${name}`;
      out[key] = [];
      for (const n of counts) {
        await page.setContent(
          `${pre}<div style="font: 14px monospace; --col-pad: 0.6rem; --gutter: 1.75rem; position: relative; ${host}">` +
            `<div id="r" style="position: absolute; height: 0; width: ${f(n)}"></div></div>`,
        );
        out[key].push(await page.evaluate(() => Math.round(document.getElementById("r")!.getBoundingClientRect().width * 10) / 10));
      }
    }
  }
  writeFileSync(
    `specs/013-cards-per-row/research-probes/ruler-calc.${browserName}.json`,
    JSON.stringify({ counts, ...out }, null, 1) + "\n",
  );
});
