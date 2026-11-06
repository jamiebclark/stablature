/**
 * The named set **Scr** of plan.md, reached through the real interface, and the page-side walkers the
 * every-screen probes share. Not a spec file.
 */
import { expect, type Page } from "@playwright/test";
import { columns, details, inspector, mouseHold, stackLatch, touchHold } from "./capture-surface-helpers";
import { bar, g, n, seedSong, type Col, type EntrySpec } from "./reading-helpers";
import { setStoredTempo } from "./rhythm-probe-helpers";
import { pasteTab } from "./import-helpers";

export { stackLatch };

const riff = (from: number): Col[] => [
  n(from, { d: "q", chord: "Em7" }),
  n(from + 2, { d: "q" }),
  g("t1", from, { d: "8" }),
  g("t1", from + 2, { d: "8" }),
  g("t1", from + 3, { d: "8" }),
  bar(),
  n(from + 5, { d: "q", chord: "Cmaj7" }),
  n(from + 3, { d: "q", repeat: 2 }),
  n(from, { d: "q" }),
  bar(),
  n(from + 2, { d: "w", chord: "Dsus4" }),
];

export interface World {
  bandUrl: string;
  songUrl: string;
  playUrl: string;
  partUrl: string;
}

/** A song holding every row, a variant, a section, a cue and a sliced pass. */
export async function fullWorld(page: Page): Promise<World> {
  const entries = [
    { kind: "section_start", label: "Verse", repeat: 2 },
    { part: "a", repeat: 2, last: "c" },
    { kind: "section_end" },
    { part: "b" },
    { kind: "text", label: "build slowly" },
    { part: "a", fromBar: 2, toBar: 3 },
  ] as unknown as EntrySpec[];
  const seeded = await seedSong(
    page,
    [
      { key: "a", label: "A", name: "main riff", columns: riff(3) },
      { key: "b", label: "B", name: "the long bridge section", columns: riff(5) },
      { key: "c", label: "C", variantOf: "a", columns: [...riff(3).slice(0, -1), n(9, { d: "w" })] },
    ],
    entries,
  );
  await setStoredTempo(page, 120);
  await page.goto(seeded.songUrl);
  await page.getByRole("link", { name: "Band" }).first().click();
  await expect(page).toHaveURL(/\/bands\//);
  return {
    bandUrl: page.url(),
    songUrl: seeded.songUrl,
    playUrl: seeded.playUrl,
    partUrl: `${seeded.songUrl}/capture/${seeded.parts.a}`,
  };
}

const settle = (page: Page) => page.waitForTimeout(200);

const setPanel = async (page: Page, id: string, open: boolean) => {
  const panel = page.getByTestId(id);
  await panel.waitFor({ timeout: 4000 });
  if ((await panel.getAttribute("aria-expanded")) !== String(open)) await panel.click();
};

export type Visit = readonly [name: string, go: (page: Page, w: World) => Promise<void>];

/** Every member of **Scr** but the empty band list and the 4, 5 and 6 string capture rests, which need their own worlds. */
export const SCREENS: readonly Visit[] = [
  ["bands list", async (p) => void (await p.goto("/"))],
  ["band's songs", async (p, w) => void (await p.goto(w.bandUrl))],
  ["tunings", async (p, w) => void (await p.goto(`${w.bandUrl}/tunings`))],
  ["song page", async (p, w) => {
    await p.goto(w.songUrl);
    await setPanel(p, "panel-song-tools", false);
    await setPanel(p, "panel-song-arrange", false);
  }],
  ["song page, tools open", async (p, w) => {
    await p.goto(w.songUrl);
    await setPanel(p, "panel-song-tools", true);
  }],
  ["song page, arrange open", async (p, w) => {
    await p.goto(w.songUrl);
    await setPanel(p, "panel-song-arrange", true);
  }],
  ["arrangement entry selected", async (p, w) => {
    await p.goto(w.songUrl);
    await p.getByTestId("roadmap-chip").first().click();
    await expect(p.getByRole("button", { name: "Remove" })).toBeVisible();
  }],
  ["paste panel", async (p, w) => {
    await p.goto(w.songUrl);
    await pasteTab(p, "e|--3--5--|\nAm7-D7\nB|--3--5--|");
  }],
  ["capture at rest", async (p, w) => {
    await p.goto(w.partUrl);
    await expect(columns(p).first()).toBeVisible();
  }],
  ["capture selecting", async (p, w) => {
    await p.goto(w.partUrl);
    await columns(p).first().click();
    await p.getByRole("button", { name: /^select$/ }).click();
    await columns(p).nth(1).click();
    await expect(p.getByTestId("toolbar-selection")).toBeVisible();
  }],
  ["capture chord form", async (p, w) => {
    await p.goto(w.partUrl);
    await columns(p).first().click();
    await p.getByRole("button", { name: "chord symbol" }).click();
    await expect(p.getByRole("textbox", { name: "Chord" })).toBeVisible();
  }],
  ["inspector on a note", async (p, w) => {
    await p.goto(w.partUrl);
    await columns(p).first().click();
    await details(p).click();
    await expect(inspector(p)).toBeVisible();
  }],
  ["inspector on a barline", async (p, w) => {
    await p.goto(w.partUrl);
    // A barline has no details button: its sheet is the long press alone (spec.md's audit row, FR-021).
    const touch = await p.evaluate(() => matchMedia("(pointer: coarse)").matches);
    await (touch ? touchHold : mouseHold)(p, columns(p).nth(5));
    await expect(inspector(p)).toBeVisible();
  }],
  ["tempo sheet", async (p, w) => {
    await p.goto(w.playUrl);
    await p.getByTestId("tempo-control").click();
    await expect(p.getByTestId("tap-pad")).toBeVisible();
  }],
  ["play view idle", async (p, w) => {
    await p.goto(w.playUrl);
    await setPanel(p, "panel-play-cluster", false);
  }],
  ["play view cluster open", async (p, w) => {
    await p.goto(w.playUrl);
    await setPanel(p, "panel-play-cluster", true);
  }],
  ["play view running", async (p, w) => {
    await p.goto(w.playUrl);
    await p.getByTestId("click-start").click();
    await expect(p.getByTestId("click-stop")).toBeVisible();
  }],
  ["sign in", async (p) => void (await p.goto("/sign-in"))],
  ["sign up", async (p) => void (await p.goto("/sign-up"))],
  ["join", async (p) => void (await p.goto("/join/ABCDEF"))],
  ["offline", async (p) => void (await p.goto("/offline"))],
  ["privacy", async (p) => void (await p.goto("/privacy"))],
  ["terms", async (p) => void (await p.goto("/terms"))],
  ["help overlay", async (p, w) => {
    await p.goto(w.songUrl);
    await p.getByTestId("tab-staff").first().waitFor();
    // The listener mounts with hydration, so a key pressed on arrival can land before it.
    await expect(async () => {
      await p.keyboard.press("?");
      await expect(p.getByTestId("help-overlay")).toBeVisible({ timeout: 500 });
    }).toPass({ timeout: 6000 });
  }],
];

export const reach = async (page: Page, visit: Visit, world: World) => {
  await visit[1](page, world);
  await settle(page);
};

/** Text under 4.5:1 on what it is painted on, opacity multiplied through. `disabled` is the only exemption. */
export const lowContrast = (page: Page) =>
  page.evaluate(() => {
    const px = (css: string) => {
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const g2 = c.getContext("2d")!;
      g2.fillStyle = css;
      g2.fillRect(0, 0, 1, 1);
      return Array.from(g2.getImageData(0, 0, 1, 1).data);
    };
    const lum = ([r, gr, b]: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(gr) + 0.0722 * f(b);
    };
    const over = (top: number[], under: number[]) => {
      const a = top[3] / 255;
      return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(255);
    };
    const surface = (el: Element) => {
      const layers: number[][] = [];
      for (let n: Element | null = el; n; n = n.parentElement) {
        const c = px(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] > 250) break;
      }
      let bg = [255, 255, 255, 255];
      for (const layer of layers.reverse()) bg = over(layer, bg);
      return bg;
    };
    const ratioOf = (ink: number[], bg: number[], opacity: number) => {
      const fg = over([ink[0], ink[1], ink[2], Math.round(ink[3] * opacity)], bg);
      const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const opacityOf = (el: Element) => {
      let o = 1;
      for (let n: Element | null = el; n; n = n.parentElement) o *= Number(getComputedStyle(n).opacity);
      return o;
    };
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 1 && r.height > 1 && s.visibility !== "hidden" && s.display !== "none";
    };
    const bad: string[] = [];
    const modal = document.querySelector("dialog[open]");
    const walker = document.createTreeWalker(modal ?? document.body, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const el = t.parentElement;
      if (!el || !t.textContent?.trim() || el.closest("script,style,noscript,[hidden]")) continue;
      if (el.closest("[disabled]") || !shown(el)) continue;
      // The count-in numeral is painted on the accent square beside it, a sibling this walk cannot see.
      if (el.closest('[data-role="count"]')) continue;
      const ratio = ratioOf(px(getComputedStyle(el).color), surface(el), opacityOf(el));
      if (ratio < 4.5) bad.push(`"${t.textContent.trim().slice(0, 24)}" ${ratio.toFixed(2)}`);
    }
    for (const el of (modal ?? document).querySelectorAll<HTMLInputElement>("input[placeholder],textarea[placeholder]")) {
      if (!shown(el) || el.disabled || !el.placeholder) continue;
      const ratio = ratioOf(px(getComputedStyle(el, "::placeholder").color), surface(el), opacityOf(el));
      if (ratio < 4.5) bad.push(`placeholder "${el.placeholder.slice(0, 24)}" ${ratio.toFixed(2)}`);
    }
    return [...new Set(bad)];
  });

