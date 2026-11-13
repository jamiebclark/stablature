/**
 * Review probe (round 3), INV-008 and INV-009 over the flag members that round 2's probes did not reach.
 *
 * Round 2's fix (T064) made the staff flag a 7×4 straight stroke at a 4.05px step. The saved probes measure it on the
 * song page (expanded) on both pointers and in capture on touch only. This one runs the same stroke-inclusive ink
 * measure, and INV-009's least gap between stacked flag strokes, on every surface that draws a staff with rhythm:
 *   Surf {song expanded, song compact, play (wrapped), print of the song page, print of the play view, capture} × Sz,
 * so capture on a fine pointer and print are now measured too.
 *
 * The set per surface: every Sym member alone in its beat with the lowest string fretted at 12 (the label present),
 * and again with only the highest string fretted (the label absent, so the ceiling is the empty cell's mask bottom);
 * a counted group still being built for each flag count; and the shuffle triplet (q, 8), whose eighth is flagged
 * under the bracket on the group's labelled column.
 *
 * Asserted per drawn note, as in INV-008-flags-clear-label-and-bracket.spec.ts:
 *   1. no part's ink rises above the stem band's top;
 *   2. under a bracket, every beam, stub and flag ends at least 1px above the bracket line;
 *   3. the line ends above the numeral; the numeral ends 2px above the column's bottom and is 12px or more.
 * And INV-009: the least distance between adjacent flag strokes, off the stem, is at least one beam (2px).
 *
 *   npx playwright test --config specs/009-rhythm-notation/review-probes/playwright.review.config.ts \
 *     INV-008-INV-009-flags-every-surface < /dev/null
 */
import { expect, test, type Page } from "@playwright/test";
import { seed, type Col } from "../../../e2e/rhythm-probe-helpers";
import { openTools } from "../../../e2e/usability-helpers";

test.setTimeout(300_000);

const LOW = { 0: 12, 1: 12, 2: 12, 3: 12, 4: 12, 5: 12 };
const HIGH = { 0: 12 };
const n = (d: string, frets: Col["frets"]): Col => ({ d, frets });
const r = (d: string): Col => ({ d, kind: "rest", frets: {} });
const bar: Col = { kind: "barline" };
const building = (d: string, id: string): Col[] =>
  [0, 1, 2].map(() => ({ d, frets: LOW, tupletId: id, tupletCount: 5, groupKind: "tuplet" as const }));
const lone = (frets: Col["frets"]): Col[] => [
  n("q", frets), n("8", frets), n("q", frets), bar,
  n("q", frets), n("16", frets), n("q", frets), bar,
  n("q", frets), n("32", frets), n("q", frets), bar,
  n("w", frets), bar, n("h", frets), n("h", frets), bar,
];

const LIST: Col[] = [
  ...lone(LOW),
  ...lone(HIGH),
  r("w"), bar, r("h"), r("h"), bar,
  r("q"), r("8"), r("16"), r("32"), bar,
  ...building("8", "g8"), bar,
  ...building("16", "g16"), bar,
  ...building("32", "g32"), bar,
  { d: "q", frets: LOW, tupletId: "sh", tupletCount: 3, groupKind: "tuplet" },
  { d: "8", frets: LOW, tupletId: "sh", tupletCount: 3, groupKind: "tuplet" },
];

type Surface = "song expanded" | "song compact" | "play" | "print song" | "print play" | "capture";
const SURFACES: Surface[] = ["song expanded", "song compact", "play", "print song", "print play", "capture"];

