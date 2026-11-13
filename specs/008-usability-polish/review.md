# Review: Usability polish (spec 008)

Reviewed 69 files changed outside `specs/` and `.specify/` (28 tracked files modified, 41 new), plus `specs/007-usability-pass/spec.md`,
across 0 commits. The branch `008-usability-polish` still sits at main's tip `d503e97` and all of the work is uncommitted, so the evidence is
the working tree against `HEAD` (`git diff HEAD` plus untracked files), not a `main...HEAD` diff.

**Round 3.** Round 2 found two MAJORs, both in `useCaptureBand`: F1 (a request left outstanding after a write that changed neither the
columns nor the cursor, so a later sync arrival anchored) and F2 (the wrap decision never re-made when a line grew). Phase 10 of tasks.md
(T069–T072) is all ticked, and T071 was a REDESIGN of the hook. Following the round rules, I re-ran every probe already in `review-probes/`
first. I then probed every invariant over its set, with new probes where the existing ones left a member unchecked, and read what Phase 10
changed (files modified after round 2's `review.md`, by mtime):
- `src/components/capture/useCaptureBand.ts`, rewritten
- `src/components/capture/CaptureScreen.tsx`
- `specs/008-usability-polish/contracts/capture-band.md` §2 and §3
- `e2e/polish-band-interactions.spec.ts` and `e2e/polish-band-rows-sizes.spec.ts`

**Read in full this round:** `useCaptureBand.ts`; the `CaptureScreen.tsx` diff (`-w --ignore-cr-at-eol`) and its lines 155–640; the
contract; the adopted INV-004 tests in `polish-band-interactions.spec.ts` (`:18`–`:112`, `:405`–`:470`); `polish-band-unchanged.spec.ts`;
`applyRemoteRows` and `pushOnce` in `src/lib/sync/client.ts:65`–`:160`, read to design the own-echo probe; `useEvents`/`useAnnotations`
against `listEvents`/`listAnnotations` (`src/lib/local/hooks.ts:90`, `queries.ts:116`), the two sides of the delivery signature.

**Sampled:** the other adopted specs, checked by running them; the carried MINORs' sites, re-read at the cited lines; `data-model.md` and
`research.md` R4, checked for drift from the redesign.

**Not re-read:** the files round 1 or 2 read in full that Phase 10 did not touch (`TabStaff.tsx`, `StatusRow.tsx`, `OverflowMenu.tsx`,
`SongView.tsx`, `saving.ts`, `useSaving.ts`, `TopBar.tsx`, `page.tsx`). Their invariants were checked by re-running their probes and specs.

## Verdict

**Ready to merge. No BLOCKER and no MAJOR. All 25 invariants hold.**

The REDESIGN did what T071 asked, and by construction rather than by inference:
- **Delivery.** A request now ends on the render whose rows match what its own write committed (`CaptureScreen.anchored`,
  `CaptureScreen.tsx:220`–`231`, with `deliver` at `useCaptureBand.ts:108`), or at once when it has no write. A sync arrival therefore has
  nothing to spend.
- **The mode.** The decision is re-made on any change of the columns, the annotations, the band's size or a drawn column's height
  (`useCaptureBand.ts:120`–`148`).

Round 2's two failing probes now pass 3 of 3 times. Across 8 new or revised probes, every member I could construct held:
- every Still × {top, at rest} at both Wr sizes (68 checks, with a control that does move);
- this device's own sync echo, signed in;
- a bracket row made and removed by grouping;
- "chord form closed", the one trigger no probe ran;
- INV-001's 7-string and 375×553 members.

What remains is MINOR, most of it carried from round 2:
- two adopted tests that cannot fail at 1280×800 (F1, F2);
- the duplicated helper module (F3);
- line endings, now also on `CaptureScreen.tsx` (F4);
- five product and documentation MINORs carried unchanged (F5–F10);
- tidy-ups (F11).

None blocks. `tasks.md` is unchanged.

## Invariants

All probes run on the production build (`npm run build`). Run each with
`npx playwright test --config specs/008-usability-polish/review-probes/playwright.review.config.ts review-probes/<file>`, which serves
`.next` on port 3119. The projects are `mobile` (Pixel 7, coarse), `desktop` (1280×800, fine) and `firefox` (usability-staves only).

Before anything else, all 19 of round 2's probe files were re-run. Every one passed except test 1 of
`INV-006-caret-adds-no-overflow.probe.ts`, the known MINOR (F5 here). The through-server INV-004 member ran, because
`STABLATURE_DATABASE_URL` is set.

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | {4, 5, 6} × {plain, chord, chord + bracket} × Th × {at rest, selecting} at 375×667. Membership is decided by the plan's rule, and every non-wrapping member equals `capture-375-before.json` (`e2e/polish-band-unchanged.spec.ts` green). **New:** the two members outside the fixture, 7 strings at 375×667 and 6 at 375×553, × 3 decorations × Th × {rest, selecting}: 24 of 24 not wrapped, one-line staff, no runway, one band child, swipeable | `e2e/polish-band-unchanged.spec.ts`; `review-probes/INV-001-seven-strings-and-553.probe.ts` (new) |
| INV-002 | held | Sz × Rows × {form closed, open} and the 412 height sweep (round-1 probe, adopted spec green). Round 2's F2 members: 16 opens of 4 + chord + bracket at 375×667, and of 6 + chord + bracket at 390×844, right 16 of 16 each, 3 runs of 3. A chord symbol from a second tab leaves wrapped mode, 3 of 3. **New:** a bracket row made by grouping on 4 + chord at 375×667 leaves wrapped mode (116.8 → 134.4, needs 280.75 against 258), and ungrouping re-enters it | `INV-002-rows-sizes-form.probe.ts`, `INV-002-line-height-change.probe.ts` (`--repeat-each=3`), `INV-002-bracket-row-by-grouping.probe.ts` (new) |
| INV-003 | held | The 29 triggers of round 2's probe × Pos × {412×915, 1280×800 with 40 bars, Wr390}: 309 trials, 0 misses, with the negative control failing as it should. **New:** the 30th Trig member, "band resize: chord form closed" (Cancel, no write) × {end, mid-last, mid-upper} × {Wr 412, Wr 1280 with 40 bars, Wr390, and 4 strings at 412×915 and at 1280×800 with 120 bars, where the band stays wrapped with the form open, so Cancel is a pure resize}: 15 of 15 anchored after a swipe that really took the line off the bottom | `INV-003-every-trigger.probe.ts`; `INV-003-chord-form-closed.probe.ts` (new) |
| INV-004 | held | A sync arrival after 12 triggers and Stills at the end × {412×915, 1280×800 with 40 bars}: 24 of 24, and through the real server, 3 runs of 3. **New:** every Still (a tap on each of two visible lines, select, extend to another line, cancel, copy, group, ungroup, long press, an inspector write, the help overlay, each of 5 latch toggles, a sync arrival) × {swiped to the top of the part, at rest} × {412×915 with 16 bars, 1280×800 with 40 bars}: 68 of 68, with a control (the end jump from line 1 moves −534 → 0 and −113 → 0). Round 2's gap, this device's **own echo** (signed in; the push response re-`put`s the merged rows, `src/lib/sync/client.ts:135`) after a fret tap, ×4, repeat +, a chord symbol and `space` at the end: 5 of 5. A tap 150ms after a trigger, and the Stills of round 2's part 2: held. The tap after a swipe, revised so its 1280×800 member overflows: 9 of 9 | `INV-004-sync-arrival-after-trigger.probe.ts`, `INV-004-still-after-trigger.probe.ts`, `INV-004-tap-after-swipe-every-size.probe.ts` (revised → F1); `INV-004-every-still-both-sizes.probe.ts`, `INV-004-own-echo-signed-in.probe.ts` (new) |
| INV-005 | held | Every column of the 16-bar part × 5 Rows at 412×915; every column at 1280×800 (40 bars); the wide bar | `INV-005-006-every-column.probe.ts` |
| INV-006 | held | The same walk, a ×4 column at a line's end, the head and the part's end, and the chord label on the cursor's line. Test 1 of the caret probe still shows the 1px overhang, which is MINOR F5 and not a misalignment | `INV-005-006-every-column.probe.ts`, `INV-006-repeat-column.probe.ts`, `INV-006-caret-adds-no-overflow.probe.ts` (test 2) |
| INV-007 | held | The strict sequence at 375×667 against 412×915; followTail on a wide last bar at both sizes; keepCaretInView on the wide bar | `INV-007-same-result.probe.ts`, `INV-007-followtail-wide-bar.probe.ts` |
| INV-008 | held | Median of 40 fret taps, wrapped 412×915 against one-line 375×667, at the end and mid-part, within ×1.1 + 2ms. `click-timing` and `usability-highlight-timing` green. See NOTE F13 for what this comparison cannot see | `INV-008-tap-latency.probe.ts` |
| INV-009 | held | `TabStaff.wrapped-unchanged` and `frets-unchanged.test.ts` in `npm test`. `usability-wrap.spec.ts` green and unedited. Zero diff for `PlayView.tsx`, `src/lib/tab/` and `src/lib/reading/`. The one-line branch of `TabStaff` matches byte for byte | `npm test`; `check:untouched-polish` |
| INV-010 | held | Card × Th × Sz | `e2e/polish-part-card.spec.ts` (green) |
| INV-011 | held | 4 Card kinds × {Enter, Space} × 5 Close routes, mobile and desktop | `INV-011-012-013-menu.probe.ts` |
| INV-012 | held | Open by {tap, click, Enter, Space} × 6 Outside × {coarse, fine}. Delete under the press point: the synthetic guard only, as in earlier rounds | same probe |
| INV-013 | held | {first, last, top-edge card} × Sz, print emulation, the inert second trigger | same probe |
| INV-014 | held | The floors walk with each menu open, mobile and desktop | `e2e/usability-floors.spec.ts` (green) |
| INV-015 | held | Card × each action against `card-actions-before.json`; the label link's URL equals Edit's | `e2e/polish-part-card.spec.ts` (green) |
| INV-016 | held | {null, spaces} × Th × {coarse, fine}: an `svg`, a dashed underline, contrast ≥ 4.5 | `e2e/polish-part-card.spec.ts` (green) |
| INV-017 | held | {0, 1, 2, 3} songs, a deleted song, another band, a song by sync in a second context, no request | `e2e/polish-bands-list.spec.ts` (green) |
| INV-018 | held | 7 Sess × 4 Pend × 6 Surf × {375, 1280}: 336 of 336 | `INV-018-every-session-surface.probe.ts` |
| INV-019 | held | {1, 5, 12 parts} × {short, 116-character title} × Th × {375, 390} | `INV-019-short-form-fits.probe.ts` |
| INV-020 | held | Push 500 × Sess × Pend {1, 14, 99} | `INV-020-error-first.probe.ts` |
| INV-021 | held | Lat × Chd × Dur × digit × refusal × position at 375: 465 states, FR-031's order included | `INV-021-022-status-matrix.probe.ts` |
| INV-022 | held | `status-position` text equals the hand table; `latches.ts` zero diff | same probe; `check:untouched-polish` |
| INV-023 | held | Every fenced path prints `zero diff`; `queries.ts` and `hooks.ts` are additions only (`songCountsByBand`, `useSongCounts`). Phase 10's new reads of `listEvents`/`listAnnotations` in `CaptureScreen` are reads, not edits to the fence | `check:untouched-polish` |
| INV-024 | held | The 4 FR-035 members each state their change; every row of the table is named in DECISIONS; `check:polish-amendments` and `check:usability-amendments` pass | `INV-024-amendments-say-what-changed.sh` (4 of 4) |
| INV-025 | held | T052–T055 are unchecked and `🛑 BLOCKED` (`tasks.md:186`–`189`), and no other task claims them | read |

## Findings

- [ ] MINOR F1 — The adopted INV-004 "tap on the top line after a swipe" test cannot fail at 1280×800. Its 16-bar part is one line there.
      where:  e2e/polish-band-interactions.spec.ts:410, e2e/polish-band-interactions.spec.ts:431
      why:
        - **What the run shows.** At 1280×800 every run's top was 269 and `scrollTop` was 0 before and after, so there was nothing to swipe.
        - **Nothing catches it.** No member asserts that the band is wrapped and overflows before the tap.
        - **Where it came from.** T069 adopted the hole faithfully from round 2's own probe. That probe is revised this round (40 bars at
          1280×800, and an assertion that the band overflows), and its 1280×800 member now runs at `scrollTop` −113 and holds.
        - **INV-004 itself holds at 1280×800.** `INV-004-every-still-both-sizes.probe.ts` checks 34 Stills there.
      owed:   Use 40 bars at 1280×800 and assert `wrapped && overflows` before the tap, as the revised probe does.
      traces: INV-004, T069

