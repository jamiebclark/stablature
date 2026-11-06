/**
 * INV-020 with a real pointer on each side: one context per pointer in the same window, over {500x800, 1280x800} x
 * {with a chord row, with a bar row, plain}. usability-density applies the tokens by hand instead.
 */
import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { bar, n, seedSong, type Col } from "../../../e2e/reading-helpers";

test.setTimeout(120_000);
test.skip(({ isMobile }) => isMobile, "this test makes both contexts itself");

const q = (over: Col = {}) => n(3, { d: "q", ...over });
const line = (over: Col = {}): Col[] =>
  Array.from({ length: 24 }, (_, i) => [q(i % 4 === 0 ? over : {}), q(), q(), q(), bar()]).flat();

const SHAPES: { name: string; columns: Col[]; url: "song" | "play" }[] = [
  { name: "with a chord row", columns: line({ chord: "Am" }), url: "song" },
  { name: "with a bar row", columns: line(), url: "play" },
  { name: "plain", columns: line(), url: "song" },
];

const measure = (page: Page) =>
  page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    const cols = [...staff.querySelectorAll('[data-testid="tab-column"]')];
    const firstTop = cols[0].getBoundingClientRect().top;
    const box = staff.querySelector('[role="group"]') ?? staff;
    const right = box.getBoundingClientRect().right;
    const onLine = cols.filter((c) => {
      const r = c.getBoundingClientRect();
      return Math.abs(r.top - firstTop) < 2 && r.left < right;
    }).length;
    const cell = cols[0].querySelector(".tab-cell")!.getBoundingClientRect().height;
    return { onLine, staffHeight: cell * 6, pointer: matchMedia("(pointer: fine)").matches ? "fine" : "coarse" };
  });

async function open(browser: Browser, touch: boolean, size: { width: number; height: number }, shape: (typeof SHAPES)[number]) {
  const { defaultBrowserType: _b, ...phone } = devices["Pixel 7"];
  const context = await browser.newContext(touch ? { ...phone, viewport: size } : { viewport: size });
  const page = await context.newPage();
  const { songUrl, playUrl } = await seedSong(page, [{ key: "a", label: "A", columns: shape.columns }], [{ part: "a" }]);
  await page.goto(shape.url === "song" ? songUrl : playUrl);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible();
  await page.waitForTimeout(200);
  const m = await measure(page);
  await context.close();
  return m;
}

for (const size of [{ width: 500, height: 800 }, { width: 1280, height: 800 }]) {
  for (const shape of SHAPES) {
    test(`INV-020 ${size.width}x${size.height} ${shape.name}`, async ({ browser }) => {
      const touch = await open(browser, true, size, shape);
      const mouse = await open(browser, false, size, shape);
      expect(touch.pointer).toBe("coarse");
      expect(mouse.pointer).toBe("fine");
      expect(mouse.onLine / touch.onLine, `columns ${JSON.stringify({ touch, mouse })}`).toBeGreaterThanOrEqual(1.15);
      expect(1 - mouse.staffHeight / touch.staffHeight, `height ${JSON.stringify({ touch, mouse })}`).toBeGreaterThanOrEqual(0.15);
    });
  }
}
