/** Spec 013 helpers: what a test measures (data-model §5), the row rule (§4) and the seeders (contracts §6). Never reads `--own-*`. */
import type { Page } from "@playwright/test";
import { n, seedSong, type Col, type PartSpec } from "./reading-helpers";
import { bars, section, sectionEnd } from "./wide-helpers";
import { seedMemo, seedSongM } from "./memo-helpers";

export interface MeasuredCard {
  /** The `[data-testid=tab-ruler]` box width, or 0 when the card has none. */
  ruler: number;
  /** One-line staff width: the `.tab-lines` clone, no wrap, plus `--gutter`. 0 when the card has no staff. */
  oneLineStaff: number;
  /** The head row cloned onto one line. */
  head: number;
  memo: boolean;
  /** The card's drawn box. */
  left: number;
  right: number;
  top: number;
  width: number;
}

export interface Measured {
  /** The list's content width (its `clientWidth` minus padding). */
  row: number;
  display: string;
  tokens: { cardMin: number; cardFloor: number; padX: number; gap: number };
  cards: MeasuredCard[];
}

/** Measures every card of the reading list on the current page. `selector` picks the list's cards. */
export async function measureCards(page: Page, selector = "li:has(.reading-card), .reading-card"): Promise<Measured> {
  return page.evaluate((sel) => {
    const cards = [...document.querySelectorAll<HTMLElement>(sel)].filter(
      (el) => el.tagName === "LI" || !el.closest("li"),
    );
    const list = (cards[0]?.parentElement ?? document.body) as HTMLElement;
    const ls = getComputedStyle(list);
    const row = list.clientWidth - parseFloat(ls.paddingLeft) - parseFloat(ls.paddingRight);
    const px = (token: string): number => {
      const probe = document.createElement("div");
      probe.style.cssText = `position:absolute;visibility:hidden;width:${getComputedStyle(cards[0] ?? document.body).getPropertyValue(token) || "0px"}`;
      list.appendChild(probe);
      const w = probe.getBoundingClientRect().width;
      probe.remove();
      return w;
    };
    const hiddenClone = (el: Element, css: (c: HTMLElement) => void): number => {
      const c = el.cloneNode(true) as HTMLElement;
      c.style.cssText = "position:absolute;visibility:hidden;width:max-content;flex-wrap:nowrap";
      css(c);
      el.parentElement!.appendChild(c);
      const w = c.getBoundingClientRect().width;
      c.remove();
      return w;
    };
    const gutter = (el: Element) => parseFloat(getComputedStyle(el.closest(".tab-wrapped-body") ?? el).paddingLeft) || 0;
    const measured = cards.map((li) => {
      const ruler = li.querySelector<HTMLElement>('[data-testid="tab-ruler"]');
      const lines = li.querySelector<HTMLElement>(".tab-lines");
      const head = li.querySelector<HTMLElement>(".reading-card > :first-child") ?? (li.firstElementChild as HTMLElement | null);
      const r = li.getBoundingClientRect();
      return {
        ruler: ruler?.getBoundingClientRect().width ?? 0,
        oneLineStaff: lines
          ? hiddenClone(lines, (c) => c.querySelectorAll<HTMLElement>(".tab-bar-run").forEach((x) => (x.style.flex = "none"))) + gutter(lines)
          : 0,
        head: head ? hiddenClone(head, () => {}) : 0,
        memo: li.querySelector('[data-testid="part-memos"]') !== null,
        left: r.left,
        right: r.right,
        top: r.top,
        width: r.width,
      };
    });
    return {
      row,
      display: ls.display,
      tokens: { cardMin: px("--card-min"), cardFloor: px("--card-floor"), padX: px("--card-pad-x"), gap: px("--card-gap") },
      cards: measured,
    };
  }, selector);
}

