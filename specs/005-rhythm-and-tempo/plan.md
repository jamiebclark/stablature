# Implementation Plan: Durations, tap tempo and a click

**Branch**: `005-rhythm-and-tempo` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-rhythm-and-tempo/spec.md`

## Summary

Give the app a sense of time in three pieces: a click with a count-in on the play view, tap tempo from
one shared sheet, and a six-position duration row in the column inspector. No stored shape changes,
because `durationHint` and `bpm` already exist and already merge per field. Each rule has one owner,
so two things cannot drift apart:

- **One table of durations.** `DURATIONS` gives each value its mark, words and length, and every read
  goes through `readDuration`, so an unknown value reads as unset on every surface at once.
- **One account of the passes.** `drawnPasses` is lifted out of `PlayView`. The screen draws from it
  and the click walks it.
- **One reading of a song's rhythm.** A pure `readNotation` turns passes into exact clicks, in integer
  ticks, so "strongest wins" is a real comparison and not a float tolerance.
- **One queue.** The scheduler puts each click on one queue, read by both the audio and the visual
  beat, so the two cannot disagree about when a click happens.
- **One test of a tempo.** `usableTempo` gates start, the control's text and live changes alike.

Durations draw as the position's own label under the staff, so the marks need no second vocabulary.
The capture staff stays as it is, the status row names the duration at the cursor, and the text export
does not change.

The risky browser assumptions were run before this was written. Web Audio works in the suite's
headless Chromium, a page-level recorder can read every scheduled `when`, and `close()` silences
synchronously. Headless Chromium does **not** enforce the autoplay rule, so that probe has to count
constructions. See [research.md](./research.md).

No migration, no new dependency, no new route, no new colour token, no change to `public/sw.js`.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router)

**Primary Dependencies**: Tailwind CSS 4, Dexie 4 with `dexie-react-hooks`, `lucide-react`, Zod. The
Web Audio API and Screen Wake Lock API are browser features. **No new dependency.** The one Next.js
concern is lazy loading, which this entry must not use (`lazy-loading.md`, research R19).

**Storage**: Dexie/IndexedDB locally, mirrored to Postgres through `src/lib/sync/`. **No change**: no
table, field, wire shape, migration or IndexedDB version.

**Testing**: Vitest 5 (`npm test`), node by default, jsdom by docblock, `fake-indexeddb` for writes.
Playwright 1.64 (`npm run test:e2e`) against a production build, projects `mobile` (Pixel 7) and
`desktop`. Sync scenarios need Postgres and skip without it. A person-level browser pass at actual
size in both themes after merge, and a list owed to a real phone.

**Target Platform**: Installable PWA in a mobile browser, offline-capable. The smallest supported
viewport is 375×667.

**Project Type**: Next.js web application, single package. The play and capture screens are
`"use client"`.

**Performance Goals**: Every click within 1 ms of ideal on the audio clock, with no growth over ten
minutes (SC-003). First click within 200 ms of the tap (SC-005). **Ran**: `resume()` took 34 ms in
headless Chromium, which is not a phone figure. No click moved or dropped by a 200 ms stall (SC-004),
which a 750 ms queue covers.

**Constraints**:
- The audio must start inside the tap, before any `await` (FR-028).
- A refused row fails the whole push, so a tempo set by tapping must be one the wire accepts.
- `ascii.ts`, `text.ts`, `public/sw.js`, `protocol.ts` and everything in INV-043 have **zero diff**.
- A visual tier is never opacity over a surface. `text-text-faint` fails 4.5:1 and is not used for
  anything this entry adds.
- `round-trip.test.ts` fails on any unlisted `*.test.ts` in `src/lib/tab/__tests__/`, so new tests go
  in `src/lib/rhythm/__tests__/` (research R16).
- `tsconfig.json` includes `specs/` and test files, so review probes must pass `npm run typecheck`.
- `npm run dev:clean` before debugging a style that appears to do nothing. Never run the build or e2e
  suite while a dev server holds the same `.next`.
- Edits keep each file's line endings. `TabStaff.tsx`, `SongView.tsx` and `ui/index.tsx` are CRLF.
  `ui/index.tsx` is not touched. `PlayView.tsx`, `CaptureScreen.tsx`, `ColumnInspector.tsx`,
  `properties.ts`, `layout.ts` and `editing.ts` are LF.

**Scale/Scope**: 11 new source files (~1,050 LOC: `scheduler.ts` ~170, `TempoControl.tsx` ~170,
`notation.ts` ~130, `ClickBar.tsx` ~130, `useClick.ts` ~130, `audio.ts` ~110, `tap.ts` ~70,
`durations.ts` ~50, `stream.ts` ~40, `tempo.ts` ~25, `passes.ts` ~20). 8 modified source files, most
by a few lines. Three existing test files change, one line or so each.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no ratified
constitution to gate against. As in the previous entries, the gates below are the project's de facto
rules from `docs/DECISIONS.md`, `AGENTS.md` and the code's own headers. See *Open for the human*.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Browser testing is part of done**, at actual size, in both themes. | `docs/DECISIONS.md` | PASS (owed after merge) | INV-044, `quickstart.md` §8. The pipeline has no browser, so nothing is claimed until a person has looked. |
| **No colour decision from a magnified crop.** | `docs/DECISIONS.md` | PASS | No new colour. INV-011 computes contrast on the real surface, and §8 is at actual size. |
| **A visual tier is never opacity over a surface token.** | `docs/DECISIONS.md` | PASS | Named tokens only. The marks use `text-text-dim`, which measures at least 6.38:1 on every surface. |
| **The layout is the one source for screen and export.** | `layout.ts`, `ascii.ts`, `TabStaff.tsx` headers | PASS | `duration` is carried on `TabColumn`, and `ascii.ts` has zero diff. |
| **Barlines are stored, never inferred from durations.** | `layout.ts` header | PASS | Nothing in layout reads a duration for position. INV-002. |
| **Domain rules live in `src/lib/`.** | `editing.ts` header | PASS | `notation.ts`, `stream.ts`, `tap.ts`, `tempo.ts` and `scheduler.ts` are React-free. Components render them. |
| **Every write goes through `mutate.ts`.** | `mutate.ts` header | PASS | Both new writes are one `patchRow`. |
| **`commit` is the only path from the capture screen to a column mutation.** | `properties.ts` | PASS | The duration row is a `ColumnProperty`. |
| **The inspector never branches on a property id.** | Spec 001 INV-025 | PASS | A new control kind, read from the descriptor. `no-id-branch.test.tsx` stays unedited. |
| **The SQL schema cannot drift from `model.ts`.** | `assert-model.ts` | PASS | Neither changes. |
| **Tests must be able to fail for the right reason.** | `docs/DECISIONS.md`, entry 4's reviews | PASS | The walk's sweep is checked against an oracle that shares no code with it (research R15). The recorder counts constructions because `state` proves nothing in headless Chromium. |
| **Never reuse a server, never share `.next`.** | `playwright.config.ts` | PASS | No harness change. |
| **Simplicity: no component library, thin primitives.** | `ui/index.tsx` header | PASS | No dependency. The shared `Sheet` is reused unchanged. |
| **Offline first.** | `public/sw.js` header | PASS | Static imports, synthesised sound, no fetched file, worker untouched. INV-031. |

**Post-design re-check (after Phase 1)**: PASS. The design adds no stored shape, and every place where
two things must agree is closed by one calling the other. See *Agreement is structural*.

## Invariants — what must never happen *(mandatory)*

Lengths and bars are probed through `readNotation` and `clickStream`, timing through the scheduler on
a fake clock, writes through `editing.ts` over `fake-indexeddb` reading rows and outbox, and screens
through `e2e` with the recorder in [contracts/components.md](./contracts/components.md).

Named sets:

- **D**, the six durations: `w`, `h`, `q`, `8`, `16`, `32`.
- **U**, unknown stored values: `"64"`, `""`, `"Q"`, `7`, `true`.
- **H**, the harvest: every recorded `layoutPart` fixture × {expanded, compact}, recorded as
  `harvest.test.ts` does.
- **N**, the counted sizes: every number from 2 to 16 × **D**.
- **G**, the generator: 500 seeded arrangements of sections, repeats, variants, bar ranges, groups,
  spaces and gaps, compared with the BigInt reference (research R15).
- **S**, the reading surfaces: song page expanded, song page compact, play view.
- **K**, the click's stages: starting; count-in; following; plain after a gap; plain after the end of
  the arrangement; plain from the first click.
- **X**, every way a run ends: stop tap; back link; browser back; the Capture link; reload; page
  hidden; `pagehide`; context goes `suspended`; goes `interrupted`; goes `closed`; queue ran dry; song
  deleted on another device.
- **T**, stored tempos: `null`, `0`, `-1`, `1`, `19`, `20`, `120`, `400`, `401`, `999`, `1000`,
  `120.5`, `NaN`, `"120"`.

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never does a part with no durations draw or export differently. | `renderToStaticMarkup(TabStaff)` with `showRhythm` on equals it with `showRhythm` off. `toAscii` and `songToText` against the existing exact strings. e2e: no `tab-rhythm` in the DOM. | **H**; **S**; capture; the paste preview. |
| INV-002 | Never does a duration move, resize, renumber, reorder or add anything on the staff, or change the export. | Give every column a duration, then compare with the same fixture without: `toAscii` and `songToText` byte-identical, and `width`, `barNumber`, `cells`, `connectors`, `repeat` deep-equal column by column. `countBars` and `expandedLength` equal. | **H** × each of **D** on every column; **H** with **D** cycled across columns; compact and expanded. |
| INV-003 | Never does a path fill in a duration, and never does one that copies lose it. | Stored `durationHint` after each path, with a duration on the neighbouring column. | Null after: `insertNote`, `insertRest`, `insertBarline`, `appendNote`, `appendBarline`, `importTab`. Kept after: copy and paste, cut and paste, `createVariant`, each × **D**. Pasted text with a rhythm line stays commentary. |
| INV-004 | Never does another edit change a duration, and never does a concurrent one lose it. | Stored row after each edit. Two replicas through `mergeRow`, in both orders: both changes survive. | Edits: `bumpColumnRepeat` both ways, ×4, `stackNote`, `unstackNote`, `toggleDecoration`, `setChord`, `groupSelection` both kinds, `ungroupTuplet`, `groupRunEndingAt`. Merge: duration against repeat, frets, techniques, `tupletCount`. |
| INV-005 | Never does an unknown stored value error, light a position, draw a mark, or get rewritten. | Seed IndexedDB directly. e2e reads each surface, the console, and the row and outbox afterwards. `readNotation`: the bar is untimed. Then tap `8`, and the row holds `8`. | **U** × {inspector, cursor status, **S**, export, the walk}; `undefined` on an old row. |
| INV-006 | Never is the row other than six positions, in order, on one line, at least 44px high, and never does it appear on a barline or vanish from a playable column. | e2e at 375×667: text in order, all `y` equal, each height at least 44, `x + width` at most 375. Its `y` is the same across columns. Page does not scroll. | Note; chord of 5; repeated; grouped; space; column with every technique; a chord symbol set × {4, 5, 6 strings}. Absent: barline. Both themes. |
| INV-007 | Never does the lit position differ from the stored value, or the stored value from what the last tap asked. | e2e reads `aria-pressed` and the row after each tap, and the sheet stays open. | Every pair from {null, **D**} × tap on **D** (42 cases, in jsdom over the real property); two taps in one tick on the same and on different positions; a change from another device with the sheet open; **U**. |
| INV-008 | Never is a duration control added outside the inspector. | e2e: controls in `toolbar-stable`, `toolbar-contextual`, `toolbar-selection` and `latch-strip`, compared with the pre-entry lists. `TOOLBAR_CONTROLS` has no duration. | The four containers × target {no column, playable, barline, selection}. |
| INV-009 | Never does the capture screen lose staff height, gain a rhythm row, or say nothing about a set duration. | e2e at 375×667: the staff's box and the header's height with and without a duration, and against values pinned from `main`. `cursor-duration` text. No `tab-rhythm`. | {4, 5, 6 strings} × {none, each of **D**} × {at the end, mid-part} × 2 themes; a long song title; `N unsynced` showing. With no duration, the status row's DOM is unchanged. |
| INV-010 | Never is a mark missing, under the wrong column, or wider than its column, and never is a column widened. | e2e: for each `tab-column`, its `tab-rhythm` text against the stored value, `scrollWidth <= clientWidth`, and column width equal to the same part with no durations. | **D** under a one-digit fret, a two-digit fret and a space; `x8` expanded (8 marks) and compact (1 mark); a barline (none); a part mixing set and unset; **S**; print emulation. |
| INV-011 | Never are two marks mistaken for each other, or below 4.5:1. | e2e: six distinct texts; computed contrast of the mark on its real surface, with no `opacity` below 1 on an ancestor. | **D** × 2 themes × {`--bg`, `--bg-raised`}. Greyscale reading is INV-044. |
| INV-012 | Never does a column's description omit its duration, or change when it has none. | `layoutPart` `description` exact strings. Staff `aria-label` in e2e. | **D** × {note, chord, space, repeated in compact, repeated in expanded, technique}; null, which equals today's strings. |
| INV-013 | Never does a reading break the tap rules. | Tap reducer: exact readings from tap times, then the sheet in e2e. | No reading at 1, 2 taps; at 3; 500 ms gives 120; 9 and 20 taps use the last 8 intervals; gap 3,000 stays and 3,001 restarts; interval exactly half and double stays, either side restarts; 150 ms gives 400 and is settable; 149 ms is out of range; 3,000 ms gives 20; two taps 3,500 ms apart say out of range; equal timestamps; ±15 ms seeded jitter, 8 taps, within 2 bpm of 120 (SC-002). |
| INV-014 | Never is a tap timed from release, lost, or doubled, and never does tapping zoom the page. | e2e with synthetic events carrying a `timeStamp`, and a held press. `visualViewport.scale` stays 1. Pad height at least 96. | Press held 400 ms; two pointers overlapping; `keydown` with `repeat`; Space and Enter once each; a `detail === 0` click; 20 taps at 100 ms; a right mouse button, which does not count. |
| INV-015 | Never does tapping or closing write, and never does set write twice or write the same value. | Outbox count and song row before and after, in e2e and through `setSongTempo`. | Tap then close by each of the close button, Esc and backdrop; set a new value (one outbox row); set the stored value (none); set on a song with no tempo; an out-of-range reading, where no set button exists. |
| INV-016 | Never does the tempo sheet disturb what it was opened over. | e2e reads cursor, armed latches, selection, the part and the URL before and after; recorder shows no restart. | Capture × {cursor mid-part, latch armed, selection open, chord draft open} × {closed with no set, set}. Play view × {idle, each of **K**} × the same two. |
| INV-017 | Never does a tapped tempo behave differently from a typed one. | Set by tap, read each surface. Compare the stored row and outbox entry's shape with a typed one's. Two-context e2e with Postgres. | Both controls; the song page field; the band list; the play view subtitle; the export heading; another device. Skips with no database. |
| INV-018 | Never does the click run on an unusable tempo, or invent one. | `usableTempo` exact, then seed the song and read `click-start`, `click-state`, `tempo-control`. | **T**. Song page typing `120.5`. Pinned against `songRowSchema` at 0, 1, 999, 1000 and 120.5. |
| INV-019 | Never is audio started before the tap, or after an `await`. | Recorder: contexts made is 0 after load, after scrolling and after opening the sheet. In the tap, the construction and `resume()` happen in the same task as the click event. | Song with and without a tempo; with an arrangement and without; each return to the screen. |
| INV-020 | Never is the count-in other than four clicks a beat apart, numbered, with the next click one beat later. | `clickStream` exact. Recorder `when` values and the screen's numbers. | 40, 120, 240 bpm; every start in a run of 5; a song with no durations; a timed song; `follow` off; stop during each of the four, then start. |
| INV-021 | Never does a click stray more than 1 ms from ideal, or error grow with time. | Scheduler on a fake clock with a jittering timer: every `when` against `k × 60 / bpm` computed independently. Recorder over a real 60-second run. | 10 simulated minutes at 40, 120, 240 bpm (SC-003); timer jitter from 0 to 200 ms; a following score with tuplets. |
| INV-022 | Never does a stall or sync traffic drop or move a click. | Fake clock: a 200 ms gap in the timer. e2e: busy-wait 200 ms in the page, and write rows to Dexie during a run. Recorder: all expected `when` values, each once. | Stall during count-in, following and plain; 500 rows arriving; a re-render of the whole play view. |
| INV-023 | Never does a click sound more than 50 ms after stop, and never does a queued one survive. | Engine on a fake clock, then recorder: every queued source stopped and the context closed, in the same task as the tap. | **X** × **K**; 100 stops at seeded random moments (SC-006); during the count-in, the next start counts from one. |
| INV-024 | Never do two clicks run at once, and never does starting fail after many runs. | Recorder: one open context at a time, and no two sources with one `when`. | Double tap on start in one tick and 50 ms apart; start, stop, start in one tick; 50 cycles of start, stop, leave, return (SC-012). |
| INV-025 | Never does a tempo change restart the click, move a queued click, or change what it follows. | Scheduler, then recorder with the sheet. | During count-in, following, plain; from this device and another; 240 to 60; 60 to 240; 10 to 120 with the last click 5.9 s old, which must not read as `fell-behind`; the same value (nothing); `null` and `120.5` (keeps its tempo). |
| INV-026 | Never does a click limp on, and never does stopping for a reason go unsaid. | Scheduler with a dry queue. e2e: dispatch `visibilitychange`, and drive `statechange` through the recorder. `click-state` words, then one tap restarts. | **X** members hidden, `pagehide`, each context state, queue dry; no automatic restart on return. |
| INV-027 | Never is the silent switch bypassed, and never is a running click silent with no word. | Recorder traps `audioSession.type` and media playback. With `AudioContext` removed, throwing, or never resuming, the beat still shows and `click-help` says so. | The three failures × **K**; normal run, where help is present while running and absent when idle. |
| INV-028 | Never does a click show more than 50 ms from its moment, depend on colour, or move. | e2e: a `MutationObserver` on `click-beat` compares `currentTime` with the recorded `when`. Levels differ in computed size. `getAnimations()` is empty, and `transition-duration` is 0. | Accent, beat, soft; count-in numbers; `prefers-reduced-motion` both ways; 240 bpm. |
| INV-029 | Never is the screen held awake with no click running, and never does a missing wake lock fail anything. | Recorder's `wakeLock` stub. | **X**; `wakeLock` absent; `request` rejecting; `request` resolving after stop. |
| INV-030 | Never does the click write, sync or store anything. | e2e: dump every Dexie table and `meta`, and watch sync requests, before and after a run. | A whole run through **K**; the follow choice toggled; **X**. |
| INV-031 | Never does the click or the sheet need the network, or the worker change. | e2e on a production build with `context.setOffline(true)`: `page.on("request")` sees none from either. `git diff main -- public/sw.js` is empty. No `next/dynamic`, `React.lazy` or `import(` under the new paths. | Stories 1 and 2, arriving by {direct open, in-app link from the song page, in-app link from the band page}, each after a visit online. |
| INV-032 | Never does the click follow a different arrangement from the one drawn. | e2e: with the recorder, the bars and lengths of the click against the staves on screen. `PlayView` does not import `eventsInBars`. | A repeat; a variant on the last pass; a bar range on a part; a bar range on a variant; a section ×2 holding those; a deleted part; a text entry; an unterminated section. |
| INV-033 | Never is a length other than the tables say. | `readNotation` exact in ticks. | **N**; plain group × **D**; a repeat of 1, 2, 8, 512; **G** against the reference. |
| INV-034 | Never is a bar timed that the rule rejects, or untimed that it accepts. | `readNotation`: where the score ends. | A null on a note, on a space, on the last column; **U**; a number above and below its columns; a repeat in a counted group; a repeat in a plain group (timed); legacy null kind and null count; rows that disagree on the number; a counted and plain mix; a number with no fraction; a group split over a barline that adds up, and one that does not; a group cut by a bar range; two groups in one bar; **G** against the reference. |
| INV-035 | Never does a click land anywhere but where the spec puts it, or two land together. | `readNotation` against the literal tables in [contracts/notation.md](./contracts/notation.md). Recorder frequencies on the worked example. Positions strictly increase. | Worked example; five eighths; each of **N**; a triplet landing on a beat; a pickup; no barlines; trailing and double barlines; a part with no columns; a plain group's first hit on a beat, off a beat and over a barline; **G** against the reference. |
| INV-036 | Never does the click break time at a change, resume following, or stop itself. | `clickStream`: the first `plain` tick equals the score's end. Phases never go backwards. | A gap in bar 1, 2, 4; ending off the beat; a notated part after an unnotated one; the end of the arrangement; 1,000 clicks past the end. |
| INV-037 | Never does a bar's sound depend on another bar. | Metamorphic: a bar's clicks, relative to its start, are the same whichever bars come before it. **G** with bars shuffled. Page text has no warning. | Bars of every length from ⅛ to 32 beats; 5/8 beside 4/4; a pickup. `COUNT_IN_CLICKS` is the only 4 in `notation.ts` and `stream.ts`. |
| INV-038 | Never does the screen misstate what the click is doing, and never is the choice offered with nothing to follow. | e2e: `click-state` at each change, with `click-follow` present or absent. `readNotation` and the choice share one `Score`. | **K** with `follow` on and off; first bar timed, first bar untimed, no arrangement, no durations; a leading empty bar; the choice reset on returning to the screen. |
| INV-039 | Never does an edit arriving during a run disturb it, and never is a start made on notation not yet loaded. | Change a duration and a barline through Dexie mid-run: recorder shows no change until the next start. Hold `eventsByPart` undefined: start is disabled. | Edit from this device and another; part deleted mid-run; a tempo edit, which is live; a slow store at open. |
| INV-040 | Never are the click's controls out of reach, under 44px, covering the last staff at rest, or printed. | e2e: `elementFromPoint` at each control after scrolling, and the last staff's bottom against the bar's top at the end of the scroll. Print emulation: `display: none`. | Top, middle and end of a 40-pass song; no arrangement; 2 themes; 375×667 and desktop; with a long tempo message. Also no horizontal page scroll. |
| INV-041 | Never does a screen reader hear each click, or miss a state change. | e2e: mutations on `role=status` per run. `click-beat` is `aria-hidden`. | Every row of the status line table; 16 beats running, which adds no announcement; focus lands on stop. |
| INV-042 | Never does a button promise a set the write would refuse. | Every reading the sheet offers passes `songRowSchema` after `setSongTempo`. | 20, 21, 120, 399, 400. |
| INV-043 | Never does this entry change the export, the wire, the schema or the worker. | `scripts/untouched-by-rhythm.sh`: `git diff main` over named paths prints nothing. `npm run typecheck`. Each of **D** and **U** through `eventRowSchema`, so the table and the wire are pinned without touching `protocol.ts`. | `src/lib/tab/ascii.ts`, `src/lib/tab/parse.ts`, `src/lib/tab/reading.ts`, `src/lib/export/text.ts`, `src/lib/sync/`, `src/lib/server/`, `src/app/api/`, `src/db/`, `drizzle/`, `src/lib/model.ts`, `src/lib/local/db.ts`, `src/lib/local/clipboard.ts`, `src/lib/local/importing.ts`, `src/components/ui/index.tsx`, `public/sw.js`, `src/lib/tab/__tests__/ascii.test.ts`, `src/lib/export/__tests__/text.test.ts`, `src/lib/tab/__tests__/round-trip.test.ts`. |
| INV-044 | Never is anything here illegible at actual size. | **Person-level pass** (`quickstart.md` §8). INV-010, 011, 040 are the automated half. | Each row of that table × 2 themes. Owed after merge, and is SC-010 and SC-011 in part. |
| INV-045 | Never is a real-phone behaviour called proved by a desktop. | **Stays open** (`quickstart.md` §9). Tasks for it are `🛑 BLOCKED` and are never ticked to pass a gate. | The six items in the spec's *Owed to a real phone*. |

### Requirements to invariants

| Requirements | Invariants |
|---|---|
| FR-001 | INV-003 |
| FR-002 | INV-002 |
| FR-003 | INV-001 |
| FR-004 | INV-006 |
| FR-005 | INV-004, INV-033 |
| FR-006 | INV-003, INV-004, INV-043 |
| FR-007 | INV-005 |
| FR-008, FR-009, FR-010 | INV-006, INV-007 |
| FR-011 | INV-008 |
| FR-012 | INV-009 |
| FR-013, FR-014 | INV-010 |
| FR-015 | INV-011, INV-012 |
| FR-016 | INV-009 |
| FR-017 | INV-002, INV-003 |
| FR-018, FR-019 | INV-009, INV-016 |
| FR-020 | INV-014 |
| FR-021, FR-022, FR-023 | INV-013 |
| FR-024 | INV-015 |
| FR-025 | INV-017, INV-042 |
| FR-026 | INV-040 |
| FR-027 | INV-018 |
| FR-028 | INV-019 |
| FR-029 | INV-020 |
| FR-030 | INV-021, INV-022 |
| FR-031 | INV-023 |
| FR-032 | INV-025 |
| FR-033 | INV-035, INV-045 |
| FR-034 | INV-028 |
| FR-035, FR-036 | INV-027 |
| FR-037 | INV-026 |
| FR-038 | INV-029 |
| FR-039 | INV-023, INV-024 |
| FR-040 | INV-030 |
| FR-041, FR-042 | INV-031 |
| FR-043 | INV-032 |
| FR-044 | INV-033, INV-034 |
| FR-045 | INV-035 |
| FR-046, FR-047 | INV-036 |
| FR-048 | INV-037 |
| FR-049, FR-050 | INV-038 |
| FR-051 | INV-039 |
| Edge case: a screen reader during the click | INV-041 |
| SC-001 | INV-015, INV-016 |
| SC-002 | INV-013 |
| SC-003 | INV-021 |
| SC-004 | INV-022 |
| SC-005 | INV-020, measured from the tap's timestamp to the first `when` |
| SC-006 | INV-023 |
| SC-007 | INV-031 |
| SC-008 | INV-001, INV-002 |
| SC-009 | INV-033, INV-035, INV-036 |
| SC-010 | INV-006, INV-009, INV-040, INV-044 |
| SC-011 | INV-011, INV-044 |
| SC-012 | INV-024 |

### Agreement is structural

| Two things that must agree | How |
|---|---|
| What the play view draws and what the click walks | Both take `drawnPasses`. `PlayView` no longer calls `eventsInBars`. |
| A position, its mark, its words and its length | One row each in `DURATIONS`. |
| What counts as a set duration, on every surface and in the walk | All call `readDuration`. |
| The number the click reads and the bracket on the page | Both call `groupNumber`. |
| What a hit is, the staff and the walk | The same `Math.max(1, repeat)` rule, pinned by INV-033. **Pinned, not structural**, because `layout.ts` keeps it inline and lifting it is not worth the diff. |
| Whether start is offered, what the control says, and what a live change accepts | All call `usableTempo`. |
| Whether the choice appears and what start will follow | One `Score`, from one `readNotation`. |
| When a click sounds and when it shows | One queue entry, read by both. |
| What the reading says and what set writes | Set writes `reading.bpm` from the same reducer value, and only for kind `reading`. |
| A tapped tempo and a typed one | The same field through `patchRow`. |
| The six values and the wire | **Pinned, not structural**, because `protocol.ts` has zero diff. INV-043 runs each through `eventRowSchema`. |
| The stored tempo range and the wire | **Pinned, not structural**, for the same reason. INV-018 runs the boundaries through `songRowSchema`. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| **Authority**: who may set a duration or a tempo. | Unchanged. No role check. A viewer's push is refused by the existing server rule, as for any write. | Spec, Assumptions. No other write on these screens is gated by role. | INV-043 |
| **Authority**: overwriting a tempo the band agreed. | Only on a tap of a button naming the new value. Tapping and closing never write. | A stray three taps must not change it (spec, Assumptions). The button is the consent. | INV-015 |
| **Authority**: over the device's sound. | The app never gets around a silent or muted device. | FR-035. Someone in a room has silenced that phone for a reason. | INV-027 |
| **Authority**: holding the screen awake. | Only while a click runs, released on every ending. | FR-038. A lock left held drains a phone in a pocket. | INV-029 |
| **Deletion**: clearing a duration. | One tap, no prompt, no undo. It is one tap to put back. | FR-009. | INV-007 |
| **Deletion**: what this entry removes. | Nothing. No row is removed, tombstoned or rewritten. | | INV-030, INV-043 |
| **Data rewrite**: existing rows. | None. No migration, backfill or inference. An unknown stored value stays until a person picks a position. | FR-006, FR-007. Null means not known. | INV-005, INV-043 |
| **Merging**: duration against other fields of a column. | Per-field, as already stored. Both survive. | FR-006. | INV-004 |
| **Merging**: two people setting a duration or a tempo offline. | Last write wins on that field. | Existing behaviour for every field, and tempo stays per song. | INV-004, INV-017 |
| **Merging**: a notation edit during a run. | Ignored until the next start. | FR-051. Moving a click under someone playing to it is the failure this entry names. | INV-039 |
| **Refusal**: a tempo the wire would reject. | Tapping cannot produce one. The song page's field still can, and is left alone. | Spec, Assumptions. A refused row stops a device syncing, so this is called out in *Open for the human*. | INV-042, INV-018 |
| **Money** | None involved. | | |

### Deviations and corrections, all cheap to overturn

Spec text is not edited here. Each item says how this plan reads it.

1. **A tempo below 20 cannot be read, so the spec's slow case needs its own rule.** FR-022 restarts on
   any gap over three seconds, and three seconds is 20 bpm, so FR-023's lower bound can never fire.
   Story 2 scenario 8 still expects an out-of-range message. Two taps in a row more than three seconds
   apart now say so. A cost: tapping once, waiting, then starting a run shows that line until the next
   tap. **To overturn**: drop `tooSlow`, and the sheet stays at `Keep tapping`.
2. **Set closes the sheet.** The spec says only that they are "back where they were". Setting the value
   already stored also closes it, with no write.
3. **Two group cases the spec does not cover read as untimed.** Rows of one group that disagree on the
   number, which field-level merging can produce, and a number with no row in the fractions table. Both
   fit "no knowable length".
4. **A tempo that becomes unusable during a run is ignored.** The click keeps its last usable tempo, and
   the control says `no tempo`. Stopping would punish a bandmate clearing a field on another device.
   **To overturn**: `stop` with a new reason.
5. **A space is a hit.** "Every hit of a counted tuplet" is read to include a space in the group, since
   the spec counts spaces as playable columns and the group's arithmetic needs them.
6. **The count-in is `beat` level, not an accent.** The spec does not say. Its own account is that an
   accent means the start of a bar, and that this is not a bar.
7. **The tempo control in the capture header is shorter than 44px.** The header is 37px, FR-018 forbids
   growing it, and a larger target would overlap the part chips. FR-026's 44px is written for the
   click's controls. `usability-pass` is where to recover this.
8. **FR-012 is silent in two moments.** During a refusal, because that line is full at 375px, and during
   a selection, when the row is about the selection and no single column is at the cursor. Both are
   brief. The value is back as soon as either ends.
9. **SC-003's ten minutes run on a fake clock**, with a real 60-second run through the recorder as the
   check on the seam. SC-006's 50 ms is measured to the cancel, and cannot include the device's own
   output latency.
10. **Stop is not where start was.** Research R17. The spec asks only for one click from a double tap,
    and this is how to get that with no time window on stop.
11. **The duration row goes second in the inspector**, ahead of chord and techniques, so that it does
    not move between columns. Research R9.
12. **The marks are text, not stems and flags.** FR-014 left this to planning. Research R8.
13. **`check:untouched` will fail on this branch.** It is spec 004's guard, it pins `layout.ts` and
    `TabStaff.tsx` against `main`, and it is not in CI. This entry adds `check:untouched-rhythm` beside
    it and leaves the old one alone.
14. **specs/004's Out of Scope line is amended as this entry lands**, as the spec's Dependencies ask:
    `specs/004-ascii-import/spec.md:350` then says FR-017 of this entry answered it.

### Existing tests this changes on purpose

Adding a property to the inspector changes what these pin. Nothing else is edited, and implement must
report any other pin it trips, not quietly change it.

| Test | Today | Becomes |
|---|---|---|
| `src/lib/capture/__tests__/properties.test.ts:65` | `repeat, chord, delete` for a playable target | `repeat, duration, chord, delete` |
| `src/lib/capture/__tests__/properties.test.ts:84` | `repeat, chord, decorations, group, delete` | `repeat, duration, chord, decorations, group, delete` |
| `src/lib/capture/__tests__/properties-decorations.test.ts:44` | `repeat, chord, decorations, delete` | `repeat, duration, chord, decorations, delete` |
| `e2e/capture-surface.spec.ts:1912` | 3 rows on a playable column | 4 rows |

`e2e/techniques-sheet-reach.spec.ts` asserts every toggle stays reachable and the page does not scroll.
The new row makes the sheet taller, and it should still pass, because the sheet scrolls inside itself.

## Project Structure

### Documentation (this feature)

```text
specs/005-rhythm-and-tempo/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── notation.md      #   the walk, timed bars, fractions, levels, the stream, fixtures
│   ├── click.md         #   constants, the clock port, the engine, the hook
│   ├── writes.md        #   the two writes, the duration property, what must not write
│   └── components.md    #   screens, words, test hooks, the recorder
├── checklists/          # pre-existing
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── rhythm/
│   │   ├── durations.ts              # NEW: DURATIONS, readDuration, nextDuration, TICKS_PER_BEAT
│   │   ├── tempo.ts                  # NEW: usableTempo and the bounds
│   │   ├── tap.ts                    # NEW: the tap run reducer
│   │   ├── notation.ts               # NEW: readNotation
│   │   ├── stream.ts                 # NEW: clickStream, COUNT_IN_CLICKS
│   │   ├── scheduler.ts              # NEW: the engine, against the clock port
│   │   ├── audio.ts                  # NEW: audioClock, silentClock, createClock
│   │   └── __tests__/
│   │       ├── durations.test.ts     # NEW: INV-005, 012, 043
│   │       ├── fixtures-gain-durations.test.ts  # NEW: INV-001, 002, by the harvest
│   │       ├── tap.test.ts           # NEW: INV-013
│   │       ├── tempo.test.ts         # NEW: INV-018, 042
│   │       ├── notation.test.ts      # NEW: INV-033 to 035, 037
│   │       ├── notation-oracle.test.ts   # NEW: G against the BigInt reference
│   │       ├── stream.test.ts        # NEW: INV-020, 036
│   │       └── scheduler.test.ts     # NEW: INV-021 to 026
│   ├── arrangement/
│   │   ├── passes.ts                 # NEW: drawnPasses
│   │   └── __tests__/passes.test.ts  # NEW: INV-032
│   ├── capture/
│   │   ├── properties.ts             # MODIFIED: the duration property, "segments"
│   │   └── __tests__/                # 2 pins updated, see above
│   ├── local/
│   │   ├── editing.ts                # MODIFIED: setColumnDuration, setSongTempo
│   │   └── __tests__/rhythm-writes.test.ts   # NEW: INV-003, 004, 015
│   └── tab/
│       └── layout.ts                 # MODIFIED: TabColumn.duration, description
├── components/
│   ├── rhythm/
│   │   ├── TempoControl.tsx          # NEW: the control and the sheet
│   │   ├── ClickBar.tsx              # NEW: the bar
│   │   ├── useClick.ts               # NEW: engine lifetime, page events, wake lock, the beat
│   │   └── __tests__/                # NEW: jsdom halves of INV-014, 038, 041
│   ├── capture/
│   │   ├── ColumnInspector.tsx       # MODIFIED: "segments"
│   │   ├── CaptureScreen.tsx         # MODIFIED: tempo control, cursor duration
│   │   └── __tests__/duration-row.test.tsx   # NEW: INV-007
│   ├── tab/TabStaff.tsx              # MODIFIED (CRLF): showRhythm
│   └── app/
│       ├── PlayView.tsx              # MODIFIED: drawnPasses, showRhythm, ClickBar
│       └── SongView.tsx              # MODIFIED (CRLF): showRhythm
e2e/
├── click-helpers.ts                  # NEW: the recorder, building a notated song
├── click.spec.ts                     # NEW: Stories 1 and 4, INV-019 to 030, 032, 036, 038 to 041
├── click-offline.spec.ts             # NEW: INV-031
├── click-layout.spec.ts              # NEW: INV-040
├── tempo.spec.ts                     # NEW: Story 2, INV-014 to 018
├── tempo-sync.spec.ts                # NEW: INV-017 across devices (skips with no database)
├── durations.spec.ts                 # NEW: Story 3, INV-005 to 010, 012
└── durations-layout.spec.ts          # NEW: INV-009 to 011 at size, both themes
scripts/
└── untouched-by-rhythm.sh            # NEW: INV-043, as check:untouched-rhythm in package.json
specs/004-ascii-import/spec.md        # MODIFIED: one Out of Scope line, as this entry lands
```

**Structure Decision**: Single Next.js package, unchanged. Everything about time sits in `src/lib/rhythm/`,
because the walk, the stream and the scheduler form one chain and none of it belongs to one screen.
`src/components/rhythm/` holds what is used on both the capture and play screens, or only by the click.
`src/lib/rhythm/__tests__/` is deliberately not `src/lib/tab/__tests__/` (research R16). Nothing under
`src/app/`, `src/lib/sync/`, `src/lib/server/`, `src/db/`, `drizzle/` or `public/` is touched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No gate violations. Two judgement calls add a little machinery:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| A clock port with two implementations | FR-036 needs a visual beat when audio fails, and a suspended context's clock does not advance. The same seam lets SC-003 run on a fake clock. | A separate visual-only timer is a second account of the count-in and the score. |
| A reference walker in the tests | Entry 4 showed that a sweep sharing the rule's own test passes by construction. | Hand fixtures alone cover only the shapes someone thought of. |

## Open for the human

Not blocking. Planning proceeded under the standing instruction to decide and move on.

1. **The song page's tempo field is now a sharper edge.** It can store `120.5`, which the click reads
   as no tempo and which sync refuses, and a refused row stops that device pushing. The spec leaves it
   alone. Now that tempo does something, it is worth a small entry of its own.
2. **Deviation 1 adds a rule the spec did not ask for**, to honour a scenario FR-022 makes unreachable.
3. **Deviation 7**: the capture header's tempo target is under 44px. `usability-pass` is the place to
   recover that.
4. **Text marks over stems and flags** (Deviation 12) is the design call most worth seeing at actual
   size.
5. **The click's three sounds are starting values** (research R5). Only a real phone beside a played
   bass can settle them.
6. **FU25 is still undiagnosed.** If it reaches the play view, INV-031 fails, and fixing it would be new
   work inside this entry.
7. **The constitution is still the scaffold template**, as for the previous entries.
8. **The browser pass and the phone list are owed after merge** (`quickstart.md` §8 and §9). SC-010,
   SC-011 and the six phone items stay unproved until someone does them.