- [ ] MINOR F2 — Carried from round 2 F3, and wider: INV-003's adopted spec checks nothing at 1280×800, and it has no "chord form closed"
      member.
      where:  e2e/polish-band-every-trigger.spec.ts:141, e2e/polish-band-every-trigger.spec.ts:161, e2e/polish-band-every-trigger.spec.ts:201
      why:
        - It still uses 16 bars at every size (`:141`). Every check is guarded by `g.overflows` (`:201`), and the control is skipped when
          nothing overflows (`:161`). So the 1280×800 run is green and empty.
        - Like round 2's probe, it runs 29 of the plan's 30 Trig members. "Band resize: chord form closed" is missing.
        - The invariant holds: 309 trials in the probe, plus 15 in `INV-003-chord-form-closed.probe.ts`.
      owed:   Use 40 bars at 1280×800 and fail when no trial overflowed. Add the chord-form-closed member from the new probe.
      traces: INV-003, FR-009

- [ ] MINOR F3 — Carried from round 2 F4: the same helper module exists twice.
      where:  e2e/polish-long-part.ts:1, e2e/polish-review-helpers.ts:1
      why:    The two files are byte-identical after their header comments. `polish-band-interactions.spec.ts` imports one copy and the
              other nine `polish-band-*` specs import the other. T069 extended the split by adding to the first.
      owed:   Keep one copy.
      traces: T058, T064, T069

