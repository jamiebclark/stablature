# Contract: beat positions and beaming (pure functions)

**Modules**: `src/lib/rhythm/notation.ts` (one new export, `barPositions`), `src/lib/rhythm/beams.ts` (new: `rhythmMarks`, `groupLabels`).
Both are React-free. Types are in [data-model.md](../data-model.md).

## `barPositions(events)`

| Given | Then |
|---|---|
| Any `events` | Every value's `tick` equals the `at` that `readBar` passes to `hit` for that `(eventId, repetition)`. There is one implementation, and `barPositions` calls `readBar`. |
| A bar `q 8 8` | `{e1:0 → 0, e2:0 → 360360, e3:0 → 540540}` |
| A bar `8 unset 8` | only `e1:0`; `e2` and `e3` are missing |
| Bar 1 holds an unset column, bar 2 is `8 8` | bar 2's two entries are present, at ticks 0 and 180180 (FR-006) |
| A counted triplet of 8ths that reads | three entries at 0, 120120 and 240240, each with `countedGroup` = the group's id |
| A counted group of 3 with a `repeat: 2` column | no entry from the group's first column onward, in that bar (spec 005 census) |
| A plain group with `repeat: 4` on a 16th | four entries `e:0` to `e:3`, 90090 apart, with `countedGroup: null` |
| A counted 3 holding 2 columns (still being built) | no entry from the group's first column onward |

**Unchanged**: `readNotation`, `notationColumns` and `beatsPerBar` return what they return on `main` for every input.
`notation-baseline.test.ts` and `notation-oracle.test.ts` are run unedited (INV-003).

## `rhythmMarks(columns, positions, density)`

The output's length equals `columns.length`. For every `i`, `out[i].right === out[i+1].left` (a structural check in the test).

### FR-036 corpus

Each row is one `it(...)` in `src/lib/rhythm/__tests__/beams.test.ts`. The expected output is written by hand as runs, flags and stubs. It is
never computed by a second implementation. `|` is a barline, and `[ … ]` is a group (`3:` means counted with n = 3, `p:` means plain).

| # | FR-036 item | Bar(s), expanded unless stated | Expected |
|---|---|---|---|
| 1 | beat boundaries, eighths | `8 8 8 8 8 8 8 8` | runs (0,1) (2,3) (4,5) (6,7), each level 1 |
| 2 | beat boundaries, mixed | `16 16 8 16 8 16` | (0,1,2) then (3,4,5). In run 2, `16 8 16`: level 2 stub right on 3, left on 5 |
| 3 | note straddling a beat | `8 q 16 16` | 0 flagged; the quarter (at 0.5) draws a stem only; (2,3) at 1.5 and 1.75 share beat 1: beamed, level 2 |
| 4 | an eighth straddling a beat | `8 16 8 16` | starts at 0, 0.5, 0.75 and 1.25. (0,1,2) is one run with joins 1, 1 and a level-2 stub on 1 pointing left; 3 is alone in beat 1: two flags. The eighth at 0.75 runs past the beat but starts inside it |
| 5 | fractional bar | `8 8 8` | (0,1), then 2 with one flag |
| 6 | barline between | `8 \| 8 8 \| 8` | 0 flag; (2,3); 5 flag |
| 7 | rest inside a beat | `16 r16 16 16` | starts 0, 0.25, 0.5, 0.75: 0 has two flags; 1 is a rest; (2,3) beamed. The rest breaks the beat's run in two |
| 8 | unset inside a beat | `16 unset 16 16` | 0 flagged (2). 2 and 3 have no position: flagged, unbeamed |
| 9 | counted triplet | `[3: 8 8 8] 8 8` | (0,1,2) one unit; the triplet ends at 1.0, so (3,4) at 1.0 and 1.5 are beamed |
| 10 | triplet off the beat | `8 [3: 8 8 8] 8` | 0 flag; (1,2,3) one run across beat 1; 4 flag |
| 11 | counted group of five | `[5: 16 16 16 16 16]` | (0..4) one run, level 2 throughout |
| 12 | plain group, by beat inside it | `[p: 16 16 16 16 16 16 16 16]` | (0..3) and (4..7) |
| 13 | beams stop at group edges | `16 [p: 16 16] 16`, all four in beat 0 | 0 has two flags; (1,2) beamed; 3 has two flags |
| 14 | group next to a barline | `8 [3: 8 8 8] \| 8 8` | 0 flag; (1,2,3); (5,6) |
| 15 | plain group with a repeat, expanded | `[p: 16×4 8 8]` | columns 0..3 (the hits) one run; (4,5) one run |
| 16 | the same, compact | `[p: 16×4 8 8]` compact | column 0 (`x4`) has flags 2 and is never joined; (1,2) one run |
| 17 | counted group with a repeat | `[3: 8×2 8 8] 8 8` | no positions: every note is flagged and none is joined |
| 18 | group still being built | `[3: 8 8]` | not joined; each has flags 1 |
| 19 | bar after one that cannot be timed | `unset 8 \| 8 8` | column 1 (after the unset column) has one flag; columns 3 and 4 are beamed |
| 20 | whole, half, quarter | `w \| h h \| q q q q` | levels 0, flags 0, never joined |
| 21 | rests | `r_w \| r_h \| r_q r_8 r_16 r_32` | `kind: "rest"` with that duration; each breaks a run |
| 22 | unknown stored value | `8 "64" 8` | the middle is `none`; 0 and 2 are flagged (unknown is unset, so 2 has no position) |
| 23 | 32nds | `32 32 32 32 32 32 32 32` | (0..7) one run, level 3 |
| 24 | 32nds beside an 8th and a 16th | `8 32 32 16` | starts 0, 0.5, 0.625, 0.75: one run; joins 1, 3, 2; no stubs |

Start positions are given in beats from the bar's start. The test restates each row's starts in a comment beside its expected value.

### Every number once

| # | Case | Expected |
|---|---|---|
| L1 | one counted group, one span | `groupLabels` has one entry at the middle column |
| L2 | a legacy group across a barline (two spans, one id) | one entry, at the first span's middle |
| L3 | a plain group | no entry |
| L4 | two adjacent counted groups | two entries |

## Errors

None. Every input, including empty columns, unknown durations and any kind not yet in `EventKind`, maps to `none`. These functions never
throw.
