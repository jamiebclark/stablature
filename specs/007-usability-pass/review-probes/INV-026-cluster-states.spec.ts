/**
 * INV-026, each state forced by its real route, x {collapsed, open} x **Sz**. usability-reach.spec.ts checks the idle
 * height alone. `click-state` is visible when it must be, the cluster is at least 44 high and at most 60 idle, the last
 * staff's bottom clears it, and print hides it.
 */
import { expect, test, type Page } from "@playwright/test";
import { cols, deviceSets, recorder, seed, type Col } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(120_000);
test.skip(({ isMobile }) => !isMobile, "the cluster's budget is the touch column");

const SIZES = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
];

const TIMED: Col[] = cols("q", "q", "q", "q", "|", "q", "q", "q", "q");
const GAPPED: Col[] = cols("q", "q", "|", null, null);

const NEEDS_WORDS = /./;

interface State {
  name: string;
  list: Col[];
  bpm?: unknown;
  audio?: "ok" | "absent";
  /** Must the message be on screen with the panel shut? */
  must: boolean;
  words: RegExp;
  force: (page: Page) => Promise<void>;
}

const hide = (p: Page) =>
  p.evaluate(() => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    document.dispatchEvent(new Event("visibilitychange"));
  });

const go = (p: Page) => p.getByTestId("click-start").click();
const until = (p: Page, words: string) => expect(p.getByTestId("click-state")).toHaveText(words, { timeout: 10_000 });

const STATES: State[] = [
  { name: "no tempo", list: TIMED, bpm: null, must: true, words: /tempo/i, force: async () => {} },
  {
    name: "stopped hidden",
    list: TIMED,
    must: true,
    words: /screen was hidden/,
    force: async (p) => {
      await go(p);
      await until(p, "Following the notation.");
      await hide(p);
    },
  },
  {
    name: "audio lost",
    list: TIMED,
    must: true,
    words: /took the audio/,
    force: async (p) => {
      await go(p);
      await until(p, "Following the notation.");
      await deviceSets(p, "suspended");
    },
  },
  {
    name: "running with sound",
    list: cols(...Array.from({ length: 64 }, () => "q")),
    must: true,
    words: NEEDS_WORDS,
    force: async (p) => {
      await go(p);
      await until(p, "Following the notation.");
    },
  },
  {
    name: "soundless",
    list: cols(...Array.from({ length: 64 }, () => "q")),
    audio: "absent",
    must: true,
    words: NEEDS_WORDS,
    force: async (p) => {
      await go(p);
      await expect(p.getByTestId("click-help")).toHaveText(/No sound on this device/, { timeout: 10_000 });
    },
  },
  {
    name: "counting in",
    list: cols(...Array.from({ length: 64 }, () => "q")),
    must: true,
    words: /Counting in/,
    force: async (p) => {
      await go(p);
      await until(p, "Counting in.");
    },
  },
  {
    name: "plain",
    list: GAPPED,
    must: true,
    words: /Plain beat/,
    force: async (p) => {
      await go(p);
      await until(p, "Plain beat.");
    },
  },
];

const setPanel = async (page: Page, open: boolean) => {
  const panel = page.getByTestId("panel-play-cluster");
  if ((await panel.getAttribute("aria-expanded")) !== String(open)) await panel.click();
};

for (const state of STATES) {
  for (const size of SIZES) {
    test(`INV-026 ${state.name} at ${size.width}x${size.height}`, async ({ page }) => {
      await recorder(page, { audio: state.audio ?? "ok" });
      const { playUrl } = await seed(page, state.list, { bpm: state.bpm === undefined ? 240 : state.bpm });
      await page.setViewportSize(size);
      await page.goto(playUrl);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await state.force(page);
      for (const open of [false, true]) {
        await setPanel(page, open);
        await page.waitForTimeout(80);
        const bar = page.getByTestId("click-bar");
        const box = (await bar.boundingBox())!;
        expect(box.height, "at least 44 high").toBeGreaterThanOrEqual(44);
        const words = page.getByTestId("click-state");
        await expect(words, `open=${open}`).toHaveText(state.words);
        const painted = await words.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 2 && r.height > 2 && !el.className.includes("sr-only") && getComputedStyle(el).visibility !== "hidden";
        });
        if (state.must) expect(painted, `the message is on screen, open=${open}`).toBe(true);
        const clears = await page.evaluate(() => {
          window.scrollTo(0, document.documentElement.scrollHeight);
          const staves = [...document.querySelectorAll('[data-testid="tab-staff"]')];
          const last = staves.at(-1)!.getBoundingClientRect().bottom;
          const top = document.querySelector('[data-testid="click-bar"]')!.getBoundingClientRect().top;
          return top - last;
        });
        expect(clears, `the last staff clears it, open=${open}`).toBeGreaterThanOrEqual(0);
      }
      await page.emulateMedia({ media: "print" });
      await expect(page.getByTestId("click-bar")).toBeHidden();
      await page.emulateMedia({ media: "screen" });
    });
  }
}

test("INV-026 idle, collapsed, at most 60 high with nothing to say", async ({ page }) => {
  const { playUrl } = await seed(page, TIMED, { bpm: 120 });
  await page.setViewportSize(SIZES[0]);
  await page.goto(playUrl);
  await expect(page.getByTestId("click-start")).toBeVisible();
  await setPanel(page, false);
  const box = (await page.getByTestId("click-bar").boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeLessThanOrEqual(60);
});
