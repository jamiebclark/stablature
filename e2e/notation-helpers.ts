/** Shared by the 009 notation probes: one driver per surface, and a reader of what each column drew. */
import { expect, type Page } from "@playwright/test";
import { seed, type Col } from "./rhythm-probe-helpers";
import { openTools } from "./usability-helpers";

/** Capture joins in Phase 5 (US3), with the band height it needs. */
export type Surface = "song expanded" | "song compact" | "play" | "capture" | "print";
export const SURFACES: Surface[] = ["song expanded", "song compact", "play", "print"];

export interface Cell {
  left: number | null;
  right: number | null;
  duration: string | null;
  rhythm: string | null;
  flags: number | null;
  box: { x: number; y: number; width: number; height: number };
  parts: { part: string; level: number; side: string | null; x: number; y: number; width: number; height: number }[];
}

export async function open(page: Page, surface: Surface, urls: { songUrl: string; playUrl: string; partUrl: string }) {
  await page.goto(surface === "capture" ? urls.partUrl : surface === "play" || surface === "print" ? urls.playUrl : urls.songUrl);
  await expect(page.getByTestId("tab-column").first()).toBeVisible();
  if (surface === "song compact") {
    await openTools(page);
    await page.getByRole("button", { name: "compact" }).click();
  }
  if (surface === "print") await page.emulateMedia({ media: "print" });
}

export async function seeded(page: Page, list: Col[]) {
  return seed(page, list, { bpm: 120 });
}

/** One entry per drawn column, in document order. */
export const cells = (page: Page) =>
  page.getByTestId("tab-column").evaluateAll((els) =>
    els.map((el): Cell => {
      const r = el.querySelector("[data-testid=tab-rhythm]") as HTMLElement | null;
      const num = (n: string | null | undefined) => (n == null ? null : Number(n));
      const b = (r ?? el).getBoundingClientRect();
      return {
        left: num(r?.getAttribute("data-beams-left")),
        right: num(r?.getAttribute("data-beams-right")),
        duration: r?.getAttribute("data-duration") ?? null,
        rhythm: r?.getAttribute("data-rhythm") ?? null,
        flags: num(r?.getAttribute("data-flags")),
        box: { x: b.x, y: b.y, width: b.width, height: b.height },
        parts: Array.from(r?.querySelectorAll("[data-part]") ?? []).map((p) => {
          const q = p.getBoundingClientRect();
          return {
            part: p.getAttribute("data-part")!,
            level: Number(p.getAttribute("data-level") ?? 0),
            side: p.getAttribute("data-side"),
            x: q.x,
            y: q.y,
            width: q.width,
            height: q.height,
          };
        }),
      };
    }),
  );

/** Each column's note centre: the middle of its first fret label, else of the column. */
export const noteCentres = (page: Page) =>
  page.getByTestId("tab-column").evaluateAll((els) =>
    els.map((el) => {
      const s = el.querySelector(".tab-cell > span");
      const q = (s ?? el).getBoundingClientRect();
      return q.x + q.width / 2;
    }),
  );
