# Data model: Tab playback

**Nothing is stored.** There is no new field, table, migration, sync message, export field or import rule.
`src/lib/model.ts`, `src/db/`, `drizzle/` and `src/lib/sync/` have zero diff (INV-019). Everything below is derived when
a run starts, or held in memory, or (one boolean) in device-local storage.

## 1. Playback run

The run that starts with a tap on Play and ends at the run's end or a stop.

| Field | Type | Source |
|---|---|---|
| `scope` | `"song"` \| `"part"` | the route: `/play` or `/play/[partId]` |
| `passes` | `readonly DrawnPass[]` | `drawnPasses(steps, eventsByPart)` for the whole song, or `[partPass(part, events)]` for one part |
| `notes` | boolean | the Notes switch (§4) |
| `click` | () => boolean | read when each click is queued (research R6) |
| `loop` | () => boolean | read at each round's end (research R6) |
| `follow` | boolean | the existing `click-follow` choice, and'ed with `score.timedFromStart` as today |
| `effectiveBpm` | number | `usableTempo(song.bpm) × speed / 100` |
| `timeline` | `PlayTimeline` | `playTimeline(passes, tuning)` (§2), fixed at start |

**States.** These are the engine's existing states: `idle` → `starting` → `running` → `idle`. The stop reasons are
`tap`, `left`, `hidden`, `audio-lost` and `fell-behind`, plus the new **`ended`**, which leaves no stopped line. While
`running`, the bar shows `Counting in.` until the first mark is due, then `Playing.`.

**Edits during a run.** The run plays what it started with (spec 005 FR-051). `passes`, `timeline`, `score` and
`columns` are captured at `start()`.

## 2. Play timeline (pure, `src/lib/playback/timeline.ts`)

```ts
interface PlayTimeline {
  readonly hits: readonly PlayHit[];   // every column hit, in order, spaces included, barlines excluded
  readonly voices: readonly PlayVoice[]; // every sounding string of every hit, in tick order
  readonly lengthTicks: number;        // one round: the sum of every hit's ticks
  readonly rule: "written" | "some" | "none" | "empty";
}

interface PlayHit {
  readonly tick: number;               // from the round's first moment
  readonly ticks: number;              // this hit's length
  readonly pass: number;               // index into passes
  readonly eventId: string;
  readonly repetition: number;         // 0 .. repeat-1
}

interface PlayVoice {
  readonly tick: number;               // = its hit's tick
  readonly endTick: number;            // tick + sounding length (see `sustain`); for "ring"/"long", its hit's end
  readonly string: number;             // the string index, 0 = highest
  readonly voice: Voice;
}

interface Voice {
  readonly string: number;
  readonly midi: number;               // fretToMidi, the harmonic table, or for a thud the open string
  readonly attack: "pick" | "soft" | "none";
  readonly glideFrom: number | null;   // midi; with attack "none" the glide ends at the note's start,
                                       // with "soft" it starts there (slide in from ±3)
  readonly glideTicks: number;         // 0 unless glideFrom is set
  readonly vibrato: boolean;
  readonly tone: "plain" | "muted" | "harmonic" | "dead";
  readonly sustain: "length" | "half" | "ring" | "long" | "thud" | "thud-muted";
}
```

**Validation rules.**

- `hits` holds exactly one entry per (playable event × repetition) of every pass, in pass order then event order. Its
  `(pass, columnKey(eventId, repetition))` list equals `readingStops(passes, …)` with the bar dropped (INV-010).
- `hits[i+1].tick = hits[i].tick + hits[i].ticks`, and `lengthTicks = last.tick + last.ticks`.
- A hit's `ticks` is `hitTicks(set ?? carried ?? QUARTER, group)` (research R4).
- `voices` has no entry for a string missing from the tuning, a space, a rest, or an empty notes column.
- `bend` and `tap` never change a `Voice` (INV-005).
- `attack: "none"` only when the same string's previous voice has a sounding end ≥ this tick (research R8).

## 3. Stream items (`src/lib/rhythm/scheduler.ts`)

| Item | Fields | Engine does |
|---|---|---|
| `StreamClick` (unchanged) | `tick, level, phase, count` | Queues a click on the port if `audible(item)`, and always on the display queue. |
| `StreamNote` | `kind: "note", tick, endTick, voice` | Calls `clock.note?.(timeOf(tick), timeOf(endTick), voice)`. |
| `StreamMark` | `kind: "mark", tick, mark: { pass, eventId, repetition }` | Pushes onto the mark queue, drained by `dueMarks()`. |
| `StreamEnd` | `kind: "end", tick` | Fixes `endAt = timeOf(tick)` and stops pulling. The first top-up with `now ≥ endAt` calls `stop("ended")`. |