- [ ] MINOR F4 — Carried from round 2 F5, and wider: line endings are mixed, against the plan's "every touched file is LF". The redesign pass
      converted `CaptureScreen.tsx` too.
      where:  src/components/capture/CaptureScreen.tsx:1, scripts/check-polish-amendments.sh:1, src/components/capture/StatusRow.tsx:1, e2e/polish-band-every-trigger.spec.ts:1, e2e/polish-saving.spec.ts:1, e2e/capture-surface.spec.ts:1, e2e/usability-status-row.spec.ts:1, specs/007-usability-pass/spec.md:1
      why:
        - **New this round.** `CaptureScreen.tsx` was LF on `main` and is CRLF now. Its diff is 1,155/1,145 lines, against 141/131 with
          `--ignore-cr-at-eol`, so a reviewer of the commit sees the whole file changed.
        - **Still CRLF, as in round 2:** the other files listed.
        - **Fine:** `useCaptureBand.ts` and both Phase 10 spec files are LF.
      owed:   Normalise in one commit of its own.
      traces: plan.md:72

- [ ] MINOR F5 — Carried from round 2 F6, unchanged: the wrapped caret overhangs its run by 1px.
      where:  src/components/tab/TabStaff.tsx:928
      why:    `INV-006-caret-adds-no-overflow.probe.ts` test 1 still fails.
      owed:   As round 2 FU4.
      traces: FR-006, FR-036

