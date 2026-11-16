import type { DrawnPass } from "@/lib/arrangement/passes";
import type { PassBars } from "@/lib/reading/bars";
import { countBars } from "@/lib/tab/layout";

export interface DrawnCard {
  readonly index: number;
  readonly first: number;
  /** Inclusive. */
  readonly last: number;
  readonly count: number;
  readonly pass: DrawnPass;
  readonly offset: number;
  readonly span: { readonly from: number; readonly to: number } | null;
}

export interface DrawnCards {
  readonly cards: readonly DrawnCard[];
  /** cardOf[p] is the index of the card that draws pass p. Built in the same loop as `cards`. */
  readonly cardOf: readonly number[];
}

/** Passes p and p + 1 share a card iff they are consecutive passes of one entry (contracts/cards.md §2). */
function folds(prev: DrawnPass, next: DrawnPass): boolean {
  return (
    next.step.entryId === prev.step.entryId &&
    next.step.partId === prev.step.partId &&
    next.step.pass === prev.step.pass + 1
  );
}

export function drawnCards(passes: readonly DrawnPass[], bars: PassBars): DrawnCards {
  const cards: DrawnCard[] = [];
  const cardOf: number[] = [];
  let first = 0;
  const close = (last: number) => {
    const to = bars.offset[last] + countBars(passes[last].events);
    cards.push({
      index: cards.length,
      first,
      last,
      count: last - first + 1,
      pass: passes[first],
      offset: bars.offset[first],
      span: last > first && to > bars.offset[first] ? { from: bars.offset[first] + 1, to } : null,
    });
  };
  passes.forEach((pass, p) => {
    if (p > 0 && !folds(passes[p - 1], pass)) {
      close(p - 1);
      first = p;
    }
    cardOf.push(cards.length);
  });
  if (passes.length > 0) close(passes.length - 1);
  return { cards, cardOf };
}

export function cardWords(card: DrawnCard, passes: readonly DrawnPass[]): string | null {
  const { pass, passes: n } = card.pass.step;
  if (card.count > 1) {
    return `×${card.count} · passes ${pass}–${passes[card.last].step.pass} of ${n}`;
  }
  return n > 1 ? `pass ${pass} of ${n}` : null;
}

export function cardSpanWords(card: DrawnCard): string | null {
  return card.count > 1 && card.span ? `bars ${card.span.from}–${card.span.to}` : null;
}

export function livePassWords(card: DrawnCard, passes: readonly DrawnPass[], pass: number): string | null {
  if (card.count <= 1) return null;
  return `pass ${passes[pass].step.pass} of ${card.pass.step.passes}`;
}
