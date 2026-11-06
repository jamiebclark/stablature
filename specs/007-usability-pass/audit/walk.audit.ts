/**
 * Walks every screen at 375x667 and 390x844 in both themes and records what spec 007's audit table
 * needs: targets under the floors, targets outside the thumb's half, text that truncates or wraps,
 * inputs under 16px, text under 4.5:1, and what an on-screen keyboard would sit on.
 *
 * A desktop browser has no on-screen keyboard, so `keyboard` is geometry against a stated height,
 * not a sighting. The real-phone items in the spec cover what this cannot prove.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { addChord, columns, fret, stackLatch } from "../../../e2e/capture-surface-helpers";
import { addRests, selectColumns, selectionBar, startWith, TUNINGS } from "../../../e2e/probe-helpers";
import { bar, g, n, seedSong, type Col } from "../../../e2e/reading-helpers";

const OUT = path.join(__dirname, "results");
const SIZES = [
  { name: "375x667", width: 375, height: 667, keyboard: 260 },
  { name: "390x844", width: 390, height: 844, keyboard: 336 },
] as const;
const THEMES = ["dark", "light"] as const;

/** Runs in the page. Everything it reads is what a person at this size is given. */
function measure(keyboardHeight: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
  };
  const rgb = (css: string) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const x = c.getContext("2d")!;
    x.clearRect(0, 0, 1, 1);
    x.fillStyle = css;
    x.fillRect(0, 0, 1, 1);
    return Array.from(x.getImageData(0, 0, 1, 1).data);
  };
  const lum = ([r, gr, b]: number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(gr) + 0.0722 * f(b);
  };
  const backdrop = (el: Element) => {
    for (let node: Element | null = el; node; node = node.parentElement) {
      const c = rgb(getComputedStyle(node).backgroundColor);
      if (c[3] > 250) return c;
    }
    return rgb(getComputedStyle(document.body).backgroundColor);
  };
  const ratio = (el: Element) => {
    const [a, b] = [lum(rgb(getComputedStyle(el).color)), lum(backdrop(el))].sort((x, y) => y - x);
    return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
  };
  const name = (el: Element) =>
    (el.getAttribute("aria-label") ?? el.textContent ?? (el as HTMLInputElement).placeholder ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 48);

  const dialog = document.querySelector("dialog[open]");
  const scope: ParentNode = dialog ?? document;
  const targets = [
    ...scope.querySelectorAll("a[href],button,input,select,textarea,[role=button]"),
  ]
    .filter(visible)
    .map((el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        name: name(el),
        testid: el.getAttribute("data-testid"),
        w: Math.round(r.width * 10) / 10,
        h: Math.round(r.height * 10) / 10,
        x: Math.round(r.left),
        y: Math.round(r.top + window.scrollY),
        disabled: (el as HTMLButtonElement).disabled === true,
        font: parseFloat(s.fontSize),
        inFretGrid: !!el.closest('[data-testid="fret-grid"]'),
        isColumn: el.getAttribute("data-testid") === "tab-column",
        topHalf: r.top + r.height / 2 + window.scrollY < vh / 2,
        beyondFold: r.top + window.scrollY > vh,
      };
    });

  const text: { text: string; font: number; ratio: number; cls: string }[] = [];
  const clipped: { text: string; kind: string; over: number }[] = [];
  const wrapped: { text: string; lines: number }[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set<Element>();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || seen.has(el) || !node.textContent?.trim() || !visible(el)) continue;
    if (el.closest("script,style,noscript")) continue;
    seen.add(el);
    text.push({
      text: name(el),
      font: parseFloat(getComputedStyle(el).fontSize),
      ratio: ratio(el),
      cls: (el.className as unknown as string)?.toString().slice(0, 60) ?? "",
    });
  }
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    const horizontal = s.overflowX === "hidden" || s.textOverflow === "ellipsis";
    if (horizontal && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
      clipped.push({ text: name(el), kind: s.textOverflow === "ellipsis" ? "ellipsis" : "clip", over: el.scrollWidth - el.clientWidth });
    }
    if (el.matches("button,a[href]")) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const tops = new Set([...range.getClientRects()].filter((r) => r.width > 1).map((r) => Math.round(r.top / 4)));
      if (tops.size > 1 && s.display !== "block") wrapped.push({ text: name(el), lines: tops.size });
    }
  }

  const keyboardTop = vh - keyboardHeight;
  const inputs = [...scope.querySelectorAll("input,select,textarea")].filter(visible).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      name: name(el),
      font: parseFloat(getComputedStyle(el).fontSize),
      bottom: Math.round(r.bottom),
      underKeyboard: r.bottom > keyboardTop,
    };
  });

  const root = document.scrollingElement!;
  return {
    vw,
    vh,
    pageWidth: root.scrollWidth,
    pageHeight: root.scrollHeight,
    targets,
    text,
    clipped,
    wrapped,
    inputs,
    keyboardTop,
    pointerCoarse: matchMedia("(pointer: coarse)").matches,
    pointerFine: matchMedia("(pointer: fine)").matches,
    staffFont: (() => {
      const staff = document.querySelector(".tab-staff");
      if (!staff) return null;
      const s = getComputedStyle(staff);
      return { family: s.fontFamily.slice(0, 60), size: s.fontSize, ligatures: s.fontVariantLigatures };
    })(),
    staves: [...document.querySelectorAll('[aria-label="Tablature"]')].map((el) => ({
      client: el.clientWidth,
      scroll: el.scrollWidth,
    })),
  };
}