- [ ] MINOR F6 — Carried from round 2 F7: the bands list shows `No songs yet` until the count query answers.
      where:  src/app/page.tsx:85
      why:    `counts?.[band.id] ?? 0`. The contract leaves the line empty while `counts` is undefined (`contracts/saving-and-lists.md:75`).
      owed:   As round 2 FU5.
      traces: FR-022

- [ ] MINOR F7 — Carried from round 2 F8: a spaces-only part name leaks into two accessible names.
      where:  src/components/app/SongView.tsx:335, src/components/app/SongView.tsx:398
      why:    `part.name ?` is untrimmed.
      owed:   As round 2 FU6.
      traces: FR-012, FR-013

- [ ] MINOR F8 — Carried from round 2 F9: FR-011's "after" figures are still arithmetic, not measured.
      where:  docs/DECISIONS.md:677, docs/DECISIONS.md:678
      why:    Both rows still read "by R1's sum", and "lines shown" is not recorded. `review-probes/FR-011-after-figures.probe.ts` passes and
              would supply them.
      owed:   As round 2 FU7.
      traces: FR-011

- [ ] MINOR F9 — Carried from round 2 F10: implementation tests that check less than their names say.
      where:  e2e/polish-band.spec.ts:146, src/components/tab/__tests__/TabStaff.wrapped-capture.test.tsx:42, e2e/polish-part-card.spec.ts:207
      why:    Unchanged: the `+ 25` ms of slack; the "follows the tail" test, which asserts only that runs exist; the colour-screenshot
              comparison where SC-010 asks for greyscale.
      owed:   As round 2 FU8.
      traces: INV-008, FR-006, SC-010

