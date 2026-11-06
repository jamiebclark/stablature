import type { CDPSession, Locator, Page } from "@playwright/test";

/** Shared by the usability specs (007). Sizes are CSS px. */

export interface Floor {
  w: number;
  h: number;
}

/** The "Size floors" table in the spec: [touch after, mouse after]. "Everything else" is the default. */
export const FLOORS = {
  fretCell: { touch: { w: 36, h: 36 }, mouse: { w: 32, h: 32 } },
  deadNoteCell: { touch: { w: 36, h: 28 }, mouse: { w: 32, h: 24 } },
  latchChip: { touch: { w: 70, h: 31 }, mouse: { w: 70, h: 26 } },
  toolbarControl: { touch: { w: 44, h: 44 }, mouse: { w: 24, h: 32 } },
  stepperHalf: { touch: { w: 32, h: 44 }, mouse: { w: 24, h: 32 } },
  bracketControl: { touch: { w: 36, h: 44 }, mouse: { w: 28, h: 32 } },
  partChip: { touch: { w: 36, h: 44 }, mouse: { w: 28, h: 28 } },
  jump: { touch: { w: 44, h: 24 }, mouse: { w: 44, h: 24 } },
  backToSong: { touch: { w: 44, h: 44 }, mouse: { w: 24, h: 24 } },
  everythingElse: { touch: { w: 44, h: 44 }, mouse: { w: 24, h: 24 } },
} as const satisfies Record<string, { touch: Floor; mouse: Floor }>;

/** Every target the floors walk visits. */
export const TARGETS = "a, button, input, select, textarea, [role=button], summary";

/**
 * Links that sit inside a sentence are exempt (WCAG 2.2 target size). Named, not inferred, so a new small
 * link cannot exempt itself (surfaces.md §12). Each is asserted to exist.
 */
export const SENTENCE_LINKS = [
  { page: "/sign-in", text: "Create one" },
  { page: "/sign-up", text: "what is stored" },
  { page: "/sign-up", text: "the terms" },
  { page: "/sign-up", text: "Sign in" },
  { page: "/privacy", text: "the terms" },
  { page: "/terms", text: "privacy" },
] as const;

/** Soft-keyboard heights the audit stubs through `visualViewport`, by viewport. */
export const KEYBOARD = [
  { name: "375x667", width: 375, height: 667, keyboard: 260 },
  { name: "390x844", width: 390, height: 844, keyboard: 336 },
] as const;

/** Open a collapsed panel by its test id. A panel already open (or shown directly) is left alone. */
async function openPanel(page: Page, testId: string) {
  const panel = page.getByTestId(testId);
  // The panel arrives with the song; an absent one (no entries, no tuning) is not waited on for long.
  await panel.waitFor({ timeout: 3000 }).catch(() => undefined);
  if ((await panel.count()) === 0) return;
  // The panel's test id sits on its button, which carries aria-expanded.
  if ((await panel.getAttribute("aria-expanded")) === "false") await panel.click();
}

/** Song page: the tools panel (tuning, BPM, export, density, view control). */
export const openTools = (page: Page) => openPanel(page, "panel-song-tools");

/** Play view: the click cluster. */
export const openCluster = (page: Page) => openPanel(page, "panel-play-cluster");

/**
 * Stub `visualViewport` so a soft keyboard of `keyboard` px appears to cover the bottom of the screen.
 * Call before navigation. Dispatches `resize` so listeners run.
 */
export async function stubKeyboard(page: Page, keyboard: number) {
  await page.addInitScript((kb) => {
    const vv = window.visualViewport;
    if (!vv) return;
    const shown = { on: false };
    Object.defineProperty(vv, "height", { get: () => window.innerHeight - (shown.on ? kb : 0), configurable: true });
    (window as unknown as { __keyboard: (on: boolean) => void }).__keyboard = (on) => {
      shown.on = on;
      vv.dispatchEvent(new Event("resize"));
    };
  }, keyboard);
}

export const showKeyboard = (page: Page, on: boolean) =>
  page.evaluate((v) => (window as unknown as { __keyboard?: (on: boolean) => void }).__keyboard?.(v), on);

/** Pretend the device has a notch and home bar: `env(safe-area-inset-*)` reads these px. */
export async function safeArea(
  page: Page,
  insets: { top?: number; right?: number; bottom?: number; left?: number },
): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", {
    insets: { top: 0, right: 0, bottom: 0, left: 0, ...insets },
  });
  return cdp;
}

export interface Box {
  w: number;
  h: number;
  x: number;
  y: number;
}

export async function box(locator: Locator): Promise<Box> {
  const b = await locator.boundingBox();
  if (!b) throw new Error("no box: not rendered");
  return { w: b.width, h: b.height, x: b.x, y: b.y };
}

/** Every visible target on the page with its size and accessible name. */
export const targets = (page: Page) =>
  page.evaluate((sel) => {
    return Array.from(document.querySelectorAll<HTMLElement>(sel))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40),
          testId: el.getAttribute("data-testid"),
          w: r.width,
          h: r.height,
          inSentence: el.tagName === "A" && el.parentElement?.tagName === "P",
        };
      });
  }, TARGETS);

/** Every text node's rendered box, with the element's clip state, to find text that is cut off. */
export const textNodes = (page: Page, rootSelector = "body") =>
  page.evaluate((root) => {
    const out: { text: string; clipped: boolean }[] = [];
    const walker = document.createTreeWalker(document.querySelector(root) ?? document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = (n.textContent ?? "").trim();
      const el = n.parentElement;
      if (!text || !el) continue;
      out.push({ text, clipped: el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible" });
    }
    return out;
  }, rootSelector);

/**
 * Row heights on capture before the usability pass, at 375×667, read from the unedited build (T008).
 * INV-001 compares the neck and latch strip against these.
 */
export const BEFORE_HEIGHTS = {
  /** `fret-grid`, the neck, on the default tuning (five strings) at 375x667. */
  neck: 238.39,
  /** `latch-strip`. */
  latchStrip: 38.8,
  /** `toolbar-stable`, before it takes the 46px budget. */
  toolbarStable: 55,
  /** The capture `header`, before `capture-title-row`. */
  header: 37,
} as const;

/** Song page: the panel that holds the adding controls (absent while the arrangement is empty). */
export const openArrange = (page: Page) => openPanel(page, "panel-song-arrange");
