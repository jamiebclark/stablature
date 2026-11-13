/**
 * Review probe on the song page, through a production build:
 * - INV-007: every stem, rest and oval centre within 1px of its note's centre (the column's centre where it has no
 *   fret label), over Wid {none, a chord-widened column, a two-digit fret, a `x4` compact cell} × View {frets, notes,
 *   intervals, switched with no reload} × Dens {expanded, compact} × Sz.
 * - INV-006: every beam half runs from its column's edge to its stem within 1px, and across a connector gap the
 *   spacer's beams meet both neighbours' halves within 1px, at the same height.
 * - INV-013: the staff's accessibility snapshot with durations equals the same staff's with none, once the duration
 *   words already in each column's description are taken out.
 * The landed `notation-alignment.spec.ts` covers neither the views, nor a chord, nor a connector.
 */
import { expect, test, type Page } from "@playwright/test";
import { addChord } from "../../../e2e/capture-surface-helpers";
import { openTools } from "../../../e2e/usability-helpers";
import { seed, writeColumns, type Col } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(600_000);

const LIST: Col[] = [
  { d: "8", frets: { 0: 5 } },
  { d: "8", frets: { 0: 12 } },
  // A slide between two sixteenths of one beat (1.0 and 1.25): the beam must run through its gap.
  { d: "16", frets: { 0: 14 } },
  { d: "16", frets: { 0: 7 }, techniques: { 0: ["slide_down"] } },
  { kind: "barline" },
  { d: "8", frets: { 1: 3 } },
  { d: "8", frets: { 1: 5 } },
  { d: "16", frets: { 1: 7 }, repeat: 4 },
  { kind: "barline" },
  { d: "h", frets: { 2: 5 } },
  { d: "h", kind: "rest", frets: {} },
  { kind: "barline" },
  { d: "w", frets: { 3: 2 } },
  { kind: "barline" },
  { d: "w", kind: "rest", frets: {} },
];
const CHORD_AT = 5;

const geometry = (page: Page) =>
  page.getByTestId("tab-staff").first().evaluate((staff) => {
    const bad: string[] = [];
    const nodes = Array.from(staff.querySelectorAll("[data-testid=tab-column], [data-testid=tab-connector], [data-testid=tab-removal]"));
    const stemX = new Map<Element, number>();
    let gaps = 0;
    nodes.forEach((el, i) => {
      if (el.getAttribute("data-testid") !== "tab-column") return;
      const col = el.getBoundingClientRect();
      const span = el.querySelector(".tab-cell > span");
      const centre = span ? span.getBoundingClientRect().left + span.getBoundingClientRect().width / 2 : col.left + col.width / 2;
      const r = el.querySelector("[data-testid=tab-rhythm]");
      if (!r) return;
      for (const p of Array.from(r.querySelectorAll("[data-part=stem], [data-part=rest], [data-part=oval]"))) {
        const q = p.getBoundingClientRect();
        const off = q.left + q.width / 2 - centre;
        if (Math.abs(off) > 1) bad.push(`node ${i} ${p.getAttribute("data-part")} off its note by ${off.toFixed(2)}`);
        if (p.getAttribute("data-part") === "stem") stemX.set(el, q.left + q.width / 2);
      }
      const stem = stemX.get(el);
      for (const b of Array.from(r.querySelectorAll("[data-part=beam][data-side]"))) {
        const q = b.getBoundingClientRect();
        const side = b.getAttribute("data-side");
        if (stem === undefined) continue;
        if (side === "left" && (Math.abs(q.left - col.left) > 1 || Math.abs(q.right - stem) > 1))
          bad.push(`node ${i} left half ${q.left.toFixed(1)}-${q.right.toFixed(1)} vs edge ${col.left.toFixed(1)} stem ${stem.toFixed(1)}`);
        if (side === "right" && (Math.abs(q.left - stem) > 1 || Math.abs(q.right - col.right) > 1))
          bad.push(`node ${i} right half ${q.left.toFixed(1)}-${q.right.toFixed(1)} vs stem ${stem.toFixed(1)} edge ${col.right.toFixed(1)}`);
      }
      // A gap before this column: its spacer's beams meet both halves.
      const prev = nodes[i - 1];
      if (prev && prev.getAttribute("data-testid") !== "tab-column") {
        const before = nodes[i - 2];
        const levels = Number(r.getAttribute("data-beams-left") ?? 0);
        const spacer = Array.from(prev.querySelectorAll(".tab-rhythm [data-part=beam]")).map((b) => b.getBoundingClientRect());
        if (levels > 0) gaps++;
        if (spacer.length !== levels) bad.push(`node ${i - 1} gap holds ${spacer.length} beams, the arriving column shares ${levels}`);
        for (const s of spacer) {
          const mine = Array.from(r.querySelectorAll("[data-part=beam][data-side=left]")).map((b) => b.getBoundingClientRect());
          const theirs = before ? Array.from(before.querySelectorAll("[data-part=beam][data-side=right]")).map((b) => b.getBoundingClientRect()) : [];
          if (!mine.some((m) => Math.abs(m.left - s.right) <= 1 && Math.abs(m.top - s.top) <= 1)) bad.push(`node ${i - 1} spacer beam does not meet the arriving half`);
          if (!theirs.some((t) => Math.abs(t.right - s.left) <= 1 && Math.abs(t.top - s.top) <= 1)) bad.push(`node ${i - 1} spacer beam does not meet the departing half`);
        }
      }
    });
    const widened = (staff.querySelectorAll("[data-testid=tab-column]")[5] as HTMLElement | undefined)?.getBoundingClientRect().width ?? 0;
    const plain = (staff.querySelectorAll("[data-testid=tab-column]")[0] as HTMLElement | undefined)?.getBoundingClientRect().width ?? 0;
    return { bad, stems: stemX.size, widened, plain, gaps };
  });