const measure = (page: Page) =>
  page.evaluate(() => {
    const bad: string[] = [];
    const gaps: { duration: string; levels: number; minGap: number }[] = [];
    let notes = 0;
    let flagged = 0;
    let underBracket = 0;
    let present = 0;
    let absent = 0;
    const ink = (el: Element) => {
      if (el instanceof SVGSVGElement) {
        let top = Infinity, bottom = -Infinity;
        for (const path of Array.from(el.querySelectorAll("path"))) {
          const m = path.getScreenCTM()!;
          const w = (parseFloat(getComputedStyle(path).strokeWidth) * Math.hypot(m.a, m.b)) / 2;
          const len = path.getTotalLength();
          for (let i = 0; i <= 200; i++) {
            const p = path.getPointAtLength((len * i) / 200);
            const y = m.b * p.x + m.d * p.y + m.f;
            top = Math.min(top, y - w);
            bottom = Math.max(bottom, y + w);
          }
        }
        return { top, bottom };
      }
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom };
    };
    for (const staff of Array.from(document.querySelectorAll("[data-testid=tab-staff]"))) {
      Array.from(staff.querySelectorAll("[data-testid=tab-column]")).forEach((col, index) => {
        const cell = col.querySelector("[data-testid=tab-rhythm]");
        const duration = cell?.getAttribute("data-duration");
        if (!cell || !duration) return;
        notes++;
        const where = `column ${index} (${duration})`;
        const cells = Array.from(col.querySelectorAll(".tab-cell"));
        const lowest = cells.at(-1)!;
        const lc = lowest.getBoundingClientRect();
        const text = parseFloat(getComputedStyle(lowest).fontSize);
        const bandTop = lc.bottom - (lc.height - text) / 2;
        const span = lowest.querySelector(":scope > span")?.getBoundingClientRect();
        const ceiling = span ? Math.max(span.bottom, bandTop) : bandTop;
        if (cell.querySelector("[data-part=stem]")) {
          if (span) present++;
          else absent++;
        }
        for (const part of Array.from(cell.querySelectorAll("[data-part]"))) {
          const k = ink(part);
          const name = `${part.getAttribute("data-part")}${part.getAttribute("data-level") ?? ""}`;
          if (k.top < ceiling - 0.5)
            bad.push(`${where}: ${name} ink top is ${(ceiling - k.top).toFixed(2)}px above the stem band (label ${span ? "present" : "absent"})`);
        }
        const bracket = cell.querySelector(".tab-bracket");
        const label = cell.querySelector(".tab-bracket-label") as HTMLElement | null;
        const flags = Array.from(cell.querySelectorAll("svg[data-part=flag]")) as SVGSVGElement[];
        if (flags.length) flagged++;
        if (bracket) {
          const lineTop = bracket.getBoundingClientRect().bottom - 1;
          for (const part of Array.from(cell.querySelectorAll("[data-part=beam], [data-part=stub], [data-part=flag]"))) {
            if (part.getAttribute("data-part") === "flag") underBracket++;
            const k = ink(part);
            if (k.bottom > lineTop - 1 + 0.25)
              bad.push(`${where}: ${part.getAttribute("data-part")}${part.getAttribute("data-level")} ink bottom ${(lineTop - k.bottom).toFixed(2)}px from the bracket line`);
          }
          if (label && bracket.getBoundingClientRect().bottom > label.getBoundingClientRect().top + 0.5) bad.push(`${where}: bracket line crosses the numeral`);
        }
        if (label) {
          const l = label.getBoundingClientRect();
          const c = col.getBoundingClientRect();
          if (l.bottom > c.bottom - 2 + 0.5) bad.push(`${where}: numeral bottom within 2px of the column's bottom`);
          if (parseFloat(getComputedStyle(label).fontSize) < 12) bad.push(`${where}: numeral under 12px`);
        }
        if (flags.length >= 2) {
          const stem = cell.querySelector("[data-part=stem]")!.getBoundingClientRect();
          const stemX = stem.left + stem.width / 2;
          const lines = flags.map((svg) => {
            const path = svg.querySelector("path") as SVGPathElement;
            const m = path.getScreenCTM()!;
            const len = path.getTotalLength();
            const width = parseFloat(getComputedStyle(path).strokeWidth) * Math.hypot(m.a, m.b);
            const pts = Array.from({ length: 121 }, (_, i) => {
              const p = path.getPointAtLength((len * i) / 120);
              return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
            });
            return { pts, width };
          });
          let minGap = Infinity;
          for (let k = 0; k + 1 < lines.length; k++)
            for (const a of lines[k].pts) {
              if (Math.abs(a.x - stemX) < 1.5) continue;
              for (const b of lines[k + 1].pts) {
                if (Math.abs(b.x - stemX) < 1.5) continue;
                minGap = Math.min(minGap, Math.hypot(a.x - b.x, a.y - b.y) - (lines[k].width + lines[k + 1].width) / 2);
              }
            }
          gaps.push({ duration, levels: flags.length, minGap: Math.round(minGap * 100) / 100 });
          if (minGap < 2 - 0.01) bad.push(`${where}: least gap between stacked flags ${minGap.toFixed(2)} < 2`);
        }
      });
    }
    return { bad, gaps, notes, flagged, underBracket, present, absent };
  });

for (const surface of SURFACES)
  test(`INV-008 INV-009 flags on ${surface}`, async ({ page }, info) => {
    const urls = await seed(page, LIST, { bpm: 120 });
    const url = surface === "capture" ? urls.partUrl : surface.includes("play") ? urls.playUrl : urls.songUrl;
    await page.goto(url);
    await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
    if (surface === "song compact") {
      await openTools(page);
      await page.getByRole("button", { name: "compact" }).click();
      await page.waitForTimeout(150);
    }
    if (surface.startsWith("print")) await page.emulateMedia({ media: "print" });
    const states = surface === "capture"
      ? ["end", ...(await page.getByTestId("tab-column").evaluateAll((els) =>
          els.map((el, i) => (el.querySelector(".tab-bracket-label") ? String(i) : "")).filter(Boolean)))]
      : ["-"];
    const failures: string[] = [];
    for (const state of states) {
      if (state !== "end" && state !== "-") await page.getByTestId("tab-column").nth(Number(state)).click();
      await page.waitForTimeout(150);
      const got = await measure(page);
      console.log(info.project.name, surface, `cursor ${state}`, JSON.stringify({ notes: got.notes, flagged: got.flagged, underBracket: got.underBracket, present: got.present, absent: got.absent, gaps: got.gaps }));
      // The probe must have measured what it claims: flagged notes, flags under a bracket, and stacked flags.
      if (got.notes < 30) failures.push(`cursor ${state}: only ${got.notes} notes measured`);
      if (got.underBracket < 4) failures.push(`cursor ${state}: only ${got.underBracket} flags under a bracket`);
      if (got.gaps.length < 4) failures.push(`cursor ${state}: only ${got.gaps.length} stacked-flag notes`);
      // Both members of {a note on the lowest string, none there}.
      if (got.present === 0 || got.absent === 0) failures.push(`cursor ${state}: stems with the lowest label present ${got.present}, absent ${got.absent}`);
      for (const b of got.bad) failures.push(`cursor ${state}: ${b}`);
    }
    expect([...new Set(failures)]).toEqual([]);
  });
