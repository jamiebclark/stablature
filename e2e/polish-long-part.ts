/**
 * Shared drivers for the spec 008 band specs (adopted from the review probes).
 */
import { expect, type Page } from "@playwright/test";
import { generateNKeysBetween } from "fractional-indexing";
import { idb } from "./reading-helpers";
import { addChord, columns, selectColumns, space, startWith as startWithTuning, tupletControl, TUNINGS } from "./probe-helpers";

export const GUITAR7 = { family: "Guitar 7", preset: "B Standard", strings: 7 } as const;
export type Tuning = (typeof TUNINGS)[number] | typeof GUITAR7;
export const SIX = TUNINGS[2];

/**
 * A capture part in `tuning`: three spaces made through the UI (carrying the optional chord on the first and the
 * optional tuplet bracket over all three), then `bars` bars seeded straight into IndexedDB. Returns on the capture
 * page, reloaded so Dexie sees the seeded rows, at `size`.
 */
export async function longPart(
  page: Page,
  opts: { tuning?: Tuning; chord?: boolean; bracket?: boolean; bars?: number; perBar?: number; size: { width: number; height: number }; band?: string },
) {
  const tuning = opts.tuning ?? SIX;
  const { songUrl, partUrl } = await startWithTuning(page, tuning, opts.band ?? `Band ${Math.random().toString(36).slice(2, 8)}`);
  await decorate(page, opts);
  const partId = partUrl.split("/").pop()!;
  const count = await seedBars(page, partId, tuning.strings, opts.bars ?? 16, opts.perBar);
  await page.setViewportSize(opts.size);
  await page.goto(partUrl);
  await expect(columns(page)).toHaveCount(3 + count);
  await page.waitForTimeout(700);
  return { songUrl, partUrl, partId };
}

/** Three spaces on the open (empty) part, with the optional chord and bracket. */
export async function decorate(page: Page, opts: { chord?: boolean; bracket?: boolean }) {
  for (let i = 0; i < 3; i++) await space(page);
  await expect(columns(page)).toHaveCount(3);
  if (opts.chord) await addChord(page, 0, "Am");
  if (opts.bracket) {
    await selectColumns(page, 0, 2);
    await tupletControl(page).click();
    await expect(page.locator('[data-testid="tab-bracket"][data-start]')).toHaveCount(1);
    await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click({ timeout: 1000 }).catch(() => undefined);
  }
  await page.waitForTimeout(300);
}

/** Seeds `bars` bars (a barline, then three notes on the lowest string) after the part's last column. Reload to see them. */
export async function seedBars(page: Page, partId: string, strings: number, bars: number, perBar = 3): Promise<number> {
  const count = bars * (perBar + 1);
  const last = await idb<string>(
    page,
    `const mine = (await all("events")).filter((r) => r.partId === arg && !r.deletedAt).map((r) => r.rank).sort();
     return mine[mine.length - 1];`,
    partId,
  );
  await idb(
    page,
    `
    const { partId, count, low, ranks, every } = arg;
    const mine = (await all("events")).filter((r) => r.partId === partId && !r.deletedAt);
    mine.sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));
    const last = mine[mine.length - 1];
    await write("events", (s) => {
      for (let i = 0; i < count; i++) {
        const kind = i % every === 0 ? "barline" : "notes";
        s.put({
          ...last, id: crypto.randomUUID(), rank: ranks[i], kind,
          frets: kind === "barline" ? {} : { [low]: (i % 9) + 1 },
          techniques: {}, repeat: 1, durationHint: null, tupletId: null, tupletCount: null, groupKind: null,
        });
      }
    });
    `,
    { partId, count, low: strings - 1, ranks: generateNKeysBetween(last, null, count), every: perBar + 1 },
  );
  return count;
}

/** The band's geometry, read from the DOM as the plan's probes describe. */
export const bandGeometry = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    const style = getComputedStyle(band);
    const box = band.getBoundingClientRect();
    const top = box.top + parseFloat(style.paddingTop);
    const bottom = box.bottom - parseFloat(style.paddingBottom);
    const runs = [...band.querySelectorAll<HTMLElement>(".tab-bar-run")];
    const mark =
      band.querySelector('[data-testid="tab-caret"]') ?? band.querySelector('[data-testid="tab-column"][aria-current="true"]');
    const cursorRun = mark?.closest(".tab-bar-run")?.getBoundingClientRect() ?? null;
    const column = band.querySelector('[data-testid="tab-column"]')?.getBoundingClientRect();
    const rects = runs.map((r) => r.getBoundingClientRect());
    const inView = rects.filter((r) => r.bottom > top + 1 && r.top < bottom - 1);
    return {
      wrapped: !!band.querySelector(".tab-staff-wrapped"),
      content: band.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
      line: column?.height ?? 0,
      gap: parseFloat(style.rowGap) || 0,
      top,
      bottom,
      scrollTop: band.scrollTop,
      overflows: band.scrollHeight > band.clientHeight + 1,
      cursorBottom: cursorRun?.bottom ?? null,
      blank: inView.length ? Math.min(...inView.map((r) => r.top)) - top : bottom - top,
      runTops: rects.map((r) => Math.round(r.top)),
      lines: new Set(rects.map((r) => Math.round(r.top))).size,
    };
  });

/** Scrolls the band (as a swipe would) so the cursor's line is away from the bottom. */
export const swipeAway = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    const range = band.scrollHeight - band.clientHeight;
    band.scrollTop = band.scrollTop < -range / 2 ? 0 : -range;
  });

/** Leaves no control focused, so a key press goes to the screen's keys and not to a button. */
export const blur = (page: Page) => page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