`playStream(timeline, score, follow, controls)` (`src/lib/playback/stream.ts`) yields, with ticks from the first
count-in click:

1. the count-in, which is `clickStream`'s first four items;
2. for round r = 0, 1, …: the round's clicks (`roundClicks`, research R5), marks and notes, each offset by
   `C + r × lengthTicks` (where C = 4 × `TICKS_PER_BEAT`) and merged by tick;
3. after a round: if `controls.loop()`, the next round; otherwise `end` at `C + (r + 1) × lengthTicks`.

For `lengthTicks = 0` (rule `empty`) Play is unavailable and no stream is built.

## 4. Choices (`src/lib/playback/choices.ts`)

| Name | Values | Held | Initial |
|---|---|---|---|
| `notes` | boolean | `localStorage["stablature.play"]` as `{ "notes": true }`; memory wins after a set; anything unparseable reads as off and is left alone | off |
| `click` | boolean | memory, for the app session | on |
| `loop` | boolean | memory, for the app session (whole song only) | off |
| `speed` | 50, 55, …, 100 | memory, `Map<songId, number>` | 100 |

Part playback has its own `notes` (on) and `loop` (on) in component state. It reads and writes the shared `click` and
`speed`.

**Validation.** `setSpeed(songId, v)` clamps to [50, 100] and rounds to a multiple of 5. Nothing in this module calls
`mutate.ts`, Dexie or `fetch`.

## 5. The playback song (fixture)

This is the fit song from `e2e/wide-helpers.ts` `seedFitSong`: a 4-string bass, standard E (`G2 D2 A1 E1`), its parts,
and its arrangement of ten passes. Then:

- every `durationHint` is set to null;
- `bpm` is 120;
- part **T** is added, and an arrangement entry for T is appended (11 passes).

**Part T** (string 0 = G, 3 = E). Written as `string:fret[techniques]`, with columns separated by spaces and `|` as a
barline:

```
3:5  3:7[hammer_on]  |  3:7  3:9[slide_up]  |  2:5[slide_up]  1:7[slide_down]  |
3:5[pull_off]  3:3[pull_off]  |  2:7[vibrato]  |  3:5[palm_mute]  3:5[palm_mute]  3:x  3:x[palm_mute]  |
0:2[let_ring]+1:2[let_ring]+2:4[let_ring]  3:0  |  3:12[harmonic]  2:7[harmonic]  1:5[harmonic]  0:4[harmonic]  2:3[harmonic]  |
3:7[bend]  3:7[tap]  3:7[tap]  3:5[pull_off]  |  3:x[slide_up]  3:5[dead_note]  9:3  |  rest
```

Row by row:

1. A hammer-on with its string sounding.
2. A slide up with its string sounding.
3. Slides with nothing sounding on their strings (the A and D strings are fresh).
4. Pull-offs, sounding.
5. Vibrato.
6. Palm mute, then the thud and the muted thud.
7. A let-ring chord, then a note on another string.
8. Harmonics at 12, 7 and 5, at 4, and at a non-node fret (3).
9. Bend and tap ignored, with a pull-off after a tap.
10. A dead note with a slide into it, `dead_note` on a fret, and string 9, which a 4-string tuning lacks.
11. A space.

The unit twin builds this from the same text in `src/lib/playback/__tests__/fixtures.ts`. The e2e seeder takes the
same text, so both read one table.

## 6. Words (`CLICK_WORDS.notes`, `src/components/rhythm/ClickBar.tsx`)

| Key | Words | Shown when |
|---|---|---|
| `noTempo` | `Set a tempo to play the notes.` | Notes on, no usable tempo |
| `noTuning` | `Add a tuning to hear the notes.` | Notes on, no tuning |
| `empty` | `There are no notes to play here.` | `rule === "empty"` |
| `written` | `Notes play the lengths written.` | `rule === "written"` |
| `some` | `Notes with no length take the last length, or one beat.` | `rule === "some"` |
| `none` | `No note has a length, so each plays one beat.` | `rule === "none"` |
| `running.playing` | `Playing.` | running, after the count-in, Notes on |

The bar reads `timeline.rule` and nothing else to pick among the last four. The words and the timeline cannot disagree
(INV-023).
