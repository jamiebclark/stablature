# Contract: the play timeline and the play stream

Module `src/lib/playback/` is React-free, has no Web Audio, and is pure except for `choices.ts`. The shapes are in
[data-model.md](../data-model.md) §2 and §3.

## 1. Exports

```ts
// src/lib/rhythm/notation.ts — exported, behaviour unchanged
export function readGroups(events: readonly EventRow[]): Map<string, Group | null>; // today's `census`
export function hitTicks(duration: Duration, group: Group | null | undefined): number;
// readBar calls hitTicks in place of its inline `(duration.ticks * fit) / n`.

// src/lib/arrangement/passes.ts
export function partPass(part: Pick<PartRow, "id">, events: readonly EventRow[]): DrawnPass;

// src/lib/playback/timeline.ts
export function playTimeline(
  passes: readonly DrawnPass[], tuning: Tuning, opts?: { after?: PlayTimeline }, // `after`: the round before, for the seam (§2.4)
): PlayTimeline;
export function lengthRule(passes: readonly DrawnPass[]): PlayTimeline["rule"]; // the timeline's own rule; also used when there is no tuning
export const HARMONIC_NODES: Readonly<Record<number, number>>; // fret → semitones over open: 12→12, 7→19, 19→19, 5→24, 24→24, 4→28, 9→28, 16→28

// src/lib/playback/stream.ts
export interface PlayControls { click(): boolean; loop(): boolean }
export function roundClicks(score: Score, follow: boolean, roundTicks: number): StreamClick[]; // reads clickStream
export interface PlayRounds { readonly first: PlayTimeline; readonly later: PlayTimeline } // later = playTimeline(…, { after: first })
export function playRounds(passes: readonly DrawnPass[], tuning: Tuning): PlayRounds;
export function playStream(
  rounds: PlayRounds, score: Score, follow: boolean, controls: Pick<PlayControls, "loop">,
): Generator<StreamItem>;
export const audibleFor: (controls: Pick<PlayControls, "click">) => (click: StreamClick) => boolean; // count-in always true

// src/lib/playback/voice.ts — pure numbers the synth applies verbatim
export function waveFor(tone: Voice["tone"], hz: number): { real: Float32Array; imag: Float32Array };
export function voicePlan(voice: Voice, seconds: { start: number; end: number; glide: number }): VoicePlan;
export function energyAbove(hz: number, plan: VoicePlan, atCutoff: "start" | "floor"): number; // SC-012 probe
export const midiToHz: (midi: number) => number;
```

`lengthRule(passes)` and `playTimeline(passes, t).rule` share one implementation: `playTimeline` calls `lengthRule`.

## 2. `playTimeline` rules

1. **Order.** Hits run pass by pass, then event by event, then repetition 0 to `repeat − 1`. Barlines produce nothing.
   Rows that are neither `notes` nor `rest` produce nothing.
2. **Lengths.** Research R4. `QUARTER = DURATIONS.find(d => d.id === "q")`. `carried` resets to null at every pass.
3. **Sounding strings.** For `kind: "notes"`, each key `k` of `frets` is handled as follows:
   - **Skipped** when `Number(k)` is not a whole number, when `tuning.strings[Number(k)]` is undefined, or when the fret
     is neither a non-negative integer nor `"x"`.
   - Otherwise one `PlayVoice` is made, from `drawnTransition(techniques[k] ?? [])` and the decorations set, per
     research R8.

   `kind: "rest"` and an empty `frets` produce no voices.
4. **Previous voice.** For each string, the timeline keeps the last voice and its sounding end, across hits and across
   passes. With `after`, it starts from `after`'s final per-string state, shifted by `−after.lengthTicks`. Without it,
   it starts with nothing sounding. Round 0 is `playTimeline(passes, tuning)`. Every later round is the one
   `playTimeline(passes, tuning, { after: round0 })`, built once at start. Rounds 1, 2, … are therefore byte-equal to one
   another (research R8). Only voices change between round 0 and round 1, never hits or ticks.
5. **Pitches.** These come from research R7. A thud's `midi` is the open string's.
6. **Never throws** for any `EventRow[]` the schema allows, including unknown `durationHint` strings, unknown technique
   strings (ignored), negative or fractional repeats (treated as `max(1, floor)`), and frets out of range (skipped).

## 3. Length corpus (unit, INV-003)

