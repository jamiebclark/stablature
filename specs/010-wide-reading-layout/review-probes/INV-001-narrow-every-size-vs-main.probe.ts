/**
 * INV-001 (review round 3): below 768 both pages lay out as on `main`, over the WHOLE of Wn x Ptr, not only the three
 * sizes `e2e/fixtures/narrow-before.json` recorded (375 touch, 412 touch, 767 mouse). Rounds 1 and 2 left 320, 375/412
 * with a mouse and 767 on touch unchecked against `main` (FU5).
 *
 * Two modes, one file, so the recording and the check measure the same way:
 *   - INV001_RECORD=1, served from a built export of `main` (playwright.baseline.config.ts): writes
 *     INV-001-main-narrow/<size>.json, holding each page's card/staff/column/run rects and a sha256 of `main`'s
 *     normalised markup. The markup itself goes to os.tmpdir() for diffing, as it is megabytes.
 *   - default, served from this tree's build (probe.config.ts): the same four songs x two pages, in dark and light, must
 *     equal that recording: (a) every rect within 0.5px, (b) the normalised markup's hash, (c) no wrapped song-page staff
 *     and each li spanning its list. Normalisation is wide-narrow-unchanged.spec.ts's, applied on both sides.
 *
 *   BASELINE_DIR=<built main> INV001_RECORD=1 npx playwright test -c specs/010-wide-reading-layout/review-probes/playwright.baseline.config.ts
 *   npx playwright test -c specs/010-wide-reading-layout/review-probes/probe.config.ts INV-001-narrow-every-size-vs-main
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedSong, type EntrySpec, type PartSpec } from "../../../e2e/reading-helpers";
import { plainBars as bars, FIT_PARTS } from "../../../e2e/wide-helpers";

test.setTimeout(600_000);

const RECORD = process.env.INV001_RECORD === "1";
const DIR = path.join(__dirname, "INV-001-main-narrow");

/** The four songs of the fixture: none has a repeated entry. */
const SONGS: Record<string, { parts: PartSpec[]; entries: EntrySpec[] }> = {
  one: { parts: [{ key: "a", label: "A", columns: bars(3) }], entries: [{ part: "a" }] },
  "fit-once": { parts: FIT_PARTS, entries: [{ part: "a" }, { part: "a2" }, { part: "b" }, { part: "c" }] },
  variant: {
    parts: [
      { key: "a", label: "A", columns: bars(3) },
      { key: "a2", label: "A'", variantOf: "a", columns: bars(3, 4) },
    ],
    entries: [{ part: "a" }, { part: "a2" }],
  },
  sliced: { parts: [{ key: "a", label: "A", columns: bars(4) }], entries: [{ part: "a", fromBar: 2, toBar: 3 }] },
};

/** Wn x Ptr: every narrow width with a mouse and with touch. */
const HEIGHT: Record<number, number> = { 320: 568, 375: 667, 412: 915, 767: 1024 };
const SIZES = [320, 375, 412, 767].flatMap((width) =>
  [true, false].map((touch) => ({ name: `${width}x${HEIGHT[width]}-${touch ? "touch" : "mouse"}`, width, height: HEIGHT[width], touch })),
);

type Rects = Record<string, number[][]>;
interface Page1 {
  hash: string;
  length: number;
  rects: Rects;
}

const context = (browser: Browser, baseURL: string, s: { width: number; height: number; touch: boolean }) =>
  browser.newContext({ baseURL, viewport: { width: s.width, height: s.height }, hasTouch: s.touch, isMobile: s.touch });

/** wide-narrow-unchanged.spec.ts's normalisation: spec 010's additions and per-run identifiers removed. */
const normalized = (page: Page) =>
  page.evaluate(() => {
    const doc = new DOMParser().parseFromString(`<body>${document.querySelector("main")!.outerHTML}</body>`, "text/html");
    const drop =
      '[data-testid="card-number"], [data-testid^="card-passes"], [data-testid="card-bars"], [data-testid="tab-ruler"], [data-testid="click-bar"]';
    doc.querySelectorAll(drop).forEach((el) => el.remove());
    doc.querySelectorAll("*").forEach((el) => {
      for (const a of ["id", "for", "aria-controls", "aria-labelledby", "aria-describedby", "data-card", "data-first-pass", "data-last-pass"]) {
        el.removeAttribute(a);
      }
      const keep = [...el.classList].filter((c) => c !== "reading-cards" && c !== "reading-card" && !c.startsWith("wide:"));
      if (keep.length) el.setAttribute("class", keep.join(" "));
      else el.removeAttribute("class");
    });
    return doc.body.innerHTML.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "UUID");
  });

