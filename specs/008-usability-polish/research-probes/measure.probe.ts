/**
 * Research probe for spec 008 (research.md R1, R6, R7). Measures, on the production build:
 * the capture band and one staff line at four sizes with six strings, a chord row and a bracket;
 * the top bar's spare room at 375; and the widths of candidate words in the status row and header.
 */
import { expect, test, type Page } from "@playwright/test";
import { addChord, selectColumns, space, startWith, tupletControl } from "../../../e2e/probe-helpers";

const SIZES = [
  { w: 375, h: 667 },
  { w: 390, h: 844 },
  { w: 412, h: 915 },
  { w: 1280, h: 800 },
];

async function band(page: Page) {
  return page.evaluate(() => {
    const band = document.querySelector('[data-testid="tab-band"]') as HTMLElement;
    const staff = document.querySelector('[data-testid="tab-staff"]') as HTMLElement;
    const line = (staff.querySelector(".flex.w-max") ?? staff.querySelector(".tab-bar-run") ?? staff) as HTMLElement;
    const runs = new Set([...staff.querySelectorAll<HTMLElement>(".tab-bar-run")].map((r) => Math.round(r.getBoundingClientRect().top))).size;
    const cs = getComputedStyle(band);
    const rows = Object.fromEntries(
      ["capture-title-row", "status-row", "toolbar-stable", "toolbar-contextual", "toolbar-reserved", "latch-strip", "fret-grid"].map((id) => [
        id,
        Math.round((document.querySelector(`[data-testid="${id}"]`)?.getBoundingClientRect().height ?? 0) * 10) / 10,
      ]),
    );
    const root = getComputedStyle(document.documentElement);
    return {
      bandOuter: Math.round(band.getBoundingClientRect().height * 10) / 10,
      bandContent: band.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
      staff: Math.round(staff.getBoundingClientRect().height * 10) / 10,
      runs,
      blank: (() => {
        const top = band.getBoundingClientRect().top + parseFloat(cs.paddingTop);
        const bottom = band.getBoundingClientRect().bottom - parseFloat(cs.paddingBottom);
        const inView = [...staff.querySelectorAll<HTMLElement>(".tab-bar-run")].map((r) => r.getBoundingClientRect()).filter((r) => r.bottom > top + 1 && r.top < bottom - 1);
        return Math.round((inView.length ? Math.min(...inView.map((r) => r.top)) - top : bottom - top - staff.getBoundingClientRect().height) * 10) / 10;
      })(),
      line: Math.round(line.getBoundingClientRect().height * 10) / 10,
      tokens: { string: root.getPropertyValue("--string-height"), row: root.getPropertyValue("--staff-row") },
      rows,
    };
  });
}

for (const size of SIZES) {
  test(`band at ${size.w}x${size.h}`, async ({ page, isMobile }) => {
    test.skip(size.w === 1280 ? isMobile : !isMobile, "touch for phones, fine for 1280");
    await startWith(page, { family: "Guitar 6", preset: "E Standard", strings: 6 });
    await page.setViewportSize({ width: size.w, height: size.h });
    for (let b = 0; b < 12; b++) {
      for (let i = 0; i < 3; i++) await space(page);
      await page.getByTestId("toolbar-stable").getByRole("button", { name: "Barline" }).click();
    }
    await addChord(page, 0, "Am");
    await selectColumns(page, 0, 2);
    await tupletControl(page).click();
    await page.getByRole("button", { name: /end/ }).last().click();
    await page.waitForTimeout(500);
    const m = await band(page);
    console.log(`BAND ${size.w}x${size.h} ${JSON.stringify(m)}`);
    expect(m.line).toBeGreaterThan(0);
  });
}

test("text widths and top bar room at 375", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch");
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await page.getByLabel("Band name").fill("Hollow Crown");
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  const bar = await page.evaluate(() => {
    const bar = document.querySelector(".max-w-3xl.justify-between") as HTMLElement;
    const kids = [...bar.children].map((c) => Math.round(c.getBoundingClientRect().width * 10) / 10);
    const right = bar.children[1] as HTMLElement;
    const parts = [...right.children].map((c) => [c.textContent, Math.round(c.getBoundingClientRect().width * 10) / 10]);
    return { bar: bar.getBoundingClientRect().width, kids, parts, padL: getComputedStyle(bar).paddingLeft };
  });
  console.log(`TOPBAR ${JSON.stringify(bar)}`);
  const words = await page.evaluate(() => {
    const out: Record<string, number> = {};
    const measure = (text: string, style: Partial<CSSStyleDeclaration>, key: string) => {
      const s = document.createElement("span");
      Object.assign(s.style, { position: "absolute", whiteSpace: "nowrap", visibility: "hidden" }, style);
      s.textContent = text;
      document.body.appendChild(s);
      out[key] = Math.round(s.getBoundingClientRect().width * 10) / 10;
      s.remove();
    };
    const mono = getComputedStyle(document.querySelector(".font-mono")!).fontFamily;
    const sans = getComputedStyle(document.body).fontFamily;
    const st = { fontSize: "0.7rem" };
    measure("99 unsynced", { ...st, fontFamily: mono }, "mono 99 unsynced");
    measure("14 unsynced", { ...st, fontFamily: mono }, "mono 14 unsynced");
    for (const t of ["saved · sign in", "saved here · sign in", "sign in", "on device · sign in", "local · sign in", "saved, sign in"]) {
      measure(t, { ...st, fontFamily: sans }, `sans ${t}`);
      measure(t, { ...st, fontFamily: mono }, `mono ${t}`);
    }
    for (const t of ["Saved on this device", "Saved on this device.", "Saved here", "14 unsynced", "Sign in"]) {
      measure(t, { fontSize: "0.75rem", fontFamily: sans }, `xs ${t}`);
    }
    for (const t of ["stacking onto the marked column", "adding after the marked column", "a triplet needs three columns in one bar", "stack + hammer-on", "at the end", "dotted sixteenth", "whole note"]) {
      measure(t, { ...st, fontFamily: sans }, `status ${t}`);
    }
    for (const t of ["Dsus4", "F#m7b5/C#", "D G A", "·", "|"]) {
      measure(t, { ...st, fontFamily: mono }, `mono ${t}`);
      measure(t, { ...st, fontFamily: mono, fontWeight: "600" }, `mono600 ${t}`);
    }
    out["fonts"] = 0;
    return { out, mono, sans };
  });
  console.log(`WORDS ${JSON.stringify(words)}`);
});