async function pickView(page: Page, v: string) {
  const control = page.getByTestId(`staff-view-${v}`);
  if (!(await control.isVisible())) await openTools(page);
  await control.click();
  await expect(control).toHaveAttribute("aria-pressed", "true");
}

for (const size of [
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
])
  test(`INV-006 INV-007 song page at ${size.width}: Wid × View × Dens`, async ({ page }) => {
    await page.setViewportSize(size);
    const urls = await seed(page, LIST, { bpm: 120 });
    await page.goto(urls.partUrl);
    // Two chords side by side: the first has no room to spill into, so its column widens.
    await addChord(page, CHORD_AT, "Cmaj7#11");
    await addChord(page, CHORD_AT + 1, "Dm7b5");
    const failures: string[] = [];
    for (const density of ["expanded", "compact"] as const) {
      await page.goto(urls.songUrl);
      await expect(page.getByTestId("tab-column").first()).toBeVisible();
      if (density === "compact") {
        await openTools(page);
        await page.getByRole("button", { name: "compact" }).click();
      }
      for (const v of ["frets", "notes", "intervals", "frets"]) {
        await pickView(page, v);
        await page.waitForTimeout(100);
        const g = await geometry(page);
        if (g.stems === 0) failures.push(`${density} ${v}: no stems measured`);
        if (g.gaps === 0) failures.push(`${density} ${v}: no beamed connector gap measured`);
        if (!(g.widened > g.plain + 4)) failures.push(`${density} ${v}: chord column not widened (${g.widened} vs ${g.plain})`);
        for (const b of g.bad) failures.push(`${density} ${v}: ${b}`);
      }
    }
    expect(failures).toEqual([]);
  });

test("INV-013 the staff reads the same to a screen reader with and without durations", async ({ page }) => {
  const urls = await seed(page, LIST, { bpm: 120 });
  await page.goto(urls.songUrl);
  const staff = page.getByTestId("tab-staff").first();
  await expect(staff).toHaveAttribute("data-rhythm", "");
  const words = /, (whole|half|quarter|eighth|sixteenth|thirty-second) note/g;
  const withRhythm = (await staff.ariaSnapshot()).replace(words, "");
  await writeColumns(page, urls.partId, LIST.map((c) => ({ ...c, d: null })));
  await page.goto(urls.songUrl);
  await expect(page.getByTestId("tab-staff").first()).not.toHaveAttribute("data-rhythm", "");
  const without = await page.getByTestId("tab-staff").first().ariaSnapshot();
  expect(withRhythm).toBe(without);
});