/** Inputs and selects under the floor for text. */
export const smallFields = (page: Page, floor: number) =>
  page.evaluate((f) => {
    const scope = document.querySelector("dialog[open]") ?? document;
    return [...scope.querySelectorAll<HTMLElement>("input, select, textarea, [contenteditable]")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => ({ name: el.getAttribute("aria-label") ?? el.tagName, size: parseFloat(getComputedStyle(el).fontSize) }))
      .filter((x) => x.size < f)
      .map((x) => `${x.name} ${x.size}px`);
  }, floor);

export const TARGETS = "a, button, input, select, textarea, [role=button], summary";

export interface Target {
  tag: string;
  name: string;
  testId: string | null;
  w: number;
  h: number;
  text: string;
  textWidth: number;
  row: string | null;
  sentence: boolean;
}

/** Every visible target, and how wide its own label is, so "as wide as its label" can be read rather than assumed. */
export const readTargets = (page: Page): Promise<Target[]> =>
  page.evaluate((sel) => {
    const rows = ["latch-strip", "toolbar-selection", "capture-title-row", "status-row", "toolbar-stable", "toolbar-contextual"];
    const scope = document.querySelector("dialog[open]") ?? document;
    return [...scope.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(el);
        return {
          tag: el.tagName.toLowerCase(),
          name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40),
          testId: el.getAttribute("data-testid"),
          w: r.width,
          h: r.height,
          text: (el.textContent ?? "").trim(),
          textWidth: range.getBoundingClientRect().width,
          row: rows.find((id) => el.closest(`[data-testid="${id}"]`)) ?? null,
          sentence: el.tagName === "A" && el.parentElement?.tagName === "P",
        };
      });
  }, TARGETS);
