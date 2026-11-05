import { TICKS_PER_BEAT } from "./durations";
import { EMPTY_SCORE, type Score, type StreamClick } from "./notation";

/** The count-in length in beats. The only fixed number of beats anywhere. */
export const COUNT_IN_CLICKS = 4;

/**
 * The endless click stream: a count-in, then the score's clicks when `follow`,
 * then a plain beat forever. Pure; ticks run from the first count-in click.
 */
export function* clickStream(score: Score = EMPTY_SCORE, follow: boolean): Generator<StreamClick> {
  for (let i = 0; i < COUNT_IN_CLICKS; i++) {
    yield { tick: i * TICKS_PER_BEAT, level: "beat", phase: "count-in", count: i + 1 };
  }
  const offset = COUNT_IN_CLICKS * TICKS_PER_BEAT;
  let from = offset;
  if (follow && score.clicks.length > 0) {
    for (const click of score.clicks) {
      yield { tick: offset + click.tick, level: click.level, phase: "following", count: null };
    }
    from = offset + score.lengthTicks;
  }
  for (let k = 0; ; k++) {
    yield { tick: from + k * TICKS_PER_BEAT, level: "beat", phase: "plain", count: null };
  }
}