Each row is a hand oracle written in beats, with Q = one beat. Durations: `w` = 4, `h` = 2, `q` = 1, `8` = ½,
`16` = ¼, `32` = ⅛. `t3[…]` is a counted group of 3 that reads.

| ID | Pass(es) | Starts (beats) | Lengths | Rule |
|---|---|---|---|---|
| L1 | the spec's worked example: `5 · 7(8) · 7 · t3[5 7 9] · space` | 0, 1, 1½, 2, 2⅓, 2⅔, 3 | 1, ½, ½, ⅓, ⅓, ⅓, ½; total 3½ | some |
| L2 | eight unset columns | 0..7 | 1 each | none |
| L3 | `q q 8 8 | h` all set | 0, 1, 2, 2½, 3 | 1, 1, ½, ½, 2 | written |
| L4 | `8 · unset | unset` (carried across a barline) | 0, ½, 1 | ½ each | some |
| L5 | pass 1 `8 · unset`, pass 2 `unset` (reset at a pass) | 0, ½, 1 | ½, ½, 1 | some |
| L6 | L5 looped: round 2 starts at 2; its pass 1 `8` again | 2, 2½, 3 | ½, ½, 1 | some |
| L7 | `"64"` (unknown stored value) then unset | 0, 1 | 1, 1 | none |
| L8 | `8 ×4` (repeat 4, set) | 0, ½, 1, 1½ | ½ each | written |
| L9 | `16 · unset ×3` | 0, ¼, ½, ¾ | ¼ each | some |
| L10 | `t3[8 8 8]` set | 0, ⅓, ⅔ | ⅓ each | written |
| L11 | `8 · t3[unset unset unset]` | 0, ½, ⅚, 1⅙ | ½, ⅓, ⅓, ⅓ | some |
| L12 | group number 3 over 4 columns (does not read), all `8` | 0, ½, 1, 1½ | ½ each | written |
| L13 | `t3` with one column `repeat 2` (does not read), `8` | 0, ½, 1, 1½ | ½ each | written |
| L14 | `t3` cut by a bar slice to 2 columns, `8` | 0, ½ | ½ each | written |
| L15 | plain group (`groupKind: "plain"`, no count) of 3, `8` | 0, ½, 1 | ½ each | written |
| L16 | for n = 2..16, a counted group of n `16`s that reads | i × ¼ × fit/n | ¼ × fit/n each | written |
| L17 | `| |` only (barlines) | (none) | (none); `lengthTicks` 0 | empty |
| L18 | `[]` | (none) | (none) | empty |
| L19 | trailing barline, double barline, no barlines: the same four `q`s | 0, 1, 2, 3 | 1 each | written |
| L20 | a space `×8` unset, after `8` | 0, ½ … 4 | ½ each | some |
| L21 | 1 bpm and 999 bpm: L3 in seconds through the engine | 60 × beats; 0.06006 × beats | the same | written |

## 4. Technique corpus (unit, INV-005)

One row per table row × each of its cases. The expected `Voice` is written out in full in
`src/lib/playback/__tests__/techniques.test.ts`, never computed by calling the code under test.

| ID | Input on string 3 (E1, MIDI 28) unless said | Expected |
|---|---|---|
| T1 | `5` then `7[hammer_on]`, adjacent | 2nd: `attack none`, midi 35, `glideFrom null` |
| T2 | `7[hammer_on]` with nothing before | `attack soft`, midi 35 |
| T3 | `7` then `5[pull_off]`; `5[pull_off]` alone | `none` / `soft` |
| T4 | `7` then `9[slide_up]` | `attack none`, `glideFrom 35`, midi 37, `glideTicks = min(len(7)/2, ½ beat)` |
| T5 | `9[slide_up]` alone; `9[slide_down]` alone | `soft`, `glideFrom 34`; `soft`, `glideFrom 40` |
| T6 | `7[vibrato]` | `vibrato true`, otherwise as `7` |
| T7 | `5[palm_mute]`, 1 beat | `tone muted`, `sustain half`, `endTick = tick + ½ beat` |
| T8 | chord `0:2 1:2 2:4` with `let_ring` on each, then `3:0` | the three: `sustain ring`, not ended by `3:0` |
| T9 | `12[harmonic]` `7[h]` `19[h]` `5[h]` `24[h]` `4[h]` `9[h]` `16[h]` `3[h]` | midi 40, 47, 47, 52, 52, 56, 56, 56, 31; `tone harmonic`, `sustain long` |
| T10 | `7[bend]`, `7[tap]`, `7[bend,tap,…]` | each `Voice` deep-equals plain `7`'s |
| T11 | `7[tap]` then `5[pull_off]` | 2nd `attack none` |
| T12 | `x` on each string of a 5-string B tuning | `tone dead`, `sustain thud`, midi = open string, falling with string index |
| T13 | `x[palm_mute]`; `x[slide_up]`; `x[hammer_on, vibrato, let_ring, harmonic]` | `thud-muted`; `thud`, no glide; `thud`, nothing else |
| T14 | `5[dead_note]` | as `x` on that string |
| T15 | `5` then `x` then `7[hammer_on]` | the hammer-on's attack is `soft` (a thud never carries) |
| T16 | `[slide_up, hammer_on]` on one string, string sounding | `hammer_on` wins (priority order): `attack none`, no glide |
| T17 | a pass starting `7[hammer_on]` after a pass ending `5` on that string | `attack none` (across the pass boundary) |
| T18 | loop: a part `7[hammer_on] … 5` | round 1: `soft`; rounds 2 and 3: `none`, byte-equal to each other |
| T19 | string 9 on a 4-string tuning; string `"a"`; fret `-1`; fret `2.5` | no voice, no throw; the column's other voices are kept |

