import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/** Opens part `label`'s menu (the trigger's name starts "Actions for part <label>"). Asserts it is open. */
export async function openPartMenu(page: Page, label: string): Promise<Locator> {
  await page.getByRole("button", { name: new RegExp(`^Actions for part ${label}(,|$)`) }).click();
  const menu = page.getByRole("menu", { name: new RegExp(`^Actions for part ${label}(,|$)`) });
  await expect(menu).toBeVisible();
  return menu;
}

/** Opens the menu and activates one item. `item` is "Edit", "+ variant" or "Delete". */
export async function partAction(page: Page, label: string, item: "Edit" | "+ variant" | "Delete"): Promise<void> {
  const menu = await openPartMenu(page, label);
  const name = item === "+ variant" ? "+ variant" : `${item} part ${label}`;
  await menu.getByRole("menuitem", { name, exact: true }).click();
}

/** Ids and times differ run to run; what an action did is the shape. Ids become their order of first appearance. */
export function normaliseDump(dump: string): unknown {
  const seen = new Map<string, string>();
  const text = dump
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => {
      if (!seen.has(id)) seen.set(id, `<id${seen.size + 1}>`);
      return seen.get(id)!;
    })
    .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "<time>")
    .replace(/\d{15}:\d{4}:[0-9a-z]+/g, "<clock>");
  return JSON.parse(text);
}

/** WCAG contrast of an element's text against its first opaque ancestor background. */
export const textContrast = (el: Element): number => {
  const px = (css: string) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const g = c.getContext("2d")!;
    g.fillStyle = css;
    g.fillRect(0, 0, 1, 1);
    return Array.from(g.getImageData(0, 0, 1, 1).data);
  };
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  let bg = [255, 255, 255, 255];
  for (let n: Element | null = el; n; n = n.parentElement) {
    const c = px(getComputedStyle(n).backgroundColor);
    if (c[3] > 250) {
      bg = c;
      break;
    }
  }
  const fg = px(getComputedStyle(el).color);
  const [a, b] = [lum(fg), lum(bg)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
};
