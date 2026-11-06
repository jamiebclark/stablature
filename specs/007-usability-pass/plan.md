# Implementation Plan: Usability pass across every screen, phone first

**Branch**: `007-usability-pass` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/007-usability-pass/spec.md`

## Summary

No new music. This entry makes what exists fit, reach, read and respond, and it changes no stored byte. Each rule has one owner, so two
things cannot drift apart:

- **One set of size tokens.** Touch values are the default, and a single `@media (pointer: fine)` block overrides them. No pointer means
  touch, by construction, and no touch rule is involved in density.
- **One overflow rule.** The band is always `flex-col-reverse`, with no branch on string count.
- **One builder for the export.** `layout.ts` and `ascii.ts` have zero diff. Chord room, bar numbers and line breaks are all on the
  drawing side.
- **The browser breaks the lines.** Wrapping is CSS: bars in a wrapping row, and a clipped gutter of repeated labels. No script measures
  anything, so resize, font loading and print just work.
- **One walk of the notation.** A column's tick comes out of the same loop as the clicks.
- **One table of shortcuts.** Dispatch and the help overlay both read it.
- **One way to write a note.** A key calls the same `press` a tap calls.

The risky claims were tried first, and [research.md](./research.md) has the figures:

- The reader change passes 3,396 of 3,396 tests, adds no failure to spec 004's probes, and lowers F75's count from 43 to 39 of 202.
- Every toolbar fits at 375px with every control at its floor, and six strings still fit, in a production build.
- Labels on wrapped lines align to 0.05px.
- Mouse sizes give 17.1% more columns and a 15.7% shorter staff.

Three findings changed the design. `m` is a legal cell character, so FR-034 needed a sharper rule than its wording. The light accent also
fails 4.5:1, which the audit did not record. And keyboard entry can outrun the live query, which would tie two ranks, so typed frets are
queued.

No migration, no new dependency, no new route, no change to `public/sw.js`, and no change to any byte of the export.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router)

**Primary Dependencies**: Tailwind CSS 4, Dexie 4 with `dexie-react-hooks`, `lucide-react`. **No new dependency.** The only Next.js API
involved is `Viewport` (research R14, R20).

**Storage**: Dexie/IndexedDB locally, mirrored to Postgres through `src/lib/sync/`. **No change.** One new `localStorage` key,
`stablature.panels`, on the device only.

**Testing**: Vitest 5 (`npm test`), node by default, jsdom by docblock. Playwright 1.64 (`npm run test:e2e`) against a production build,
projects `mobile` (Pixel 7, `pointer: coarse`) and `desktop` (`pointer: fine`). A new project, `no-pointer`, launches Chromium with
`--blink-settings=primaryPointerType=1,availablePointerTypes=1,primaryHoverType=1,availableHoverTypes=1`, and matches only
`usability-density.spec.ts`. `audit/` re-runs for the after figures. A person-level browser pass and real-phone items follow.

**Target Platform**: Installable PWA in a mobile browser, offline-capable, plus a desktop browser. The smallest budgeted viewport is
375×667.

**Project Type**: Next.js web application, single package.

**Performance Goals**: The highlight changes within 50 ms of the on-screen beat (SC-013). Spec 005's timing checks pass unedited.

**Constraints**:
- `src/lib/tab/layout.ts`, `src/lib/tab/ascii.ts`, `src/lib/tab/reading.ts`, `src/lib/export/text.ts`, `src/lib/rhythm/audio.ts` and
  `src/lib/rhythm/stream.ts` have **zero diff**.
- 1.8px of the height budget is spare (the band has 5.8 once its 4px of padding is counted). Nothing may be added to capture without
  taking something away.
- `round-trip.test.ts` fails on any unlisted `*.test.ts` in `src/lib/tab/__tests__/`, so new tests go in `src/lib/reading/__tests__/`.
- `single-owner.test.ts` forbids `TabStaff.tsx` importing techniques.
- `tsconfig.json` includes `specs/` and test files, so probes must pass `npm run typecheck`.
- A visual tier is never opacity over a surface.
- Unlayered CSS beats any Tailwind utility, so a rule a utility must override goes in `@layer base`.
- Never run the build or the e2e suite while a dev server holds `.next`.
- Edits keep each file's line endings. **CRLF**: `SongView.tsx`, `PasteTab.tsx`, `ui/index.tsx`, `useClick.ts`, `notation.ts`. **LF**:
  everything else this plan touches.

**Scale/Scope**: 11 new source files (about 800 LOC), 1 new script, about 30 modified source files, 9 new e2e specs, and 17 or more
existing e2e files edited. This is the largest entry on the roadmap. **FR-047 to FR-061 are the natural cut** if it runs long, and US-1 to
US-3 are what must land.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no ratified constitution to gate against. As in
earlier entries, the gates are the project's working rules from `docs/DECISIONS.md`, `AGENTS.md` and the code's own headers.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Browser testing is part of done**, at actual size, in both themes. | `docs/DECISIONS.md` | PASS (owed) | INV-042, `quickstart.md` §9. |
| **No colour decision from a magnified crop.** | `docs/DECISIONS.md` | PASS | Tokens were chosen by computed contrast. INV-018 measures them on real surfaces. |
| **A visual tier is never opacity over a surface.** | `docs/DECISIONS.md` | PASS | New colours are named per theme. |
| **A distinction never rests on hue.** | `docs/DECISIONS.md` | PASS | The highlight is a full box, not a tint. Inlay frets are told apart by weight. |
| **The layout is the one source for screen and export.** | `layout.ts`, `ascii.ts` headers | PASS | Neither changes. Widening is screen-side. INV-015. |
| **Barlines are stored, never inferred.** | `layout.ts` header | PASS | Lines break at stored barlines. Bars are counted by `countBars`. |
| **Domain rules live in `src/lib/`.** | `editing.ts` header | PASS | `reading/staff.ts`, `reading/position.ts`, `keys/` are React-free. |
| **Every write goes through `mutate.ts`.** | `mutate.ts` header | PASS | The only new route to a write is `press`, which already does. |
| **The SQL schema cannot drift from `model.ts`.** | `assert-model.ts` | PASS | Neither changes. |
| **Tests must be able to fail for the right reason.** | Entry 4, 5 and 6 reviews | PASS | Oracles share no code with their rule. `no-pointer` asserts its own state first. |
| **Never reuse a server, never share `.next`.** | `playwright.config.ts` | PASS | One project added, no harness change. |
| **Simplicity: no component library, thin primitives.** | `ui/index.tsx` header | PASS | `Panel` is about 30 lines. No dependency. |
| **Offline first.** | `public/sw.js` header | PASS | No fetch, no route, worker untouched. |
| **A false refusal is acceptable, a silent wrong note is not.** | Spec 004 | PASS | R9, R10, INV-027 to INV-030. |

**Post-design re-check (after Phase 1)**: PASS. No stored shape is added, and every place where two things must agree is closed by one calling
the other, or is listed as pinned. See *Agreement is structural*.

## Invariants — what must never happen *(mandatory)*

Probed through `e2e` on a production build, through `renderToStaticMarkup(TabStaff)` in jsdom, and through `readTab`, `parseTab`, `readNotation`
and `expandArrangement`, with the hooks in [contracts/surfaces.md](./contracts/surfaces.md) §13.

Named sets:

- **Scr**, every screen and state: bands empty; bands list; band's songs; tunings; song page; song page, tools open; song page, arrange open;
  arrangement entry selected; paste panel; capture at 4, 5, 6 strings at rest; capture selecting; capture chord form; inspector on a note;
  inspector on a barline; tempo sheet; play view idle; play view cluster open; play view running; sign in; sign up; join; offline; privacy;
  terms; help overlay.
- **Sz**: 375×667, 390×844.
- **Th**: dark, light.
- **Ptr**: coarse (`mobile`), fine (`desktop`), none (`no-pointer`).
- **W**, window sizes for density: 375×667, 500×800, 820×1180, 1280×800.
- **Str**, tunings: Bass 4, Bass 5, Guitar 6, Guitar 7.
- **Hts**, screen heights: 667, 553.
- **Cap**, capture states: at rest; selecting with all seven controls; chord form open; a chord in force; stack armed; each transition armed;
  stack and a transition armed; refused; at the start; mid-part; at the end.
- **Rows**, what sits on a column: bar number; chord; carried chord; bracket start, middle, end, numeral; connector; barline; rhythm mark; diff
  mark; removal gap.
- **Stf**, staves: song page expanded; song page compact; play view whole; play view sliced; capture; capture selecting; paste preview.
- **V**, views: frets, notes, intervals.
- **Surf**, surfaces: base; raised; sunken; selection band; fret cell; inlay; variant tint.
- **Ink**, text tokens: text; dim; faint; accent; danger; fret number; diff ink; accent text.
- **Bars**, part shapes: no barlines; a trailing barline; a leading barline; an empty bar in the middle; 16 bars; one bar wider than a line; a chord longer
  than a line; a repeat crossing a line; a pass with no notes.
- **Arr**, arrangements: one part; `A ×4`; last-pass variant; a sliced pass; `Verse ×2`; nested sections; same name not adjacent; names differing only in
  case; an empty section; an unnamed section; a text cue between.
- **Keys**, every row of FR-057.
- **Inp**, editable things: Band name; Song title; part name; BPM; tuning select; Section name; Cue; last-pass select; paste box; chord form; inspector
  chord; sign-in email; sign-in password; and a `contenteditable` added by the test.
- **Mod**: Ctrl; Cmd; Alt; composition.
- **Lat**, armed states: none; stack; each of four transitions; stack and a transition.
- **St**, storage states: normal; `localStorage` undefined; `getItem` throws; `setItem` throws; stored `"[]"`; stored `"nope"`; stored with an unknown
  key; changed in a second tab.
- **Joined**, lines: `Am7-D7`, `Am7-D7-G`, `Cmaj7-Fmaj7`, `Dm7-G7-Cmaj7`, `F#m7-B7`, `Dsus4-A7`, `Cadd9-G`, `Bbm7-Eb7`, `Am-G7`.
- **Stays**, lines: `A7-D7`, `E5-A5`, `C-G7`, `A7-D7-E7`, `E5-G5-A5`, `D-7-G-7`, `Am7-b7`, `Am7-7`, `Am7-5`, `Bm7-5`, `Am7-D7-`, `-Am7-D7`, `Am7--D7`, `G5-7`,
  `E-5-7`, `(c) 1999-2004`, `1-2-3-4-`.
