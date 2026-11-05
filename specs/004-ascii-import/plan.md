# Implementation Plan: Import ASCII tab by pasting text

**Branch**: `004-ascii-import` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-ascii-import/spec.md`

## Summary

Add a paste box to the song screen that reads tab, draws it with the existing staff, and imports it
as one new part, or says which lines it could not read and imports nothing. No stored shape
changes. Each rule has one owner, so two things cannot drift apart:

- **One reader.** A pure `parseTab` turns text into the existing `Clipboard` shape or a list of
  refusals. A pure `readTab` adds the tuning rule. The preview and the write both call `readTab`.
- **One notation.** The reader takes glyphs from `TRANSITIONS`, and accepts a cell only if
  `decorate` reproduces it, so the fixed decoration order is never restated.
- **One row builder.** The loop inside `pasteClipboard` is lifted out as `rowsFromClipboard`. The
  preview's `draftPart` and the real paste both call it, so the preview is the rows that get written.
- **One write.** `importTab` re-reads the text from stored rows inside one `mutateBatch`, and writes
  tuning, song, part, columns and chords, or nothing at all.
- **The fixtures are harvested, not copied.** The round-trip suite records every `layoutPart` call
  made by the export's own test files, so a fixture added later joins by itself and those files stay
  unedited.

The spec's riskiest claim was tested before this design was written. Across all 468 distinct texts
the export's fixtures draw, no rail run is even, and a throwaway reader redrew all 394 staff-only
texts exactly. See [research.md](./research.md) for how each decision was reached.

No migration, no new dependency, no new route, no new colour token.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router)

**Primary Dependencies**: Tailwind CSS 4, Dexie 4 with `dexie-react-hooks`, `lucide-react`, Zod.
**No new dependency.** No Next.js API is touched: this is a client component and library code.

**Storage**: Dexie/IndexedDB locally, mirrored to Postgres through `src/lib/sync/`. **No change**:
no table, field, wire shape, migration or IndexedDB version.

**Testing**: Vitest 5 (`npm test`), node by default, jsdom by docblock, `fake-indexeddb` for writes.
Playwright 1.64 (`npm run test:e2e`) against a production build, projects `mobile` (Pixel 7) and
`desktop`. Sync scenarios need Postgres and skip without it. Plus a person-level browser pass at
actual size in both themes, after merge.

**Target Platform**: Installable PWA in a mobile browser, offline-capable. The smallest supported
viewport is 375×667.

**Project Type**: Next.js web application, single package. The song screen is `"use client"`.

**Performance Goals**: A 2,000-column paste previews with no perceptible typing delay and imports
without freezing (SC-007). **Ran**: `layoutPart` plus `toAscii` over 2,000 columns took 14 ms, and
the whole batch of 2,000 took 229 ms on `fake-indexeddb`. Neither is a phone figure. Reading hangs
off `useDeferredValue`, so a keystroke paints first.

**Constraints**:
- A refused row fails the whole push, so one bad row stops a device syncing (FR-020).
- `ascii.ts`, `layout.ts`, `TabStaff.tsx`, `ascii.test.ts` and `text.test.ts` have **zero diff**.
- A visual tier is never opacity over a surface. Colours are named per theme (FR-033).
- `tsconfig.json` includes `specs/` and test files, so review probes must pass `npm run typecheck`.
- `npm run dev:clean` before debugging a style that appears to do nothing. Never run the build or
  e2e suite while a dev server holds the same `.next`.
- Edits keep each file's line endings. `ui/index.tsx` is CRLF and is not touched. `SongView.tsx`,
  `clipboard.ts`, `model.ts`, `protocol.ts`, `text.ts` and `techniques.ts` are LF.

**Scale/Scope**: 4 new source files (~870 LOC: `parse.ts` ~450, `reading.ts` ~130, `importing.ts`
~70, `PasteTab.tsx` ~220). 6 modified source files, most by a few lines. No test file edited. New
tests in new files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no
ratified constitution to gate against. As in the previous entries, the gates below are the project's
de facto rules from `docs/DECISIONS.md`, `AGENTS.md` and the code's own headers. See *Open for the
human*.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Browser testing is part of done**, at actual size, in both themes. | `docs/DECISIONS.md` | PASS (owed after merge) | FR-033, SC-010, INV-032, `quickstart.md` §6. The pipeline has no browser, so nothing is claimed until a person has looked. |
| **No colour decision from a magnified crop.** | `docs/DECISIONS.md` | PASS | No new colour. INV-028 computes contrast at actual size, and the pass in `quickstart.md` §6 is at actual size. |
| **A visual tier is never opacity over a surface token.** | `docs/DECISIONS.md` | PASS | Named tokens only. `text-text-faint` is avoided. |
| **The layout is the one source for screen and export.** | `layout.ts`, `ascii.ts`, `TabStaff.tsx` headers | PASS | The preview is `TabStaff`. `ascii.ts`, `layout.ts` and `TabStaff.tsx` have zero diff (INV-026). |
| **Domain rules live in `src/lib/`.** | `editing.ts` header | PASS | `parseTab`, `readTab` and `importTab` are library code. `PasteTab` renders a reading and calls a write. |
| **Every write goes through `mutate.ts`.** | `mutate.ts` header | PASS | `importTab` uses `mutateBatch`, `createPart`, `createTuningFromPreset`, `patchRow` and `pasteClipboard`. |
| **The SQL schema cannot drift from `model.ts`.** | `assert-model.ts` | PASS | Neither changes shape. Three constants are added, and no field. |
| **Tests must be able to fail for the right reason.** | `docs/DECISIONS.md` | PASS | Exact strings, a ledger whose classes must each be hit, a count floor on the harvest, and injected failures in INV-023. |
| **Never reuse a server, never share `.next`.** | `playwright.config.ts` | PASS | No harness change. |
| **Simplicity: no component library, thin primitives.** | `ui/index.tsx` header | PASS | No dependency, and `ui/index.tsx` is untouched. A plain `<textarea>` serves one screen. |

**Post-design re-check (after Phase 1)**: PASS. The design adds no stored shape. Every place where
two things must agree is closed by one calling the other, with one honest exception recorded in
*Agreement is structural*.

## Invariants — what must never happen *(mandatory)*

Reading is probed through `parseTab` and `readTab`, writes through `importTab` over `fake-indexeddb`
reading rows, outbox and export, and screens through `e2e`.

Named sets:

- **H**, the harvest: every recorded fixture × {expanded, compact}. See
  [contracts/round-trip.md](./contracts/round-trip.md).
- **G**, the generator: 500 seeded parts × {`bass4-e`, `bass5-b`, `guitar6-e`} × both densities.
- **R**, every refusal code in [contracts/reader.md](./contracts/reader.md) and
  [contracts/writes.md](./contracts/writes.md), each with its sample.
- **F**, the fits: {fits; offer of a band tuning; offer of a preset the band lacks}.

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never is a row written that sync would refuse. | After `importTab`, wrap every outbox row in a mutation and parse with the real `pushRequestSchema`, in batches of 200. | **H**; **F**; boundaries: fret 0, 36; `repeat` 1, 512; group 2, 16; chord of 200 characters; identical runs of 512, 513, 1,025; a preset offer in a band with no tunings. |
| INV-002 | Never is text outside sync's limits read as anything but a refusal. | `readTab`: kind is `refused` with the expected code. `importTab` returns `changed` and writes nothing. | Fret 37, 57; `x0`, `x513`; `,-1-,`, `,-17-,`; a chord of 201 characters. Constants checked against the real schema: 36 and 37, 512 and 513, 200 and 201 through `eventRowSchema` and `annotationRowSchema`. |
| INV-003 | Never does text the export wrote come back as different events, beyond what the ledger names. | Same events in `round-trip.test.ts`: `parseTab`, `draftPart`, compare to the source through `carried`. | **H**; **G**; the pinned fixtures in the contract. |
| INV-004 | Never does drawing the parsed result give a different string. | Same text: `toAscii` of `draftPart` at `reading.density` equals the text, character for character. | **H**; **G**; pinned fixtures; the two named exceptions only (`compact-without-label`, `chord-not-a-symbol`). |
| INV-005 | Never does a shape that cannot come back pass unnoticed, and never can the suite pass by seeing nothing. | Unclassified difference fails. A class not hit fails. Recorded calls at least 1,000 and texts at least 400. `readdirSync` finds no unharvested test file. | All 9 ledger classes; the 7 harvested files; the named exclusion list. |
| INV-006 | Never is a row with anything on it dropped, moved to another position, or imported onto a string of another name. | `readTab` then `importTab`, read stored `frets`: each note on the key equal to its row's position, and the tuning's name at that key equal to the label. | Every row of the spec's fit table (7); Story 4 scenarios 1 to 10; a note on every single row in turn × {4, 5, 6} rows; `Eb Bb F C` against `D# A# F C`; `e` for `E`; `E1` for `E`; six rows on five strings. |
| INV-007 | Never does a refusal write anything or offer an import. | `importTab` on each sample. Rows, outbox and `meta` byte-identical. e2e: no import button, and an IndexedDB dump unchanged. | **R**; each sample alone, and on one line among good ones, at the first, middle and last line. |
| INV-008 | Never does a refusal lack its line, its text or a reason, and never is a bad line left out. | `readTab`: compare `refusals` to the expected line list. e2e reads `data-line`, the shown text and the reason. | **R**; three bad lines of different codes, in order; bad lines in two systems; Windows line endings; a blank first line, so numbers count it. Null line only for `no-staff` and `no-notes`. |
| INV-009 | Never does a line that may be a damaged staff row become commentary. | `readTab` is `refused`, never `ready`, with the row count unchanged in the message. | `B \|--?--\|`, `B\|--?--\|`, `\|--?--\|`, `B --?--`, `B--?--`, `G-5s7-`, `T\|---`, `HH\|x-x-\|`, `Bass\|---\|`, `---?---5---`, each as the top, a middle and the bottom row of 4 and 5 rows. |
| INV-010 | Never is commentary lost silently, read as notes, or read as chords, and never does a whole song join into one part. | `ignored` lists each line with its number. e2e reads `paste-ignored`. `songToText` over 2, 3 parts refuses as `several-parts`, and every heading it writes passes `isPartHeading`. | Lyrics; `P.M.----\|`; `1   2   3   4` both off and exactly on columns; `[Verse]`; `[A]`; `(A)`; `riff` over a column; `A` and `B'` flush left; `A-men`; `E-Bow`; `-------`; title, meta and `Arrangement` lines of one part cut from an export; headings for unnamed, named and variant parts. |
| INV-011 | Never is a barline stored that was not drawn, lost, or out of place, so a bar never numbers differently. | Stored rows, `countBars` and `layoutPart` bar numbers, compared to the source. | `-7-\|-5-\|-3-`; `-\|-7-\|-`; pipes on the outside only; `\|\|` inside a body; `\|\|` touching the opening, the closing and both; a join with and without a closing pipe; 16 bars across 4 systems with lyrics (SC-006), which number 1 to 16. |
| INV-012 | Never are spaces read outside the app's exact shape, or lost inside it. | `readTab`: count of `rest` columns, and the `spaces-read` note. | `G \|---7---\|`; `E\|---7---5---\|`; `E \|---5---\|` with one row lacking a closing pipe; one even run in an otherwise exact paste; two systems of which one is not exact; pipes misaligned by one; a space beside a connector, a two-digit column and a barline; **H** at both densities. |
| INV-013 | Never does a run merge beyond the rule, or stop short of it. | `draftPart`: exact `repeat` per column. | The 4 rows of the group table; `5h7h7h7`; a barline, a technique, a chord on the first and on a later column, a group edge, a join with and without a barline; any label anywhere in another system; a run of spaces; counted with chord mid-run; a run of 512, 513, 1,025; a partial saving (`,-3-,` over five columns with one pair), which merges nothing. |
| INV-014 | Never does whitespace change what is read. | Metamorphic: `clipboard` from `readTab` deep-equal to the plain paste's. | `\n`, `\r\n`, `\r`; trailing spaces; leading gutters 0 to 8, equal and unequal; `E\|` against `E \|` on a non-exact paste; label widths `E`, `Eb`, `F#`; non-breaking spaces in the gutter; a leading BOM; a trailing newline. Right-aligned and left-aligned two-digit cells. |
| INV-015 | Never does a chord land on a barline, on the wrong column, or on two columns. | Stored `anchorEventId` against the column's frets. `moved` entries read. | Exact; one off to each side; a tie, which goes right; exactly over a barline; `AmDm`; `Am7` whole; `AmG`; `N.C.`; `D-7`; `A-`; `Cmaj7` clipped, with its note; first pass of a run; a chord per system; two on one column; a system of barlines. |
| INV-016 | Never does a group store other than its three fields, cross a barline, share an id with another, or differ from its bracket. | Stored rows: id partition, `tupletCount`, `groupKind`, then `toAscii`. | Every row of spec 003's notation tables; `,-3-,`; `,-----,`; `3`, `3,`, `,`, `,,`; `16` overrunning; `,-, ,-,`; a counted beside a plain; a bracket across a barline; ending between columns; number 1, 17; a group per system; a rest inside a span. |
| INV-017 | Never is a technique stored that the staff does not draw, or drawn that is not stored. | `layoutPart` over `draftPart`: every stored transition has its connector, and the reverse. | 4 transitions × {adjacent, widened, across a space, across a barline, across a join, separated by rails}; the same with no source, no arrival, two in one gap; all 63 decoration subsets × {`7`, `12`, `x`}; wrong order for each adjacent pair; `H`, `P`, `X`; `s`, `r`, `^`; `5ht7`, `t12p5`, `7~h9b`. FR-010: `x` stores no `dead_note`. |
| INV-018 | Never is a tuning offered under which a stored note changes pitch or loses its string, and never a merely close one. | For each pair: `readTab`, then commit, then `fretToMidi` of every stored note before and after. Offered names equal the paste's exactly. | 17 presets × 17 presets, song holding a note on each string in turn, and empty; dead notes; two parts, a variant, and a deleted part; a song with no tuning × {labelled, unlabelled}; labels matching nothing; a reversed paste, naming lowest first. |
| INV-019 | Never does taking an offer change anything but this song's tuning, and never is a tuning made from labels. | Rows before and after. `tunings` grows by at most one, and that row's `strings` deep-equal a preset's. Other songs' rows unchanged, with no outbox entry. | **F** × {band default set, null `tuningId` on this song, other songs on null}; a band already holding the tuning, which adds no duplicate; `isDefault` on every tuning. |
| INV-020 | Never does the write act on a reading the store no longer supports. | Change the store between `readTab` and `importTab`. Result `changed`, nothing written. | A note arrives that the offer would change; song's tuning changed; the band gains the tuning, so the key differs; song deleted; the band's tuning deleted. A new part arriving is not a change: the letter moves on. |
| INV-021 | Never does the preview draw other than what is written. | `toAscii` of `draftPart` equals `toAscii` of the stored rows, both densities. e2e: the staff's text before the tap equals the new part's. | **H** through `importTab`; **F**; a chord, a group and a repeat together; the density toggled while open. |
| INV-022 | Never does reading, previewing or cancelling write. | e2e: dump every Dexie table and `meta` before and after. Unit: `readTab` and `draftPart` run with a `db` whose writes throw. | Type, refuse, fix, cancel; ready then cancel; offer then cancel; leave the page while open; the density toggled. |
| INV-023 | Never is an import left half done. | Pass a `clock` whose `send()` throws on call N. Rows and outbox byte-identical. e2e: text stays and the message shows. | **F** × N from 1 to the row count, on a part with a chord and a group; a throw at each of the 4 writing steps. |
| INV-024 | Never does one intent make two parts. | jsdom with a write held open: two synchronous clicks, one call. e2e: `dblclick`, then count parts. | Double click; click during the write; Enter in focus on the button; a click after `changed`, which is allowed and is a new intent. |
| INV-025 | Never does an import touch what exists, or letter or place a part differently from `+ part`. | Deep-equal every other row, and count their outbox entries. Compare `label` and `rank` to `createPart` on a twin store. | **F** × {0, 1, 2 parts; a variant; a deleted part's letter; 26 parts, so `AA`}; arrangement entries with bar ranges; part `name` null. Ids are UUIDv7, and ranks strictly increase. |
| INV-026 | Never does this entry change the export, its tests, the stored model, the wire or the schema. | `git diff main` over named paths prints nothing. Wire: `safeParse` boundaries against the same values as `main`. `npm run typecheck`. | `ascii.ts`, `layout.ts`, `TabStaff.tsx`, `ascii.test.ts`, `text.test.ts`, `clipboard.test.ts`, `drizzle/`, `src/db/`, `src/lib/server/`, `src/app/api/`, `local/db.ts`. `text.ts`: `songToText` output unchanged, which `text.test.ts` proves. `protocol.ts`: literals to constants only. |
| INV-027 | Never is the paste target missing, permission-gated, or online-only. | e2e reads the control in both places. Context with no clipboard permission. `context.setOffline(true)` through a full import, then the outbox count, then online and drained. | Song with parts; song with none; offline × {fits, offer}; a song with no tuning, where it opens and reads. |
| INV-028 | Never does the panel widen the page, hide its text, or fall below contrast. | e2e at 375×667: `documentElement.scrollWidth <= clientWidth`; the box, messages and buttons inside the viewport; computed contrast of text on its real surface; no `opacity` below 1 on an ancestor. | 2 themes × {idle, one refusal, several, ready, offer} × {4, 5, 6 strings}; a 200-character line in the box and in a refusal; a line of 2,000 characters; a 2,000-column preview. |
| INV-029 | Never is a result silent to assistive technology, or the staff less described. | e2e: `role=status` text per state, changing only when the sentence changes. The preview's columns keep their `aria-label`s. Box has a name. | Every row of the Words table; a refusal fixed; the two failure messages; a column with a repeat, a technique and a chord. |
| INV-030 | Never does a long paste freeze typing or the screen. | Vitest: `readTab` on 2,000 columns within a generous bound. e2e: with 2,000 columns in the box, a keystroke reaches the box's value within 100 ms, and the import completes. | 2,000 columns × {one system, 40 systems} × {expanded, compact}; a 5,000-line lyric paste, which is linear, not quadratic. |
| INV-031 | Never does an imported part fail to reach another device. | e2e on two contexts with Postgres: import on one, read the staff on the other. Rejections zero. Skips with no database. | **F**; a part of more than 200 rows, so it crosses a push batch. |
| INV-032 | Never is the flow illegible at actual size. | **Person-level pass** (`quickstart.md` §6). INV-028 is the automated half. | Each row of that table × 2 themes. Owed after merge, and is SC-005, SC-010 and FR-033. |

### Requirements to invariants

| Requirements | Invariants |
|---|---|
| FR-001 | INV-003, INV-004 |
| FR-002 | INV-006 |
| FR-003 | INV-011 |
| FR-004, FR-005, FR-006 | INV-012, INV-013 |
| FR-007 | INV-015 |
| FR-008 | INV-016 |
| FR-009, FR-010 | INV-017 |
| FR-011, FR-012, FR-014 | INV-014 |
| FR-013 | INV-011, INV-015, INV-016 |
| FR-015 | INV-006 |
| FR-016 | INV-009, INV-010 |
| FR-017, FR-018, FR-019 | INV-007, INV-008 |
| FR-020 | INV-001, INV-002 |
| FR-021, FR-022 | INV-006 |
| FR-023, FR-024 | INV-018 |
| FR-025, FR-026 | INV-019 |
| FR-027 | INV-027 |
| FR-028, FR-029, FR-030 | INV-021, INV-029 |
| FR-031 | INV-022 |
| FR-032 | INV-029 |
| FR-033 | INV-028, INV-032 |
| FR-034 | INV-025 |
| FR-035 | INV-001, INV-025 |
| FR-036 | INV-023 |
| FR-037 | INV-024 |
| FR-038 | INV-021 |
| FR-039 | INV-026 |
| FR-040 | INV-003, INV-004, INV-005 |
| SC-006 | INV-011 |
| SC-007 | INV-030 |
| SC-008 | INV-031 |

### Agreement is structural

| Two things that must agree | How |
|---|---|
| What the preview draws and what is written | Both call `readTab`, and both build rows with `rowsFromClipboard`. |
| What the button promises and what the write does | `fitKey`. The write recomputes it inside the batch. |
| The order of a cell's decorations, reader and writer | The reader calls `decorate`. |
| Transition glyphs, reader and layout | Both read `TRANSITIONS`. |
| The limits, reader and wire | Both import from `model.ts`. |
| Letter and place of a new part | `importTab` calls `createPart`. The preview's letter is `nextPartLabel`, which `createPart` calls. |
| Bars shown and bars stored | `countBars`, over the draft rows. |
| The staff in the preview and everywhere else | The same `TabStaff`, unchanged. |
| Part heading, recogniser and writer | Adjacent in `export/text.ts`, and pinned by INV-010. A recogniser cannot call a formatter, so this one is pinned, not called. |
| The rail character | **Pinned, not structural.** `RAIL` stays private so `ascii.ts` has zero diff, and every fixture would fail if it moved. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| **Authority**: who may import. | Unchanged. No role check and no new route. A viewer's push is refused by the existing server rule, as for any write. | Spec, Out of Scope. The song screen gates no other write by role. | INV-026 |
| **Authority**: changing a song's tuning as a side effect. | Only on the tap of a button that names the switch, and only when every stored note keeps its pitch. This song only. | The offer is the one action here that reaches beyond the new part. The button is the consent. | INV-018, INV-019, INV-020 |
| **Authority**: adding a tuning to the band. | Only a known preset, as part of a committed import, never as default. A band tuning with the same names is reused. | FR-026. A preset is a known tuning. Labels give no octaves, so a tuning made from them would be a guess. | INV-019 |
| **Deletion**: what an import removes. | Nothing. It never replaces or adds to an existing part, and the arrangement is untouched. | FR-034. | INV-025 |
| **Deletion**: pasted text on cancel. | Discarded with no prompt, and never stored. | FR-031 says cancelling leaves the device as it was. The source is still wherever it was copied from. | INV-022 |
| **Deletion**: pasted text on a failed write. | Kept in the box. | Story 3 scenario 6. | INV-023 |
| **Undo**: reversing an import. | The part is deleted the ordinary way. **The song stays on the new tuning and the band keeps the preset.** Both are one setting away, and neither can be undone by deleting the part. | Deleting a part has no reason to know how the song got its tuning, and reverting could change notes captured since. | INV-019 |
| **Data rewrite**: existing rows. | None. No migration, backfill or upgrade. | FR-039. | INV-026 |
| **Refusal**: a paste with any unreadable line. | Refuse the whole paste. | FR-017. A partial part is the failure the entry exists to prevent. | INV-007, INV-008 |
| **Refusal**: a row the wire would reject. | Refused at reading, never written. | One bad row stops a device syncing. | INV-001, INV-002 |
| **Merging**: a stale preview. | The write re-reads. A changed outcome writes nothing and says so. A new part arriving only moves the letter on. | The offer's safety is a statement about a moment. | INV-020 |
| **Merging**: two devices importing at once. | Each makes a part. Letters may collide, as `+ part` already allows. | Existing behaviour, and a part has no unique letter constraint. | INV-025 |
| **Merging**: a tuning switch against notes captured offline elsewhere. | Last write wins on `tuningId`, as with the existing tuning picker. | The check can only see what has synced. The existing picker has no check at all, so this is stricter than today. | INV-018 |
| **Money** | None involved. | | |

### Deviations and corrections, all cheap to overturn

Spec text is not edited here. Each item says how this plan reads it.

1. **Same text has two exceptions, not one.** The Summary names compact text with no label. Its own
   table also says a chord value that is not a chord symbol comes back as commentary, so the redraw
   loses the row. SC-002 cannot hold for that shape. The ledger names both. No current fixture hits
   the second, because the only chord values in them are `Am` and `Em`.
2. **The export can turn one chord into another, and the spec's table misses it.** **Ran**: `Cmaj7`
   on the last column draws `Cm`, clipped at the body width. It comes back as a minor triad, and no
   reader can see it. FR-039 rules out the fix. The preview adds a note on any chord reaching the end
   of the body. **To overturn**: refuse such chords, which would also refuse a true `Am` on a final
   column. A real fix belongs in the export, as a later entry.
3. **SC-001's "100%" cannot include a part with no notes.** `draws an empty part` is a fixture, and
   FR-019 refuses it. FR-019 wins, and it is asserted as `no-notes`.
4. **Two more exclusions from Same events.** The order and duplicates of a stored technique list
   are not drawn, and the fixtures store both orders on purpose. A repeat under a plain bracket comes
   back unrolled in expanded density, which follows from the spec's own group table. Six harvested
   calls hit that.
5. **A lone row refuses before the fit rule runs.** `G|---5---` passes the fit rule, but the edge
   cases refuse it. The refusal is the specific one.
6. **A bracket row is defined by tokens, not by its characters.** Read literally, the spec's test
   makes every unlabelled row `---5---7---` a bracket row, and an aligned beat count four groups. A
   digits-only line that does not fully fit is commentary, even when it lines up.
7. **Line kinds are tested bottom-up, chord and bracket before staff.** `D-7` and `,---3---,` both
   meet the damaged-row rule and must not refuse. See research R4.
8. **"A label followed by rails" is narrowed.** With a note name and one rail, the rest must hold a
   digit or a second rail, so `A-men` and `E-Bow` stay commentary. A non-note label needs a pipe.
   **To overturn**: drop the narrowing. Lyrics like those then refuse, which is safe and annoying.
9. **`[A]` and `(A)` are not chords here**, though `parseChord` reads them, so a section mark does
   not become a chord. `C(add9)` is unaffected.
10. **A flush-left row of two or more chords is a chord row, not a heading**, because `A  D  E` above
    each system is common. Only a lone symbol reads as a heading. A song whose every part is named
    after chords would join when pasted whole. One unnamed part anywhere still refuses.
11. **Three refusals the spec does not list.** Two cells on one row inside one wide cell, two
    connectors in one gap, and a tab character in a chord or bracket row, where alignment cannot be
    trusted.
12. **A `||` touching the outside of a row is that pipe**, not a barline, so bar 1 is not empty.
13. **Three limit constants move to `model.ts`, and `protocol.ts` imports them.** FR-039 is read as
    the wire's behaviour, which does not change. Spec 003 did the same. **To overturn**: keep the
    literals and pin them with INV-002 only.
14. **`src/lib/tab/techniques.ts` gets a comment edit**, because its header says only `layout.ts`
    and the capture descriptors read it.

### Existing tests this changes on purpose

None. Every existing test stays unedited. New cases go in new files.

## Project Structure

### Documentation (this feature)

```text
specs/004-ascii-import/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── reader.md        #   line kinds, cell grammar, columns, every refusal code
│   ├── writes.md        #   limits, fit rule, rowsFromClipboard, importTab
│   ├── components.md    #   PasteTab, SongView edits, words, test hooks
│   └── round-trip.md    #   the harvest, the two properties, the ledger, the generator
├── checklists/          # pre-existing
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── model.ts                      # MODIFIED: MAX_FRET, MAX_REPEAT, MAX_CHORD_LENGTH
│   ├── sync/protocol.ts              # MODIFIED: literals to those constants, values unchanged
│   ├── export/text.ts                # MODIFIED: isPartHeading, additive
│   ├── tab/
│   │   ├── techniques.ts             # MODIFIED: header comment only
│   │   ├── parse.ts                  # NEW: parseTab
│   │   ├── reading.ts                # NEW: readTab, the fit rule, offers
│   │   └── __tests__/
│   │       ├── round-trip.test.ts    # NEW: INV-003, 004, 005
│   │       ├── reader.test.ts        # NEW: INV-002, 008 to 017
│   │       └── reading.test.ts       # NEW: INV-006, 018
│   └── local/
│       ├── clipboard.ts              # MODIFIED: rowsFromClipboard, draftPart
│       ├── importing.ts              # NEW: importTab
│       └── __tests__/importing.test.ts       # NEW: INV-001, 007, 019 to 023, 025
├── components/app/
│   ├── PasteTab.tsx                  # NEW: the panel
│   ├── SongView.tsx                  # MODIFIED: two buttons, the panel, part ids, scroll
│   └── __tests__/PasteTab.test.tsx   # NEW: INV-024, jsdom half of INV-029
e2e/
├── import-helpers.ts                 # NEW: paste, read the staff, dump the store
├── import.spec.ts                    # NEW: stories, INV-007, 008, 010, 021, 022, 024, 027, 029
├── import-layout.spec.ts             # NEW: INV-028, 030
└── import-sync.spec.ts               # NEW: INV-031 (skips with no database)
```

**Structure Decision**: Single Next.js package, unchanged. The reader sits beside the export in
`src/lib/tab/` because it is the export's inverse. The write sits in `src/lib/local/` beside
`clipboard.ts`, whose paste it reuses. `src/components/app/__tests__/` is a new folder, following
`src/components/capture/__tests__/`. Nothing under `src/app/api/`, `src/lib/server/`, `src/db/`,
`drizzle/` or `src/components/tab/` is touched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No gate violations. One judgement call adds a little machinery:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| The round-trip suite mocks `layoutPart` and imports other test files | FR-039 forbids editing them and FR-040 requires every fixture. **Ran**: it saw 1,697 calls with no edits. | A copied fixture list goes stale silently, which is the failure a backbone suite must not have. |

## Open for the human

Not blocking. Planning proceeded under the standing instruction to decide and move on.

1. **Deviation 2 is the one to look at.** The export can silently turn `Cmaj7` into `Cm`. This entry
   only warns. Fixing it means changing the export, which this entry may not do, so it wants a
   decision about a later entry.
2. **A taken tuning offer survives deleting the part** (blast radius, *Undo*). It seemed wrong to
   have a delete quietly retune a song, but it does mean an import is not fully undone by a delete.
3. **The narrowings in Deviations 6, 8 and 10** trade a few false acceptances of commentary for not
   refusing ordinary lyrics. Each is one rule to reverse.
4. **The constitution is still the scaffold template**, as for the previous entries.
5. **The browser pass is owed after merge** (`quickstart.md` §6). SC-005, SC-010 and FR-033 stay
   unverified until a person does it, and a real phone paste (§7) is the one thing no test here
   reaches.