const rects = (page: Page) =>
  page.evaluate(() => {
    const r = (x: number) => Math.round(x * 10) / 10;
    const out: Record<string, number[][]> = {};
    const groups: Record<string, string> = {
      card: "main ol.grid > li, main ul.grid > li",
      staff: ".tab-staff",
      column: '[data-testid="tab-column"]',
      run: ".tab-bar-run",
    };
    for (const [name, sel] of Object.entries(groups)) {
      out[name] = [...document.querySelectorAll(sel)].map((el) => {
        const b = el.getBoundingClientRect();
        return [r(b.left + scrollX), r(b.top + scrollY), r(b.width), r(b.height)];
      });
    }
    return out;
  });

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

for (const size of SIZES) {
  for (const colorScheme of RECORD ? (["light"] as const) : (["dark", "light"] as const)) {
    test(`INV-001 narrow equals main ${size.name} ${colorScheme}`, async ({ browser, baseURL }, info) => {
      test.skip(info.project.name !== "desktop", "each test sets its own viewport and pointer");
      const file = path.join(DIR, `${size.name}.json`);
      const before: Record<string, Page1> = RECORD ? {} : JSON.parse(readFileSync(file, "utf8"));
      const failures: string[] = [];
      for (const [song, spec] of Object.entries(SONGS)) {
        const ctx = await context(browser, baseURL!, size);
        const page = await ctx.newPage();
        await page.emulateMedia({ colorScheme });
        const { songUrl, playUrl } = await seedSong(page, spec.parts, spec.entries);
        for (const [pageName, url] of [["song", songUrl], ["play", playUrl]] as const) {
          const key = `${song} | ${pageName}`;
          await page.goto(url);
          await expect(page.getByTestId("tab-staff").first()).toBeVisible();
          await page.waitForTimeout(300);
          const html = await normalized(page);
          const now: Page1 = { hash: sha(html), length: html.length, rects: await rects(page) };
          if (RECORD) {
            before[key] = now;
            const tmp = path.join(os.tmpdir(), "spec010-INV-001-main");
            mkdirSync(tmp, { recursive: true });
            writeFileSync(path.join(tmp, `${size.name} ${song} ${pageName}.html`), html);
            continue;
          }
          const was = before[key];
          if (!was) {
            failures.push(`${key}: not recorded`);
            continue;
          }
          // (a) geometry
          for (const name of Object.keys(was.rects)) {
            if (now.rects[name].length !== was.rects[name].length) {
              failures.push(`${key} ${name}: ${now.rects[name].length} drawn, main drew ${was.rects[name].length}`);
              continue;
            }
            now.rects[name].forEach((rect, i) =>
              rect.forEach((v, j) => {
                const d = Math.abs(v - was.rects[name][i][j]);
                if (d > 0.5) failures.push(`${key} ${name}[${i}][${j}] ${v} vs main ${was.rects[name][i][j]}`);
              }),
            );
          }
          // (b) markup
          if (now.hash !== was.hash) {
            const tmp = path.join(os.tmpdir(), "spec010-INV-001-now");
            mkdirSync(tmp, { recursive: true });
            writeFileSync(path.join(tmp, `${size.name} ${colorScheme} ${song} ${pageName}.html`), html);
            failures.push(`${key} markup: ${now.length} chars vs main ${was.length} (written to ${tmp})`);
          }
          // (c) the song page never wraps, and each li spans its list
          if (pageName === "song") {
            const wrapped = await page.locator(".tab-staff-wrapped").count();
            if (wrapped) failures.push(`${key}: ${wrapped} wrapped staves`);
            const off = await page.evaluate(() => {
              const ul = document.querySelector("main ul.grid")!.getBoundingClientRect();
              return Math.max(
                ...[...document.querySelectorAll("main ul.grid > li")].map((li) => {
                  const b = li.getBoundingClientRect();
                  return Math.max(Math.abs(b.left - ul.left), Math.abs(b.right - ul.right));
                }),
              );
            });
            if (off > 0.5) failures.push(`${key}: an li is ${off}px off its list's edge`);
          }
        }
        await ctx.close();
      }
      if (RECORD) {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(file, JSON.stringify(before) + "\n");
        expect(existsSync(file)).toBe(true);
        return;
      }
      console.log(`${size.name} ${colorScheme}: ${failures.length} differences`);
      expect(failures, failures.slice(0, 20).join("\n")).toEqual([]);
    });
  }
}