- **Pos**, where a line sits: directly above; directly below; apart above; apart below; between two systems; at an offset above.

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never does a row on capture exceed its budget, or a row get added. | `e2e/usability-height-budget.spec.ts`: each row's `getBoundingClientRect` against the table, and the count of the root's direct children against a named list. Adding a row fails it. | `capture-title-row` ≤45, `status-row` ≤26, `toolbar-stable` ≤46, the contextual, selection and reserved rows ≤46, neck and latch strip unchanged from the before figures, at 375×667 × **Th** × {at rest, selecting, on a barline, at the start with nothing focused}. |
| INV-002 | Never does a four-, five- or six-string part lose a string, the chord row or the bracket row at 375×667, or the page scroll. | Same spec, with `measureBand`, plus the chord label's and bracket's rects against the band's. Fret cells read 36×36. | {Bass 4, Bass 5, Guitar 6} × **Th** × {at rest, selecting with seven controls, chord and bracket on one column}. |
| INV-003 | Never is a string or the bracket unreachable, or anything above the scroll origin. | e2e: scroll the band to each end, read each row's rect, and check that `scrollHeight - clientHeight` covers the overflow. No class is read. | **Str** × **Hts** × {at rest, selecting, chord form open}, with a chord and a bracket. Also 7 strings at 667 opens with the lowest strings in view. |
| INV-004 | Never does a selection hide a string that was in view, or move the band, or the stable row move with the cursor. | e2e: rects before and after entering a selection, and across the cursor moving. | **Str** × {667, 553} for the band. Cursor over a note, a rest, a barline and the start, for the stable row. |
| INV-005 | Never is a new group left out of view. | e2e: scroll the band and strip away, group, then read the bracket's rect against both scrollers after delivery. A second context writes a group, and nothing moves. | {tuplet control, plain group control, triplet button} × {far left of the strip, far right} × {7 strings at 667, 6 at 553}. Sync arrival; part change. |
| INV-006 | Never is a target under its floor. | `e2e/usability-floors.spec.ts`: walk every `a, button, input, select, textarea, [role=button], summary` in view against the floors table. `SENTENCE_LINKS` is the only exemption, and each named link is asserted to exist. | **Scr** × **Sz** × coarse. Then **Scr** at 1280×800 × fine, against the mouse column. |
| INV-007 | Never does a toolbar wrap, squeeze a control, or mix heights in a row. | e2e: `scrollWidth <= 375 - 0` from the width set, each child's height equal, each at or above its floor, none narrower than its content. | At 375: stable; contextual with every member present; selection with seven; numerals 2 and 16. |
| INV-008 | Never does a destructive control sit within 8px of a neighbour on touch. | e2e: rect gaps. | Delete in the stable row; delete in the selection row; part `Delete`; tuning `Delete`; the inspector's delete; arrangement `Remove`. × 375 and 390. |
| INV-009 | Never is a cue reachable only by a bare tap. | e2e: tab to it, press Enter, and it is selected. Its role is `button`. | A cue on the song page; a cue in a section. × coarse, fine. |
| INV-010 | Never does an input sit under 16px on touch, or a screen lock zoom. | e2e: computed `font-size` of each of **Inp**, and the `content` of the viewport `meta` has no `maximum-scale` or `user-scalable`. | **Inp** × **Scr** × coarse. `touch-action` on a neck cell and a toolbar control is `manipulation`, and on the tap pad `none`. |
| INV-011 | Never does the paste status, or the inspector's input and set button, sit under the on-screen keyboard. | e2e with `visualViewport` stubbed in `addInitScript` to the audit's keyboard, reading real rects after focus. The first refused line is reachable by scrolling. | **Sz** × {paste with a refusal, paste ready, inspector chord}. Owed to a phone as well. |
| INV-012 | Never is anything a long press does unreachable without one. | e2e: every action in the sheet reached with no press longer than a tap. | {note, rest, barline, repeat}. |
| INV-013 | Never does a control or text sit under an inset. | e2e with CDP `Emulation.setSafeAreaInsetsOverride`, top 47 and bottom 34, and in landscape left and right 47: every target's rect inside the insets. | Capture; song page; play view idle; play view running; an open sheet; band's songs. |
| INV-014 | Never does a density rule depend on width, or a touch size change. | `e2e/usability-density.spec.ts` asserts its `matchMedia` first, then compares sizes at each size of **W**. A touch size is compared with the floors table, and a window's touch figures with each other. | **Ptr** × **W** × {fret cell, dead-note cell, toolbar control, chip, column, string height}. Also a 500px mouse and an 820px tablet (Story 6). |
| INV-015 | Never does the export, a stored row or a layout change. | `frets-unchanged.test.ts`: layout, ASCII, text and description entries byte-equal to `baseline.json`. e2e: Copy text with a wide chord on a narrow column, on every view and pointer, equals the same text from `main`'s fixture. `scripts/untouched-by-usability.sh`. | **Bars** × {expanded, compact} × **V**. The guard's paths are in *Scope fence* below. |
| INV-016 | Never is a chord cut, or do two chords touch. | jsdom for the arithmetic against a hand table, and e2e: `scrollWidth <= clientWidth` on the label, no `…`, rects of adjacent labels at least 2px apart, and no label past its staff's right edge. | **Stf** × {`Em7`, `Cmaj7`, `F#m7b5`, a 10-character symbol, a symbol longer than a line} × {one-digit column, two-digit column, adjacent columns, last column, before a barline, on a repeat, carried in intervals} × **Ptr**. |
| INV-017 | Never does anything on a column sit more than 1px from it, on any line. | e2e: rect of each row's item against its column's, on every line of a wrapped staff. | **Rows** × **Stf** × **V** × {375×667, 1280×800} × **Bars**. Rhythm marks are centred on the note, not the column's edge. |
| INV-018 | Never is text under 4.5:1, apart from a disabled control. | `e2e/usability-contrast.spec.ts`: every text node's computed colour against its real painted surface, with opacity multiplied through. A disabled control is identified by its `disabled` attribute and nothing else. | **Scr** × **Sz** × **Th**. Also numerals, marks and bar numbers on each of {base, raised, selection}. |
| INV-019 | Never does a digit or numeral fall under its size, or a line cross one, or an inlay fret lose its mark. | e2e: computed size, and the numeral's box bottom at or above the line's top. For the neck: header at 11px, its row height equal to the before figure, and an inlay's computed `font-weight` above a plain fret's with the same colour. | At 12px: numerals 2, 3, 16; rhythm marks `1`, `32`, dotted; bar numbers 1, 17, 128. × {touch, mouse} × **Th**. A mark fits the narrowest column without widening it, with and without. At 11px: every neck header number, inlay and plain, × **Th**. |
| INV-020 | Never does a mouse show under 15% more columns, or a staff fall under 15% shorter, than touch. | e2e: columns on a line and the height of a six-string staff in the same window, one per pointer. | {500×800, 1280×800} × {with a chord row, with a bar row, plain}. |
| INV-021 | Never is the staff in another font, or a ligature drawn. | e2e: CDP `CSS.getPlatformFontsForNode` is `JetBrains Mono`, with a missing glyph as a control that it can fail. Computed `font-variant-ligatures` is `none`. Width of `\|-` is two advances. | Staff cells; chord row; numeral; rhythm mark; paste box; refused line; ignored line. |
| INV-022 | Never does a status word get cut, or a jump button vanish. | e2e: `scrollWidth <= clientWidth` on the status, text compared whole, both buttons present and ≥44×24. | **Lat** × every status text × {no chord, `Am`, a 10-character chord, an unknown chord} × {at the end, at the start, mid-part} at 375. A refusal keeps its words, and cuts only the chord (Deviation 3). |
| INV-023 | Never does a title leave the reader with no way to read it, or the chord form's hint overflow its box. | e2e: `-webkit-line-clamp` lines at most 2, and on capture the back target at the floor. The hint's `scrollWidth <= clientWidth` at a computed 16px. | A 120-character title on bands, band's songs, song page, play view and capture. × **Sz**. The hint on the chord form, empty, × **Sz**. |
| INV-024 | Never is a panel's state on a song, in the queue or on the network, or does storage trouble throw or stick. | Vitest over the store with injected storage. e2e: dump every Dexie table, count the outbox and watch requests across 50 toggles. A hydration error fails it. | **St** × {`song-tools`, `song-arrange`, `play-cluster`} × {read, set, read again}. Reload, second tab. |
| INV-025 | Never is a main action out of reach, or does the bar cover a part. | e2e: at each scroll position, Capture and Play view's top is at or below half the screen, on touch. On a mouse the bar is absent and the header has both. The last card's bottom clears the bar at the end of the page. | Song page at scroll top, middle, end × **Sz** × {coarse, none}; fine. Empty song; one part; many parts. Print: absent. |
| INV-026 | Never does the cluster hide a message, cover a staff, or print. | e2e, with the state forced by each real route. `click-state` is visible when it must be, and the cluster is ≥44 high and ≤60 idle. | {no tempo; stopped hidden, audio lost, fell behind; running with sound; soundless; counting in; following; plain} × {collapsed, open} × **Sz**. Last staff's bottom clears it. Print: absent. |
| INV-027 | Never does a line in **Joined** stop reading, or go unlisted. | `src/lib/reading/__tests__/paste-joined-chords.test.ts`, through `readTab`: `ready`, the same columns as without it, and the line in `ignored` with its number. | **Joined** × **Pos**, except an offset. `Am7-D7` above a system at an offset reads as a chord row exactly as `main` does, by comparing clipboards. |
| INV-028 | Never does a line in **Stays** stop refusing. | Same file. The oracle is a literal table, not `joinedByQuality`. | **Stays** × **Pos** × {bass4-e, guitar6}. |
| INV-029 | Never is a refusal's wording untrue, or does the rewording change a result. | Same file. For each refused line, the kind and the set of refused line numbers equal `main`'s recorded ones. For `chords-joined`, following the advice makes the paste read. | {`A7-D7`, `E5-A5`, `D-7-G-7`, `C-G7`, `A7-D7-E7`, `E5-G5-A5`} × **Pos** × {spaces, set apart; deleted}. Each of `G5-7`, `E-5-7`, `Am7 - D7` keeps today's code. |
| INV-030 | Never does a spec 004 invariant weaken. | Every `src/lib/tab/__tests__/` file, unedited, and `specs/004-ascii-import/review-probes` by `vitest.probes.config.mts`, compared with the 19 already failing on `main` (`quickstart.md` §5). F75's measure is at most 43, and expected at 39. | All of spec 004's sweeps, unnarrowed. |
| INV-031 | Never does a controls collapse take a tap from capture. | e2e: every control of FR-001's two rows and the toolbars is present and one tap away with no panel. | **Cap**. |
| INV-032 | Never do bars number differently from how the app counts them, or differently across devices. | e2e over a fixture, with an expected list written by hand per shape. `passBars` against `countBars` summed in the test. Two contexts agree. | **Bars** × **Arr**. A sliced pass says its own range and the running number. Capture and the paste preview have none. The export has none. |
| INV-033 | Never is a pass through a section unnamed, or a time miscounted. | `expandArrangement` against hand tables, and e2e for the heading text. | **Arr**. `visits` never changes `sections`, `pass` or order. |
| INV-034 | Never does a beats figure claim what the bars do not show. | `beatsPerBar` against hand tables, and e2e: the text is absent, or exact. No `/` in it, ever. | All bars 3, 4, 5 and 6 beats; one bar differs; a pickup; one untimed bar; an empty bar in the middle; leading and trailing barline; a tuplet in a bar; a part of no durations; a fractional bar. × **Stf** reading surfaces. Tempo absent with no usable tempo. |
| INV-035 | Never does the highlight show outside following, or disagree with the beat. | `e2e/usability-highlight.spec.ts`: a `MutationObserver` from before start logs each change of `.tab-column-reading`, and of the beat box, with timestamps. | Count-in; first column; each pass; across a barline; a repeat; a tuplet; last timed column; into the plain beat; a part that stops being timed; a tempo change mid-run; the follow choice off; every ending of `click-every-ending.spec.ts`. No more than 50 ms from a beat. |
| INV-036 | Never does the reading position change when a click sounds. | `readNotation` output deep-equal to a baseline recorded from unedited code. `click-timing.spec.ts`, `click-running.spec.ts`, `engine-seams.test.ts` and `tables.test.ts` unedited. `playhead()` called between every step of a recorded engine run leaves its schedule identical. | **Bars** × **Arr** × tempos 40, 120, 300. Very fast clicks may skip a column, never lag. |
| INV-037 | Never does the view fight the reader, or lose the highlight. | e2e: wheel away during a run, no scroll for 4 s, then following resumes. A sync write mid-run keeps the highlight. | {wheel, touch swipe, scroll key} × {page, a wide bar's own scroller}. A column removed mid-run; reduced motion jumps. Highlight is told apart with no colour: computed `outline-style` differs from the selection's and the variant's. Print: none. |
| INV-038 | Never does a wrapped staff scroll sideways unless one bar is wider than a line, or a label leave its line. | `e2e/usability-wrap.spec.ts`: each line's top against the gutter block's, within 1px, and the `.tab-lines` `scrollWidth` against its width. | **Bars** × **V** × {375, 820, 1280} × **Ptr**, and at 1280 the staff is ≥90% of the window. Print emulation: no line cut. A variant's marks and removal gaps on their columns, with one caption per pass. |
| INV-039 | Never does a shortcut act while typing, or take a key it should leave. | `e2e/usability-keys.spec.ts`: for each key, type into each input and compare value, URL, and Dexie and page state before and after. | **Keys** × **Inp**; **Keys** × **Mod**; **Keys** with a sheet open; Space and Enter on a focused button, a link and a column. A key on a screen it is not listed for does nothing. |
| INV-040 | Never does a key do something other than what its table row says, or differ from the matching tap. | e2e: run the key on one page and the tap on another, then compare a full Dexie dump, ignoring ids and clocks. The help's rows are read and each is run, so a row cannot be listed and dead. | **Keys** × their screens × **Lat**, on the first and last column and at both ends of part and string. The help on each screen. |
| INV-041 | Never does fast typing reorder, drop or double a note. | e2e: `keyboard.type` with no delay, then read columns in rank order. Digit rule through `fretEntry` hand tables, and e2e. | `5 7 3 8 0 12 15 24 25` at delay 0, 10, 700; `1` then each of Enter, a wait, `x`, Left, a digit that goes over; `2` on a neck of 24; held keys; a part change with a digit waiting; a sheet opening with one waiting. No two stored ranks are equal. |
| INV-042 | Never is anything here illegible at actual size. | **Person-level pass** (`quickstart.md` §9). INV-016 to 021 are the automated half. | Each row of that table × 2 themes. Owed after merge. Tasks for it are `🛑 BLOCKED` and are never ticked to pass a gate. |
| INV-043 | Never is a claim a desktop cannot prove marked as done. | `tasks.md` carries the spec's six real-phone items as human tasks. | All six rows of *Owed to a real phone*. They stay open until done. |
| INV-044 | Never does the app name, copy or imitate another product. | A test greps `src/` and `e2e/` fixtures for the product's name, and `audit/` is not bundled. | Every user-visible string file; every fixture. |
| INV-045 | Never is an earlier requirement left saying something untrue, or a pin moved in silence. | A script checks each row of *Existing tests this changes on purpose* appears in `docs/DECISIONS.md`, and that FR-064's named requirements carry the new text, including FR-020's exact wording. | Specs 001, 002, 003, 004, 005 and 006, as FR-064 lists. |
| INV-046 | Never does the audit go without an answer. | `audit/` re-run, and a script checks each A-number has an outcome. | A1 to A33 (SC-017). |

### Requirements to invariants

| Requirements | Invariants |
|---|---|
| FR-001 to FR-004 | INV-001, INV-031 |
| FR-005 to FR-007 | INV-002, INV-003 |
| FR-008 | INV-004 |
| FR-009 | INV-005 |
| FR-010 | INV-001, INV-002 |
| FR-011 | INV-006 |
| FR-012, FR-013 | INV-007 |
| FR-014 | INV-008 |
| FR-015 | INV-018, INV-019 |
| FR-016 | INV-009 |
| FR-017, FR-018 | INV-010 |
| FR-019, FR-020 | INV-011 |
| FR-021 | INV-012 |
| FR-022 | INV-013 |
| FR-023 | INV-014, INV-020 |
| FR-024, FR-025 | INV-016, INV-002 |
| FR-026 | INV-022 |
| FR-027, FR-028 | INV-023 |
| FR-029 | INV-018 |
| FR-030, FR-031 | INV-017, INV-019 |
| FR-032, FR-033 | INV-021 |
| FR-034 | INV-027 |
| FR-035 | INV-029 |
| FR-036 to FR-038 | INV-028, INV-030 |
| FR-039 | `review-redraw-ledger.test.ts` unedited, in INV-030 |
| FR-040, FR-042 | INV-024, INV-025 |
| FR-041 | INV-025 |
| FR-043 to FR-045 | INV-026 |
| FR-046 | INV-031 |
| FR-047, FR-048, FR-050 | INV-032 |
| FR-049 | INV-033 |
| FR-051, FR-052 | INV-034 |
| FR-053, FR-054 | INV-035, INV-036, INV-037 |
| FR-055, FR-056 | INV-038 |
| FR-057 to FR-059 | INV-039, INV-040 |
| FR-060, FR-061 | INV-040, INV-041 |
| FR-062 | INV-044 |
| FR-063 | INV-015 |
| FR-064, FR-065 | INV-045 |
| FR-066 | INV-042, INV-046 |
| SC-001, SC-002 | INV-001, INV-002 |
| SC-003 | INV-003 |
| SC-004 | INV-006 |
| SC-005 | INV-010 |
| SC-006 | INV-018 |
| SC-007 | INV-016 |
| SC-008 | INV-017, INV-019 |
| SC-009 | INV-014, INV-020 |
| SC-010 | INV-025, INV-026, and first-staff y in `usability-reach.spec.ts` |
| SC-011 | INV-038 |
| SC-012 | INV-032, INV-033 |
| SC-013 | INV-035, INV-036 |
| SC-014 | INV-027, INV-030 |
| SC-015 | INV-039, INV-040 |
| SC-016 | INV-015 |
| SC-017 | INV-046 |
| Edge: a shorter screen, seven strings | INV-003 |
| Edge: chord form open, landscape | INV-003, and `Landscape` in `quickstart.md` §9 |
| Edge: long title, twelve parts, `N unsynced` | INV-023, `usability-reach.spec.ts` |
| Edge: bracket across a line, wide bar | INV-038 |
| Edge: hybrid, no pointer, tablet with a keyboard | INV-014, INV-039 |
| Edge: printing | INV-025, INV-026, INV-037, INV-038 |

### Agreement is structural

| Two things that must agree | How |
|---|---|
| A click's tick and a column's tick | One walker in `notation.ts`. `readNotation` and `notationColumns` both read it. |
| The highlight and the beat | One animation frame, in `useClick`, reads both. |
| The score that sounds and the score highlighted | Both captured together at `start`. |
| A key's note and a tap's note | The key calls `press`, the function the neck calls. |
| A shortcut working and the help listing it | One `SHORTCUTS` table. |
| The neck's highest fret and the digit rule | One exported constant. |
| Capture's cursor by tap and by key | Both call the same `onSelectColumn` route. |
| The chips' part change and the key's | One `openPart`. |
| Every row's height, and every control's in it | One token each. |
| The bar a number names, the arrangement's `fromBar` and `countBars` | `passBars` calls `countBars`. A column's number is `offset + column.barNumber`, from `layoutPart`. |
| A chord's room on a wrapped and an unwrapped staff | One `chordRooms`, and it stops at the barline where a line may break. |
| Label height and line height on a wrapped staff | Gutter blocks are built from the same row components. |
| What is exported and what is drawn | `layoutPart` is untouched, and all widening is in `TabStaff`. |
| The part heading's beats and the click's bars | `beatsPerBar` calls `readBar`. |
| A paste's refused line and its reason | `failed` rewrites a refusal that already exists, so it cannot refuse a new line. |
| Column key on the staff and in the position | `columnKey`. **Pinned, not structural**, against `marks.ts`, which keeps its own copy of the same text, by INV-035 and the marks' own tests. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| **Authority**: who gets these features. | Everyone who can open the screen. No role check. | Layout and reading only. | INV-015 |
| **Authority**: one reader changing what another sees. | Impossible. Panels, the keyboard string and the position are per device or per visit. | FR-040. | INV-024, INV-032 |
| **Deletion**: what a key can remove. | Nothing. No shortcut deletes, cuts or pastes. | A slip must cost one note at worst, and the delete control removes it. FR-057's table has none. | INV-040 |
| **Deletion**: one-tap delete of a part or tuning (A32). | **Unchanged, and logged.** Only the 8px gap is added here. | Undo or a confirm is new behaviour, and the spec logs it as a new idea. | INV-008 |
| **Deletion**: a line of a paste now being left out. | It is listed as ignored, with its number, before the import. Never silent. | FR-034 turns a refusal into an import that drops that line. Only **Joined** does this. | INV-027, INV-028 |
| **Data rewrite**: existing rows. | None. No migration, backfill or normalising. | FR-063. | INV-015 |
| **Data rewrite**: a stored panel value that is not understood. | Reads as closed, and unknown keys are kept. | A later version's panel should survive an older build. | INV-024 |
| **Publishing**: what leaves the app. | The text export does not change. | FR-063. | INV-015 |
| **Access**: removing the zoom lock. | Removed for every page. | FR-018, and it is what blocks a reader on Android. | INV-010 |
| **Money** | None involved. | | |

### Scope fence

`scripts/untouched-by-usability.sh`, as `check:untouched-usability`, prints nothing over these paths:

`src/db/`, `drizzle/`, `src/lib/server/`, `src/lib/sync/`, `src/app/api/`, `src/lib/model.ts`, `src/lib/local/` entire, `src/lib/tab/layout.ts`,
`src/lib/tab/ascii.ts`, `src/lib/tab/reading.ts`, `src/lib/tab/techniques.ts`, `src/lib/export/`, `src/lib/rhythm/audio.ts`, `src/lib/rhythm/stream.ts`,
`src/lib/rhythm/tempo.ts`, `src/lib/rhythm/durations.ts`, `public/sw.js`, and `src/lib/tab/__tests__/`.

It also checks that `parse.ts`'s diff is confined to `REASONS`, the code union, `joinedByQuality`, `looksJoined`, `readsAsProse` and `failed`, and that
`clickStream` is not named in `notation.ts`'s diff. Test the guard in a throwaway worktree and with `grep -U`, as spec 006's review advised.

### Deviations and corrections, all cheap to overturn

Spec text is not edited here. Each item says how this plan reads it.

1. **The light `--accent` changes too** (`#b45309` to `#a74d08`). FR-029 names two greys, but this measures 4.05 on the selection band, so SC-006 cannot pass
   without it. Research R11. **To overturn**: add an accent-for-text token and leave fills alone.
2. **Fret numbers and `--text-faint` land on one grey in each theme.** They need the same contrast on the same surfaces.
3. **FR-026 does not hold for a triplet refusal with a long chord.** It needs 376px of 351. The refusal keeps its words and the chord is cut, as it is today. It
   lasts until the cursor moves. Research R19.
4. **The duration gives way before the chord symbol.** FR-026 does not list it, and `dotted sixteenth` beside the longest status cannot fit.
5. **`PageHeader` goes to one row everywhere,** not just on the play view (FR-043). SC-010's 520 needs it on the song page, and two shapes of header is more to
   keep.
6. **Geist has never been applied to the interface** (R12). This entry leaves that alone, and fixes the staff with one line in `globals.css`, because moving the
   font variables would change every label after these budgets were measured. Logged as a new idea.
7. **A bar wider than a line hides its scrollbar.** A classic scrollbar's height would push later lines off their labels. It still scrolls by wheel, touch and key,
   and the highlight scrolls it. Worth seeing on the Windows desktop in use here. **To overturn**: give that bar a reserved line of height.
8. **The section name moves into the pass's head row,** from a heading above the card, because 160 leaves 2px. Research R18.
9. **An empty arrangement shows its add controls with no panel.** Otherwise a new song has no visible way to start. FR-042 assumes there is something to collapse.
10. **The paste status moves above the box,** rather than following the keyboard. It is simpler and works on both platforms. Research R14.
11. **FR-034's "a quality a fret row cannot hold" is read as a letter straight after the root,** with every root uppercase. `m` is a legal cell character, so the alphabet
    cannot be the test. Research R9.
12. **`check:untouched`, `check:untouched-rhythm` and `check:untouched-reading` will fail on this branch.** They guard specs 004 to 006, they name files this entry changes
    on purpose, and none is in CI. Expected, and left alone.
13. **`[` and `]` need AltGr on some keyboards, and FR-058 rests while Alt is held,** so those layouts have no bar keys. Read literally. `AltGraph` could be let through
    with one line.
14. **Left and Right in capture move by stored column,** so a `×4` is one step, as a tap is. On the play view they move by drawn column.
15. **The hint `tap a column to insert after it` goes.** It only showed from 640px up, and it was the row's one width rule.
16. **`stepBar` back goes to the start of the current bar first,** as a music player's back button does. FR-057 says "by a bar".
17. **Section names compare trimmed and without case.** The spec says "the same name".
18. **A leading or trailing empty bar does not stop a beats figure.** A barline typed first should not cost the reader the figure. Only an empty bar in the middle does.
19. **`Tuning` also moves into the tools panel.** FR-042 lists tempo, export, density and view, and it is as rarely used.

### Existing tests this changes on purpose

All are named in `docs/DECISIONS.md` as they change, and none is deleted (FR-065). Read each before editing it.

| File | Why |
|---|---|
| `src/lib/reading/__tests__/baseline.json` | `TabStaff` **markup** entries only, re-recorded once, because classes and the width string change. Layout, ASCII, text and description entries must not move. |
| `e2e/capture-surface.spec.ts`, `e2e/rhythm-capture-height.spec.ts`, `e2e/techniques-layout.spec.ts` | Row heights and positions. |
| `e2e/grouping-band.spec.ts` | Its two tests measure a `justify-end` band, so they are **re-read**, not re-pinned. |
| `e2e/grouping-layout.spec.ts`, `e2e/grouping-controls.spec.ts` | Bracket control width, numeral size. |
| `e2e/grouping-queued-row.spec.ts` | `all synced` is gone, so it waits for `unsynced` to go instead. |
| `e2e/click-bar-at-size.spec.ts`, `e2e/click-bar-fit.spec.ts`, `e2e/click-layout.spec.ts`, `src/components/rhythm/__tests__/click-bar.test.tsx` | The cluster. `click-state` stays, so most should hold. |
| `e2e/reading-view.spec.ts`, `reading-layout.spec.ts`, `reading-sync.spec.ts`, `reading-helpers.ts`, `variant-marks.spec.ts`, `tempo-sheet-and-tempo.spec.ts`, `rhythm-marks.spec.ts`, `rhythm-unknown-values.spec.ts`, `capture.spec.ts`, `sync.spec.ts`, `techniques-surfaces.spec.ts`, `grouping-surfaces.spec.ts` | Reaching tools, the view control or an add control now takes one tap first. Add `openTools(page)` and `openCluster(page)` to the helpers. No assertion should weaken. |
| `src/components/tab/__tests__/TabStaff.test.tsx` | Chord row's `truncate`, numeral size. |

**Must pass unedited:** `src/lib/tab/__tests__/`, `click-timing.spec.ts`, `click-running.spec.ts`, `click-every-ending.spec.ts`, `engine-seams.test.ts`, `tables.test.ts`,
`stream.test.ts`, `import*.spec.ts`. If one trips, stop and report it.

## Project Structure

### Documentation (this feature)

```text
specs/007-usability-pass/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── surfaces.md      #   tokens, primitives, every screen, test hooks
│   ├── staff.md         #   TabStaff's props, rows, chord room, wrapped markup, reveal
│   ├── click.md         #   the cluster, the walker, playhead, the reading position
│   ├── keys.md          #   the table, when a key rests, the overlay, capture's actions
│   └── reader.md        #   the parse.ts change
├── audit/               # pre-existing, plus plan-candidate.audit.ts
├── checklists/          # pre-existing
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── reading/
│   │   ├── staff.ts                  # NEW: chordRooms, barRuns, barStarts
│   │   ├── bars.ts                   # NEW: passBars, partHeading
│   │   ├── position.ts               # NEW: columnKey, columnAt, readingStops, stepColumn, stepBar, mayFollow
│   │   ├── panels.ts                 # NEW: the panel store
│   │   └── __tests__/                # NEW: staff, bars, position, panels, paste-joined-chords, notation-unchanged
│   ├── keys/
│   │   ├── shortcuts.ts              # NEW: SHORTCUTS, screenFor, shortcutFor, acceptsShortcut
│   │   ├── fretEntry.ts              # NEW: the digit reducer
│   │   └── __tests__/                # NEW
│   ├── capture/cursor.ts             # MODIFIED: Cursor, cursorStep, cursorBar
│   ├── arrangement/expand.ts         # MODIFIED: visits on each step; ordinal exported
│   ├── rhythm/
│   │   ├── notation.ts               # MODIFIED (CRLF): one walker, notationColumns, beatsPerBar
│   │   └── scheduler.ts              # MODIFIED: playhead
│   └── tab/parse.ts                  # MODIFIED: contracts/reader.md
├── components/
│   ├── keys/
│   │   ├── KeyboardHelp.tsx          # NEW: the listener and the overlay
│   │   └── useScreenKeys.ts          # NEW
│   ├── reading/
│   │   ├── useReadingPosition.ts     # NEW
│   │   ├── usePanel.ts               # NEW
│   │   └── ViewControl.tsx           # MODIFIED: floors
│   ├── ui/
│   │   ├── index.tsx                 # MODIFIED (CRLF): floors, PageHeader, Sheet, Panel
│   │   └── useKeyboardInset.ts       # NEW
│   ├── tab/TabStaff.tsx              # MODIFIED: contracts/staff.md
│   ├── capture/
│   │   ├── CaptureScreen.tsx         # MODIFIED: merged row, band, rows, keys, queue, reveal
│   │   ├── Fretboard.tsx             # MODIFIED: tokens, header, keyboard string, exported maxFret
│   │   ├── LatchStrip.tsx            # MODIFIED: token
│   │   └── ColumnInspector.tsx       # MODIFIED: floors, focus scroll
│   ├── rhythm/
│   │   ├── ClickBar.tsx              # MODIFIED: the cluster
│   │   ├── useClick.ts               # MODIFIED (CRLF): onColumn, restart
│   │   └── TempoControl.tsx          # MODIFIED: floors
│   ├── arrangement/
│   │   ├── ArrangementEditor.tsx     # MODIFIED: arrange panel, floors
│   │   └── Roadmap.tsx               # MODIFIED: cue is a control
│   └── app/
│       ├── SongView.tsx              # MODIFIED (CRLF): tools panel, bottom bar, heading
│       ├── PlayView.tsx              # MODIFIED: width, heading, wrap, bars, sections, keys
│       ├── PasteTab.tsx              # MODIFIED (CRLF): status first, box cap, .tab-text
│       └── TopBar, Footer, BandView, TuningsView, AuthForm, JoinBand, InviteBandmate  # MODIFIED: floors
├── app/
│   ├── globals.css                   # MODIFIED: tokens, colours, staff, wrap, touch-action, highlight
│   └── layout.tsx                    # MODIFIED: viewport, KeyboardHelp
e2e/
├── usability-helpers.ts              # NEW: floors table, SENTENCE_LINKS, openTools, openCluster, walkers
├── usability-height-budget.spec.ts   # NEW: FR-010, INV-001 to 004
├── usability-floors.spec.ts          # NEW: INV-006 to 010, 012
├── usability-contrast.spec.ts        # NEW: INV-018, 019, 021
├── usability-density.spec.ts         # NEW: INV-014, 020, also on `no-pointer`
├── usability-reach.spec.ts           # NEW: INV-011, 013, 023, 025, 026, SC-010
├── usability-staff.spec.ts           # NEW: INV-005, 016, 017, 022
├── usability-wrap.spec.ts            # NEW: INV-032, 033, 034, 038
├── usability-highlight.spec.ts       # NEW: INV-035, 037
└── usability-keys.spec.ts            # NEW: INV-039 to 041
scripts/
└── untouched-by-usability.sh         # NEW: the Scope fence, as check:untouched-usability
playwright.config.ts                  # MODIFIED: the no-pointer project
docs/DECISIONS.md                     # MODIFIED: FR-064, FR-065
specs/001 to 006                      # MODIFIED: amended in place, as FR-064 lists
```

**Structure Decision**: Single Next.js package, unchanged. Drawing rules go in `src/lib/reading/`, not `src/lib/tab/`, so `layout.ts` stays untouched and the export has no route to
them. Keyboard rules get their own `src/lib/keys/`, because they span two screens and the layout. The audio path is not opened.

## Build order

Each step leaves the suite green and is usable alone. The cut, if needed, is after step 6.

1. **Tokens and primitives.** Density, colour, type, viewport, insets, floors in `ui/`. Largest e2e churn, so it goes first.
2. **Capture height.** Merged row, band, rows, status, selection row. Then the budget test.
3. **What is drawn.** Chord room, numerals, marks, font, ligatures, reveal.
4. **Reach.** Tools and arrange panels, song page bar, keyboard geometry, safe areas, every remaining screen.
5. **Paste.** `parse.ts`, on its own commit, with INV-027 to INV-030.
6. **Audit re-run** against the above, and the amendments so far.
7. **Play view.** Heading, cluster, wrap, bars, sections, heading figures.
8. **Reading position.** Walker, `playhead`, highlight, following.
9. **Keyboard.** Table, overlay, play keys, capture keys, queue.
10. **Final audit, amendments, DECISIONS.**

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No gate violations. Three calls add machinery:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| A queue for typed frets | Two presses from one render tie a rank (R15). | Rereading rows inside `insertNote` changes the tap path and `editing.ts`. |
| `playhead()` interpolating scheduled times | Columns fall between clicks, and the anchor is wrong after a tempo change (R7). | Clicks alone leave eighth notes unmarked. |
| A gutter of repeated labels | Labels on every line with no script (R6). | Measuring in JS brings a resize observer, a print width, and split connectors. |

## Open for the human

Not blocking. Planning proceeded under the standing instruction to decide and move on.

1. **Light accent, Deviation 1.** It is a brand-colour change the spec did not ask for. It is the call most worth overturning.
2. **Geist has never been on.** The whole interface draws in the system font. Turning it on is a one-line move, and a re-measure of every budget. Worth its own roadmap entry.
3. **The spec's own "worth your eye" items stand**, above all the thin 1.8px margin and part chips at the top.
4. **Play view's 160 has 2px to spare, untried in a browser** (R18), and the song page's 520 is arithmetic too.
5. **A triplet refusal can still cut a long chord** (Deviation 3).
6. **A wide bar hides its scrollbar** (Deviation 7). Worth a look on Windows.
7. **`[` and `]` on non-US keyboards** (Deviation 13).
8. **Spec 006 FU19, the sync flake, is still open** and can fail this entry's runs. Do not lengthen a wait for it.
9. **The constitution is still the scaffold template**, as for the previous entries.
10. **This is a very large entry.** The cut after step 6 lands all three P1 stories.