async function record(page: Page, id: string, size: (typeof SIZES)[number], theme: string) {
  await page.waitForTimeout(250);
  const data = await page.evaluate(measure, size.keyboard);
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, `${id}.${size.name}.${theme}.json`), JSON.stringify(data, null, 1));
  if (process.env.AUDIT_SHOTS) {
    await page.screenshot({ path: path.join(OUT, "shots", `${id}.${size.name}.${theme}.png`) });
  }
}

/** Four bars, timed, with a chord, a group, a repeat and a variant: every row the staff can draw. */
const riff = (from: number): Col[] => [
  n(from, { d: "q", chord: "Em7" }), n(from + 2, { d: "q" }), g("t1", from, { d: "8" }), g("t1", from + 2, { d: "8" }), g("t1", from + 3, { d: "8" }),
  bar(),
  n(from + 5, { d: "q", chord: "Cmaj7" }), n(from + 3, { d: "q", repeat: 2 }), n(from, { d: "q" }),
  bar(),
  n(from, { d: "h", chord: "Am7" }), n(from + 2, { d: "q" }), n(from + 3, { d: "q" }),
  bar(),
  n(from + 2, { d: "w", chord: "Dsus4" }),
];

async function seedFull(page: Page) {
  const seeded = await seedSong(
    page,
    [
      { key: "a", label: "A", name: "main riff", columns: riff(3) },
      { key: "b", label: "B", name: "the long bridge section", columns: riff(5) },
      { key: "a2", label: "C", variantOf: "a", columns: [...riff(3).slice(0, -1), n(9, { d: "w" })] },
    ],
    [{ part: "a", repeat: 2, last: "a2" }, { part: "b" }, { kind: "text", label: "build slowly" }, { part: "a", fromBar: 2, toBar: 3 }],
  );
  await page.getByTestId("tempo-control").first().count();
  return seeded;
}

for (const theme of THEMES) {
  for (const size of SIZES) {
    const tag = `${size.name} ${theme}`;
    test.describe(tag, () => {
      test.use({ colorScheme: theme, viewport: { width: size.width, height: size.height } });

      test(`lists and auth ${tag}`, async ({ page }) => {
        for (const [id, url] of [
          ["sign-in", "/sign-in"],
          ["sign-up", "/sign-up"],
          ["privacy", "/privacy"],
          ["terms", "/terms"],
          ["offline", "/offline"],
          ["join", "/join/ABCDEF"],
          ["bands-empty", "/"],
        ] as const) {
          await page.goto(url);
          await record(page, id, size, theme);
        }
        await page.getByLabel("Band name").fill("The Hollow Crown Rehearsal Collective");
        await page.getByRole("button", { name: "Add band" }).click();
        await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
        const bandUrl = page.url();
        await page.getByLabel("Song title").fill("A very long song title that a band really would use");
        await page.getByRole("button", { name: "Add song" }).click();
        await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
        await page.goto(bandUrl);
        await expect(page.getByRole("link", { name: "Capture" })).toBeVisible();
        await record(page, "band-songs", size, theme);
        await page.goto(`${bandUrl}/tunings`);
        await expect(page.getByRole("button", { name: "Bass 4", exact: true })).toBeVisible();
        await record(page, "tunings", size, theme);
        await page.goto("/");
        await expect(page.getByRole("link", { name: /Hollow Crown/ })).toBeVisible();
        await record(page, "bands-list", size, theme);
      });

      test(`song, arrangement and play ${tag}`, async ({ page }) => {
        const { songUrl, playUrl } = await seedFull(page);
        await page.goto(songUrl);
        await expect(page.getByTestId("roadmap-chip").first()).toBeVisible();
        await record(page, "song", size, theme);
        await page.getByTestId("roadmap-chip").first().click();
        await expect(page.getByRole("button", { name: "Remove" })).toBeVisible();
        await record(page, "arrangement-entry", size, theme);
        await page.getByTestId("roadmap-chip").first().click();
        await page.getByRole("button", { name: "Paste tab" }).first().click();
        await page.getByLabel("Tab text").fill("E|--3--5--|\nAm7-D7\nA|--3--5--|");
        await page.waitForTimeout(150);
        await record(page, "paste-refused", size, theme);
        await page.goto(playUrl);
        await expect(page.getByTestId("click-bar")).toBeVisible();
        await record(page, "play", size, theme);
        await page.getByTestId("tempo-control").click();
        await expect(page.getByTestId("tap-pad")).toBeVisible();
        await record(page, "tempo-sheet", size, theme);
      });

      for (const tuning of TUNINGS) {
        test(`capture ${tuning.strings} strings ${tag}`, async ({ page }) => {
          await startWith(page, tuning);
          await page.setViewportSize({ width: size.width, height: size.height });
          const id = `capture-${tuning.strings}`;
          await addRests(page, 6);
          await record(page, `${id}-rest`, size, theme);
          if (tuning.strings !== 6) return;

          await columns(page).nth(1).click();
          await page.getByRole("button", { name: "chord symbol" }).click();
          await record(page, "capture-chord-form", size, theme);
          await page.getByRole("button", { name: "Cancel" }).click();

          await columns(page).nth(2).click();
          await page.getByRole("button", { name: "Open column details" }).click();
          await expect(page.getByTestId("column-inspector")).toBeVisible();
          await record(page, "inspector", size, theme);
          await page.getByTestId("column-inspector").getByRole("button", { name: "close" }).click();

          await selectColumns(page, 0, 3);
          await record(page, "capture-selecting", size, theme);
          await expect(selectionBar(page)).toBeVisible();
        });
      }
    });
  }
}

