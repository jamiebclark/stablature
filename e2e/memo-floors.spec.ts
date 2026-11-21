import { expect, test, type Page } from "@playwright/test";
import { landed } from "./reading-helpers";
import { fillDevice, seedMemo, seedSongM, setDeviceFull, startRecording, withFakeMicrophone, withoutMediaRecorder } from "./memo-helpers";
import { FLOORS } from "./usability-helpers";
test.setTimeout(120_000);

/**
 * INV-024: every memo control that is present meets spec 007's size floor (44x44 on touch, the fine floor with a
 * mouse), every memo word is 4.5:1 against what it is painted on, and nothing makes the page scroll sideways.
 * Contrast is the method of `usability-contrast.spec.ts`.
 */
withFakeMicrophone();

const CONTROLS = [
  "memo-more", "memo-play", "memo-seek", "memo-retry", "memo-download", "record-stop", "record-discard",
  "record-discard-confirm", "record-retry", "record-download-held",
];
const WIDTHS = [
  { width: 375, height: 667 },
  { width: 412, height: 915 },
  { width: 1280, height: 800 },
];

const RUNS = `(() => {
  const px = (css) => {
    const c = document.createElement("canvas"); c.width = c.height = 1;
    const g = c.getContext("2d"); g.fillStyle = css; g.fillRect(0, 0, 1, 1);
    return Array.from(g.getImageData(0, 0, 1, 1).data);
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const over = (top, under) => { const a = top[3] / 255; return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(255); };
  const bad = [];
  const roots = Array.from(document.querySelectorAll('[data-testid="part-memos"], [data-testid="record-panel"], [data-testid="record-unavailable"], [data-testid="memo-notice"]'));
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let t = walker.nextNode(); t; t = walker.nextNode()) {
      const el = t.parentElement;
      if (!el || !t.textContent.trim() || el.closest("[hidden],[aria-hidden=true],[disabled],[aria-disabled=true]")) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      let opacity = 1;
      for (let n = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const c = px(getComputedStyle(n).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] > 250) break;
      }
      let bg = [255, 255, 255, 255];
      for (const layer of layers.reverse()) bg = over(layer, bg);
      const ink = px(cs.color);
      const fg = over([ink[0], ink[1], ink[2], Math.round(ink[3] * opacity)], bg);
      const [hi, lo] = [lum(fg), lum(bg)].sort((x, y) => y - x);
      const ratio = (hi + 0.05) / (lo + 0.05);
      if (ratio < 4.5) bad.push(el.tagName.toLowerCase() + ":" + t.textContent.trim().slice(0, 20) + " " + ratio.toFixed(2));
    }
  }
  return bad;
})()`;

async function check(page: Page, isMobile: boolean, label: string) {
  const floor = FLOORS.everythingElse[isMobile ? "touch" : "mouse"];
  for (const id of CONTROLS) {
    const boxes = await page.getByTestId(id).evaluateAll((els) =>
      els.map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0).map((r) => ({ w: r.width, h: r.height })),
    );
    for (const b of boxes) {
      expect(b.w, `${label} ${id} width`).toBeGreaterThanOrEqual(floor.w - 0.5);
      expect(b.h, `${label} ${id} height`).toBeGreaterThanOrEqual(floor.h - 0.5);
    }
  }
  expect(await page.evaluate(RUNS), `${label} contrast`).toEqual([]);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over, `${label} sideways scroll`).toBeLessThanOrEqual(0);
}

type Setup = (page: Page) => Promise<void>;
const STATES: Record<string, Setup> = {
  "idle with memos": async (page) => {
    await seedSongM(page);
    await landed(page);
    await seedMemo(page, { partLabel: "B", state: "ready" });
    await seedMemo(page, { partLabel: "B", state: "local-signed-out" });
    await seedMemo(page, { partLabel: "B", state: "fetch-failed" });
    await page.reload();
    await expect(page.getByTestId("memo").first()).toBeVisible();
  },
  recording: async (page) => {
    await seedSongM(page);
    await startRecording(page, "A");
  },
  held: async (page) => {
    await fillDevice(page);
    await seedSongM(page);
    await startRecording(page, "A");
    await setDeviceFull(page, true);
    await page.waitForTimeout(4000);
    await page.getByTestId("record-stop").click();
    await expect(page.getByTestId("record-retry")).toBeVisible();
  },
  "explanation open": async (page) => {
    await withoutMediaRecorder(page);
    await seedSongM(page);
    await landed(page);
    await page.getByRole("button", { name: /^Actions for part A(,|$)/ }).click();
    await page.getByRole("menuitem", { name: /^Record a memo on part A/ }).click({ force: true });
    await expect(page.getByTestId("record-unavailable")).toBeVisible();
  },
};

for (const theme of ["dark", "light"] as const) {
  for (const [name, setup] of Object.entries(STATES)) {
    test(`INV-024 ${name} - ${theme}`, async ({ page, isMobile }) => {
      await page.emulateMedia({ colorScheme: theme });
      await setup(page);
      for (const size of WIDTHS) {
        await page.setViewportSize(size);
        await check(page, Boolean(isMobile), `${name} ${size.width}`);
      }
    });
  }
}