- [ ] MINOR F10 — Carried from round 2 F11: the FR-001 amendment cites the wrong spec 008 requirements.
      where:  specs/007-usability-pass/spec.md:333
      why:    It still reads "(FR-011, FR-012, FR-015)". The saving words are FR-024 and FR-025, and the card menu is FR-012 to FR-014.
      owed:   As round 2 FU9.
      traces: FR-035

- [ ] MINOR F11 — Leftovers from the passes. None changes behaviour.
      where:  e2e/polish-band-interactions.spec.ts:3, src/components/capture/CaptureScreen.tsx:22, src/components/capture/CaptureScreen.tsx:51, src/components/capture/CaptureScreen.tsx:77, src/components/capture/CaptureScreen.tsx:88, specs/008-usability-polish/data-model.md:42
      why:
        - **Unused import.** T069 added `import postgres from "postgres"`, which nothing uses; it is a new lint warning.
        - **Blank lines.** T039's extraction left a blank line inside two import lists, where `chordToneNames` and `statusShortFor` were
          removed (`:51`, `:88`).
        - **Two imports of one module.** T071 imports `./useCaptureBand` twice (`:22`, `:77`).
        - **Documentation drift.** `data-model.md` still calls `anchorRequest` a counter, but it is now `{ id, wait }`. The contract, which
          is the authority, is up to date.
        - **Carried lint warnings** from round 2 NOTE F15: `e2e/usability-status-row.spec.ts:354` and `src/components/ui/OverflowMenu.tsx:83`.
      owed:   One tidy commit.
      traces: T039, T069, T071

- NOTE F12 — `spend()` ends the request the hook has *rendered*, not the one `CaptureScreen` most recently made.
  - **Where.** `spend` marks `pending.current` done (`src/components/capture/useCaptureBand.ts:105`–`107`). `pending.current` is replaced
    only in the layout effect after `request.id` changes (`:154`–`156`), while `CaptureScreen` takes the id synchronously
    (`CaptureScreen.tsx:161`–`165`).
  - **The race.** A Still that runs between a trigger's `setAnchorRequest` and its render would therefore spend the previous request and
    leave the new one outstanding.
  - **Also.** `anchored`'s `.catch(() => spend())` (`CaptureScreen.tsx:229`) can end a later request when an earlier write fails.
  - **Why only a note.** I found no input that reaches either: React flushes a discrete event's update before the next input task. Every
    probe that times a Still against a trigger (150ms after, and in the same second as a write) held.
  - **Why record it.** It is the one place left where the hook's view of "the request" and `CaptureScreen`'s can disagree, which is the
    class of defect T071 redesigned away. Passing the id to `spend` would close it.
