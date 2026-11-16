/**
 * The play stream: the count-in, then round after round of the click's own clicks, the marks and the notes, all as
 * ticks the one engine turns into audio times (contracts/playback-stream.md). Pure; no Web Audio.
 */
import type { DrawnPass } from "@/lib/arrangement/passes";
import { TICKS_PER_BEAT } from "@/lib/rhythm/durations";
import type { Score, StreamClick } from "@/lib/rhythm/notation";
import type { StreamItem } from "@/lib/rhythm/scheduler";
import { clickStream, COUNT_IN_CLICKS } from "@/lib/rhythm/stream";
import type { Tuning } from "@/lib/tunings";
import { playTimeline } from "./timeline";
import type { PlayTimeline } from "./types";

export interface PlayControls {
  click(): boolean;
  loop(): boolean;
}

/** One round's clicks: `clickStream`'s own, without the count-in, rebased to the round's start and cut at its end. */
export function roundClicks(score: Score, follow: boolean, roundTicks: number): StreamClick[] {
  const out: StreamClick[] = [];
  const shift = COUNT_IN_CLICKS * TICKS_PER_BEAT;
  let skipped = 0;
  for (const click of clickStream(score, follow)) {
    if (skipped < COUNT_IN_CLICKS) {
      skipped++;
      continue;
    }
    const tick = click.tick - shift;
    if (tick >= roundTicks) break;
    out.push({ ...click, tick });
  }
  return out;
}

export interface PlayRounds {
  readonly first: PlayTimeline;
  /** Every round after the first: the same timeline with the seam from the round before. */
  readonly later: PlayTimeline;
}

export function playRounds(passes: readonly DrawnPass[], tuning: Tuning): PlayRounds {
  const first = playTimeline(passes, tuning);
  return { first, later: playTimeline(passes, tuning, { after: first }) };
}

/** Tie order at one tick: click, then mark, then note. */
const ORDER = { click: 0, mark: 1, note: 2 } as const;

export function* playStream(
  rounds: PlayRounds,
  score: Score,
  follow: boolean,
  controls: Pick<PlayControls, "loop">,
): Generator<StreamItem> {
  const count = COUNT_IN_CLICKS * TICKS_PER_BEAT;
  let taken = 0;
  for (const click of clickStream(score, follow)) {
    yield click;
    if (++taken === COUNT_IN_CLICKS) break;
  }
  const length = rounds.first.lengthTicks;
  if (length <= 0) {
    yield { kind: "end", tick: count };
    return;
  }
  const clicks = roundClicks(score, follow, length);
  for (let r = 0; ; r++) {
    const timeline = r === 0 ? rounds.first : rounds.later;
    const offset = count + r * length;
    const items: { order: number; item: StreamItem }[] = [];
    for (const c of clicks) items.push({ order: ORDER.click, item: { ...c, tick: c.tick + offset } });
    for (const h of timeline.hits) {
      items.push({
        order: ORDER.mark,
        item: { kind: "mark", tick: h.tick + offset, mark: { pass: h.pass, eventId: h.eventId, repetition: h.repetition } },
      });
    }
    for (const v of timeline.voices) {
      items.push({
        order: ORDER.note,
        item: { kind: "note", tick: v.tick + offset, endTick: v.endTick + offset, voice: v.voice },
      });
    }
    items.sort((a, b) => a.item.tick - b.item.tick || a.order - b.order);
    for (const { item } of items) yield item;
    if (!controls.loop()) {
      yield { kind: "end", tick: offset + length };
      return;
    }
  }
}

/** Click is read when each click is queued. The count-in always sounds. */
export const audibleFor =
  (controls: Pick<PlayControls, "click">) =>
  (click: StreamClick): boolean =>
    click.phase === "count-in" || controls.click();