/** The capture screen's height budget, string by string, with and without the rows that cost height. */
for (const tuning of TUNINGS) {
  for (const chord of [false, true]) {
    test(`budget ${tuning.strings} strings${chord ? " chord" : ""}`, async ({ page }) => {
      await startWith(page, tuning);
      await page.setViewportSize({ width: 375, height: 667 });
      await addRests(page, 6);
      await selectColumns(page, 1, 3);
      await selectionBar(page).getByRole("button", { name: "Group with no number" }).click();
      await page.waitForTimeout(150);
      if (chord) await addChord(page, 2, "Cmaj7");
      await page.waitForTimeout(150);
      const rows = await page.evaluate(() => {
        const h = (el: Element | null | undefined) => (el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null);
        const shell = document.querySelector(".h-dvh")!;
        const kids = [...shell.children].map((el) => ({
          cls: (el.getAttribute("data-testid") ?? el.tagName) + " " + el.className.toString().slice(0, 40),
          h: h(el),
        }));
        const stable = document.querySelector('[data-testid="toolbar-stable"]');
        return {
          kids,
          staff: h(document.querySelector('[data-testid="tab-staff"]')),
          stableButton: h(stable?.querySelector("button")),
          latch: h(document.querySelector('[data-testid="latch-strip"]')),
          grid: h(document.querySelector('[data-testid="fret-grid"]')),
          fretCell: h(document.querySelector('[data-testid="fret-grid"] button')),
          staffFont: getComputedStyle(document.querySelector(".tab-staff")!).fontFamily.slice(0, 40),
        };
      });
      fs.mkdirSync(OUT, { recursive: true });
      fs.writeFileSync(path.join(OUT, `budget-${tuning.strings}${chord ? "-chord" : ""}.json`), JSON.stringify(rows, null, 1));
    });
  }
}

/** The states the brief names as defects, read as they stand. */
test("named defects", async ({ page }) => {
  await startWith(page, TUNINGS[1]);
  await page.setViewportSize({ width: 375, height: 667 });
  await addRests(page, 6);
  await addChord(page, 1, "F#m7b5");
  await columns(page).nth(1).click();
  await stackLatch(page).click();
  await page.waitForTimeout(150);
  const status = await page.evaluate(() => {
    const row = [...document.querySelectorAll("div")].find((d) => d.className.toString().includes("overflow-hidden whitespace-nowrap"));
    if (!row) return null;
    const r = row.getBoundingClientRect();
    return {
      h: r.height,
      scroll: row.scrollWidth,
      client: row.clientWidth,
      kids: [...row.children].map((c) => ({ t: (c.textContent ?? "").slice(0, 40), right: Math.round(c.getBoundingClientRect().right), w: Math.round(c.getBoundingClientRect().width), clipped: c.scrollWidth > c.clientWidth })),
    };
  });
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="tab-column"] .truncate')]
      .filter((el) => el.textContent)
      .map((el) => ({ text: el.textContent, client: el.clientWidth, scroll: el.scrollWidth })),
  );
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "defects.json"), JSON.stringify({ status, labels }, null, 1));
});

/** A cursor on a barline: is the inspector reachable by anything but a hold? */
test("long press alternatives", async ({ page }) => {
  await startWith(page, TUNINGS[0]);
  await page.setViewportSize({ width: 375, height: 667 });
  await addRests(page, 2);
  await page.getByRole("button", { name: "Barline", exact: true }).click();
  await page.waitForTimeout(150);
  await columns(page).nth(2).click();
  await page.waitForTimeout(150);
  const onBarline = {
    details: await page.getByRole("button", { name: "Open column details" }).count(),
    contextual: await page.getByTestId("toolbar-contextual").count(),
  };
  await fret(page, "E", 3).click();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "long-press.json"), JSON.stringify({ onBarline }, null, 1));
});