- NOTE F13 — Every anchored write now costs, in both modes, two IndexedDB reads and an extra render (`CaptureScreen.tsx:226`). While a
  delivery is pending, each render also runs a `JSON.stringify` of the part (`useCaptureBand.ts:169`).
  - **What INV-008 can't see.** It compares wrapped against one-line on the same build, so this cost is invisible to it by construction.
  - **What does hold.** FR-008's own guard does: `click-timing` and `usability-highlight-timing` pass, and INV-008 holds.
  - **Not checked.** I did not compare against a `main` build (see *What I could not check*).
- NOTE F14 — Round 2's two MAJORs are fixed as round 2 framed them.
  - **F1.** `INV-004-sync-arrival-after-trigger.probe.ts` holds 12 of 12 at both sizes, and through the server.
  - **F2.** `INV-002-line-height-change.probe.ts` holds 3 of 3 runs.
  - **T071's other conditions.** The listed probes still pass, and `polish-band-unchanged` is green.
- NOTE F15 — `check:untouched-reading` (spec 004's fence, not in CI) still prints `CHANGED src/app` for `src/app/page.tsx`, as rounds 1 and
  2 and DECISIONS "008 T050" record. It is not this spec's guard.
- NOTE F16 — `.specify/memory/constitution.md` is still an unfilled template. The plan's working-rule gates stand in for it, and all of them
  pass.

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose.

- FU1 — MINOR F1: 40 bars at 1280×800 and a `wrapped && overflows` assertion in `e2e/polish-band-interactions.spec.ts:410`–`:431`, from
  the revised `review-probes/INV-004-tap-after-swipe-every-size.probe.ts`.
- FU2 — MINOR F2: 40 bars at 1280×800, a check that something overflowed, and the chord-form-closed member, in
  `e2e/polish-band-every-trigger.spec.ts`. Use `review-probes/INV-003-every-trigger.probe.ts` and `INV-003-chord-form-closed.probe.ts`.
- FU3 — MINOR F3: one helper module.
- FU4 — MINOR F4: normalise line endings, `CaptureScreen.tsx` included.
- FU5 — MINOR F5: the caret overhang at `src/components/tab/TabStaff.tsx:928`. Then adopt test 1 of `INV-006-caret-adds-no-overflow.probe.ts`
  and narrow the `ownScroller` exemption (`e2e/usability-staves.spec.ts:306`).
- FU6 — MINOR F6: leave the count line empty while loading, `src/app/page.tsx:85`.
- FU7 — MINOR F7: trimmed names in accessible names, `src/components/app/SongView.tsx:335`, `:398`.
- FU8 — MINOR F8: measured FR-011 figures in `docs/DECISIONS.md:677`, from `review-probes/FR-011-after-figures.probe.ts`.
- FU9 — MINOR F9: tighten `e2e/polish-band.spec.ts:146`, `TabStaff.wrapped-capture.test.tsx:42` and `e2e/polish-part-card.spec.ts:207`.
- FU10 — MINOR F10: correct the FR-001 amendment's citation, `specs/007-usability-pass/spec.md:333`.
- FU11 — MINOR F11: the leftovers.
- FU12 — Adopt this round's new probes into the suite:
  - `review-probes/INV-004-every-still-both-sizes.probe.ts`, into `e2e/polish-band-interactions.spec.ts`;
  - `review-probes/INV-004-own-echo-signed-in.probe.ts`, beside the through-server test (needs `STABLATURE_DATABASE_URL`);
  - `review-probes/INV-002-bracket-row-by-grouping.probe.ts`, into `e2e/polish-band-rows-sizes.spec.ts`;
  - `review-probes/INV-001-seven-strings-and-553.probe.ts`, into `e2e/polish-band-unchanged.spec.ts`;
  - `review-probes/INV-003-chord-form-closed.probe.ts` (with FU2).
- FU13 — NOTE F12: pass the request id to `spend`, so a Still ends the request it follows and a failed write ends only its own.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Plan invariants | 25 | 25 | 0 | 0 | 0 |
| Functional requirements | 37 | 31 | 5 (FR-011 F8, FR-012/013 F7, FR-022 F6, FR-035 F10) | 1 (FR-034, human-owned as T052) | 0 |
| Success criteria | 12 | 11 | 0 | 1 (SC-012, human-owned as T052) | 0 |
| Constitution principles | 0 | — | — | — | — (template unfilled; the plan's 14 working-rule gates all pass) |
| User stories | 6 | 6 | 0 | 0 | 0 |
| Round-2 blocking findings | 2 | 2 fixed (F1, F2) | — | — | — |

Runs for this review, all on a production build at 3119:
- **Guards:** `npm run typecheck` passes. `npm run lint` has 0 errors and 12 warnings. Four are in files this feature touched: three are in
  F11, and the fourth, `columns` at `CaptureScreen.tsx:207`, predates this branch. `npm test`
  passes: 151 files, 6,212 tests. Every `check:*` passes apart from the known `check:untouched-reading` (NOTE F15).
- **`e2e/polish-band*`** on mobile and desktop: 76 passed. **`polish-part*`, `polish-saving*` and `polish-bands-list`:** 58 passed.
  **`e2e/usability-*`** on mobile, desktop and firefox: 348 passed. Nothing failed.
- **The earlier specs' capture, timing and sync specs on mobile:** every `click-*`, capture-surface, capture, capture-matrix, every
  `grouping*`, rhythm-capture-height, both `variant-marks*`, techniques-positions, sync-no-lost-rows and reading-sync. 448 passed. The one `x`
  is `click-bar-fit.spec.ts:96`, a `test.fail()` that predates this branch (MINOR F19 of an earlier spec).
- **On desktop:** capture-surface, capture, every `grouping*`, click-timing, techniques-positions and `variant-marks*`: 295 passed.
- **Review probes:** 24 probe files and 2 support files in `review-probes/`.
  - **Round 2's 19, re-run first.** All held except the known test 1 of `INV-006-caret-adds-no-overflow` (F5). `INV-002-line-height-change`
    and `INV-004-sync-arrival-after-trigger` were run with `--repeat-each=3`.
  - **Revised:** `INV-004-tap-after-swipe-every-size.probe.ts` (40 bars at 1280×800, plus an overflow assertion; F1).
  - **New, all holding:**
    - `INV-004-every-still-both-sizes.probe.ts` (68 checks and a control);
    - `INV-004-own-echo-signed-in.probe.ts` (5);
    - `INV-002-bracket-row-by-grouping.probe.ts`;
    - `INV-001-seven-strings-and-553.probe.ts` (24 states);
    - `INV-003-chord-form-closed.probe.ts` (15 trials).
  - **My own driver errors along the way:** a cancel left waiting after grouping had ended the selection; the blank rule applied away from
    the end; a 4-string part too short to overflow at 1280×800. Each was fixed in the probe and re-run; none was a product defect.

## What I could not check

- **Real phones** (T053–T055, all `🛑 BLOCKED`): a tap outside the menu on iOS Safari and Android Chrome; whether the anchor jumps under a
  real thumb; one line against two with the phone's toolbars showing.
- **The human browser pass** (T052, FR-034, SC-012).
- **Firefox and WebKit capture.** Only `usability-staves.spec.ts` runs on Firefox, and the column-reverse band's negative `scrollTop` is the
  part most likely to differ.
- **Classic desktop scrollbars.** Playwright's headless Chromium hides scrollbars. On a desktop browser whose scrollbars take width, the band
  gaining or losing its vertical scrollbar changes `clientWidth`. That counts as a band resize (`useCaptureBand.ts:128`, `:174`), so the
  band would anchor when a part first overflows. If a sync arrival is what makes it overflow, that is an anchor outside the Trig set.
- **Fret-tap latency against `main`** (NOTE F13). That needs a second build of `main` on another port; I did not make one. FR-008's
  stated guards pass.
- **SC-010's greyscale screenshot** as the criterion words it (F9).
- **The 12-part header in the light theme with a phone's real fonts** (plan Open item 4).
- **Timing on a quiet machine.** Other node processes were running throughout, so INV-008 passed under some load.
