# Contract: reading the notation

`readNotation(passes: readonly DrawnPass[]): Score` in `src/lib/rhythm/notation.ts`, and
`clickStream(score, follow)` in `src/lib/rhythm/stream.ts`. Both are pure. They import nothing from
React, Dexie or the audio code. The rules are the spec's section **How the click reads the notation**,
and this contract fixes what the spec leaves to a reader.

## The walk

For each pass in order, take a census of its groups, split its events at barlines, and for each bar in
order:

1. A bar with no playable column is skipped. It is neither timed nor a gap.
2. If the bar is not timed, the walk **ends**, returning what it has.
3. Otherwise emit the bar's clicks and move on by the bar's length.

A pass with no columns contributes nothing and is not a gap. The end of a pass ends a bar, so a bar
never joins the next pass.

`timedFromStart` is true when at least one bar was emitted.

## A playable column

`kind` is `"notes"` or `"rest"`. A `notes` row with empty `frets` is playable. Hits are
`Math.max(1, event.repeat)`, the same rule `layoutPart` draws by.

## Timed

A bar is timed when both hold:

- every playable column in it has `readDuration(event.durationHint)` not null, and
- every **counted** group touching it passes the census test.

The census, per pass and per `tupletId`, over playable rows only:

| Fact | From |
|---|---|
| `columns` | How many stored rows hold this id in this pass |
| `repeated` | Whether any has `repeat > 1` |
| `numbers` | The set of `groupNumber(row)` over them |

| Group | Reads as | Test |
|---|---|---|
| `numbers` is `{null}` | Plain | Always passes |
| `numbers` is `{n}` | Counted | `n === columns`, not `repeated`, and `n` has a fraction |
| Anything else | Rows disagree | Fails |

A group failing the test makes untimed every bar it touches. Columns of one id need not be adjacent:
the census counts ids, not drawn brackets.

## Fractions

`hitTicks = duration.ticks × fit / n`, which is always a whole number.

| `n` | `fit` |
|---|---|
| 2, 4, 8, 16 | `n` |
| 3 | 2 |
| 5, 6, 7 | 4 |
| 9 to 15 | 8 |
| Anything else | No fraction: the group fails the census |

A plain group, or a column in no group, has `hitTicks = duration.ticks`.

## A timed bar's clicks

Positions are ticks from the start of the bar, up to but not including its length.

| Level | Where |
|---|---|
| `accent` | 0 |
| `beat` | Every multiple of `TICKS_PER_BEAT` |
| `soft` | Every hit of a counted group of any number, including 2, 4, 8 and 16 |
| `soft` | The first hit of a plain group in this pass, once, wherever it falls |

A space is a hit. It has a length and takes the same place in a group as a note.

One click per position, the strongest of `accent`, `beat`, `soft`. Clicks come out in ascending order.

**A bar's clicks depend on that bar and its pass's census, and on nothing else.** No bar's length is
compared with any other's, and no expected length exists (FR-048).

## The stream

| Stage | Ticks | Level | Phase | `count` |
|---|---|---|---|---|
| Count-in | 0, 1, 2 and 3 beats | `beat` | `count-in` | 1 to 4 |
| Notation, when `follow` | 4 beats + each score click | From the score | `following` | null |
| Plain, forever | Every beat from where the above ended | `beat` | `plain` | null |

- With `follow` false, or an empty score, the plain beat starts at 4 beats, one beat after the fourth
  count-in click, so Story 1 has no gap.
- With a score, the plain beat starts at `4 beats + score.lengthTicks`, with a click on that moment.
  That is what "no break in time" means when the score ends off the beat.
- The count-in is `beat` level because an accent means "the start of a bar", and it is not a bar.

## Fixtures, as literals

Beats are written as fractions. Each case is in `src/lib/rhythm/__tests__/notation.test.ts`.

**Worked example** (spec): four `q`, barline, a triplet of `8`, `q`, `h`.

| Beat | 0 | 1 | 2 | 3 | 4 | 4⅓ | 4⅔ | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|---|---|---|
| Level | accent | beat | beat | beat | accent | soft | soft | beat | beat | beat |

Length 8.

**Five eighths, three quarters.** Accent at 0, beat at 1 and 2, accent at 2½, beat at 3½ and 4½. Length
5½.

**Each counted size.** For `n` from 2 to 16 and each of the six durations: `n` softs apart from where a
stronger click lands, and the group lasts `n × d × fit / n` beats.

**Repeat.** `7x8` marked `8`: one column, four beats, clicks at 0, 1, 2, 3, with no soft.

**Pickup.** One `8`, barline, `q`: accent at 0, accent at ½.

**No barlines.** A whole pass is one bar, with one accent.

**Plain group.** `8 8 8 8` in a plain group starting on the second column: accent at 0, soft at ½, beat
at 1.

**Fall to plain.** Three timed bars of four `q`, then a bar with one null: score length 12, last click
at 11, and the stream's next click is a `plain` `beat` at 16 counting the count-in.