/** data-model §4: the rows a correct layout draws, as lists of card indexes. */
export function greedyRows(own: number[], row: number, gap: number): number[][] {
  const rows: number[][] = [];
  let used = 0;
  own.forEach((w, i) => {
    const c = Math.min(w, row);
    const last = rows[rows.length - 1];
    if (last && used + gap + c <= row + 0.5) {
      last.push(i);
      used += gap + c;
    } else {
      rows.push([i]);
      used = c;
    }
  });
  return rows;
}

/** True when a card's row fit lands within ±0.5 of the row width: report it rather than fail it. */
export function isRoundingTie(own: number[], row: number, gap: number): boolean {
  let used = 0;
  let tie = false;
  own.forEach((w, i) => {
    const c = Math.min(w, row);
    const fits = used > 0 && used + gap + c <= row + 0.5;
    if (used > 0 && Math.abs(used + gap + c - row) <= 0.5) tie = true;
    used = fits ? used + gap + c : c;
    void i;
  });
  return tie;
}

/** Groups measured cards into rows by top ±0.5, in document order. */
export function drawnRows(cards: Pick<MeasuredCard, "top">[]): number[][] {
  const rows: number[][] = [];
  let top = NaN;
  cards.forEach((c, i) => {
    if (rows.length && Math.abs(c.top - top) <= 0.5) rows[rows.length - 1].push(i);
    else {
      rows.push([i]);
      top = c.top;
    }
  });
  return rows;
}

/** A part whose staff has `count` quarter-note bars: long enough for the ruler's long-song cases. */
const longPart = (key: string, label: string, count: number): PartSpec => ({ key, label, columns: bars(count) });

/** Long-ruler song: one part of `barCount` bars (default 16, 40, 200 via the callers) plus two short ones. */
export async function seedLongRuler(page: Page, barCount = 16) {
  return seedSong(
    page,
    [longPart("a", "A", barCount), longPart("b", "B", 2), longPart("c", "C", 2)],
    [{ part: "a" }, { part: "b" }, { part: "c" }],
  );
}

/** Many-chord song: a part with a chord on every one of `chords` columns. */
export async function seedManyChord(page: Page, chords = 24) {
  const names = ["Em7", "A7", "Dmaj7", "G6", "Bm7b5", "C#dim"];
  const columns: Col[] = Array.from({ length: chords }, (_, i) => n(2 + (i % 5), { d: "q", chord: names[i % names.length] }));
  return seedSong(page, [{ key: "a", label: "A", columns }, { key: "b", label: "B", columns: bars(1) }], [{ part: "a" }, { part: "b" }]);
}

/** A song whose one chord name is 40 characters long. */
export async function seedLongChord(page: Page) {
  const chord = "Cmaj7#11b9/G#sus4add13omit5over-the-top-X".slice(0, 40);
  const columns: Col[] = [n(3, { d: "q", chord }), n(5, { d: "q" }), n(3, { d: "q" }), n(5, { d: "q" })];
  return seedSong(page, [{ key: "a", label: "A", columns }, { key: "b", label: "B", columns: bars(1) }], [section("S"), { part: "a" }, sectionEnd, { part: "b" }]);
}

/** Memo song: song M with a ready memo on part B, so one card carries `part-memos`. Call after the app opened the database. */
export async function seedMemoSong(page: Page) {
  const seeded = await seedSongM(page);
  await seedMemo(page, { partLabel: "B", state: "ready" });
  await page.reload();
  return seeded;
}

/** data-model §3: a card's measured minimum width (INV-006). */
export function cardMinimum(m: Measured, i: number): number {
  const chrome = 2 * m.tokens.padX + 2;
  return m.cards[i].memo
    ? Math.max(m.tokens.cardFloor, m.tokens.cardMin)
    : Math.max(m.tokens.cardMin, Math.min(m.cards[i].head + chrome, m.tokens.cardFloor));
}

/** A card's own width: its minimum, or its ruler plus chrome when that is wider. */
export function ownWidths(m: Measured): number[] {
  const chrome = 2 * m.tokens.padX + 2;
  return m.cards.map((c, i) => Math.max(cardMinimum(m, i), c.ruler > 0 ? c.ruler + chrome : 0));
}