## 5. Pitch corpus (unit, INV-002)

Every preset in `TUNING_PRESETS` × every string × frets {0, 1, 5, 12, 24}. The expected value is `noteToMidi(open) +
fret`, computed from a hand table of the open strings' MIDI numbers in the test, not from `fretToMidi`. Plus the
lowest note of all, `bass5-drop-f` string 4 fret 0 = MIDI 17 (F0).

## 6. Stream corpus (unit, INV-004, INV-007, INV-008)

| ID | Case | Expected |
|---|---|---|
| S1 | L2 at 120 bpm, Loop off | count-in clicks at ticks 0..3 × Q; marks and notes at 4Q + k·Q for k = 0..7; `end` at 12Q |
| S2 | L2, Loop on, 3 rounds | round r's first mark at 4Q + 8rQ; no count-in after the first; no item between rounds |
| S3 | L1 with `follow`, a timed score | the round's clicks equal `clickStream(score, follow)` after the count-in, rebased and cut at 3½Q |
| S4 | every timed fixture of the rhythm corpus (the 11 `BARS` × 5 `ARR` of `positions-vs-click.test.ts`, plus notation-oracle G's seeds) | for every `ColumnTick` c of `notationColumns(passes)`, the hit with the same (pass, eventId, repetition) has `tick === c.tick` |
| S5 | a click and a note at the same tick, through the fake engine | the port receives both at the identical `time` (`===`) |
| S6 | `audibleFor({ click: () => false })` | count-in clicks true; every other click false |

## 7. Engine corpus (unit, fake clock, INV-007, INV-008, INV-009)

These use the `rig` pattern from `scheduler.test.ts` (fake `now`, fake timers with jitter, a fake port that records
`schedule` and `note`). The fake port is in `src/lib/playback/__tests__/fake-port.ts`.

| ID | Case | Expected |
|---|---|---|
| E1 | 10 minutes at 40, 120 and 240 bpm (effective), Notes and Click on, jitter up to 20 ms | every scheduled `time` is within 1 ms of `START + tick / TPB × 60 / bpm`; the error does not grow (the last 100 match the first 100's bound) |
| E2 | L1 looped for 10 minutes | for every round r, its first note's time minus the previous round's last hit's end is 0 ± 1e-9 s |
| E3 | Loop off | stop reason `ended`, not `fell-behind`; `ended` happens at the first top-up at or after the end time |
| E4 | a stall of 2 s mid-run | `fell-behind`; nothing queued with `time < now` |
| E5 | `setTempo` mid-run (speed 100 → 50) | the next unqueued item is at the new spacing; no count-in; marks follow their own queued times |
| E6 | 100 stops at random moments, every `StopReason` | `close()` called exactly once per run, synchronously inside `stop` |
| E7 | a stream of only clicks (`clickStream`) | identical `schedule` calls and `due()` results to `main`'s engine on the same rig (golden list recorded from `main` in T001) |
| E8 | `start` twice synchronously | one run (INV-024) |
| E9 | Click toggled off at t | no `schedule` with `time ≥` the first click queued after t; display queue still has them |
| E10 | Loop toggled off at t | `end` lands at the first round end whose last item is pulled after t |
