# Implementation Plan: Usability polish: capture height, part card overflow, honest labels

**Branch**: `008-usability-polish` | **Date**: 2026-11-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-usability-polish/spec.md`

## Summary

Six fixes. None stores anything, and each has one owner, so the two places that must agree cannot drift apart.

- **The capture band wraps when two whole lines fit.** The decision is `bandLines(band, line, gap) ≥ 2`. Every input is read from what is
  drawn: the band's height, a drawn column's height, and the band's own computed `row-gap`, which is the `--line-gap` token. Nothing re-derives
  TabStaff's rows. The band height does not depend on its content, so the decision cannot oscillate. Where it does not wrap, the one-line
  branch of `TabStaff` is not edited, so 375×667 is byte-identical.
- **The cursor's line goes to the bottom** by a relative `scrollBy` on the column-reverse band. A computed *runway* lets line 1 sit on the
  neck at the start of a long part. A request counter decides when the band moves: writes at the cursor, keys, jumps, opening, part changes
  and resizes. Taps, selections, inspector writes and sync arrivals never move it.
- **Wrapped capture needs four things from TabStaff**: a start caret, a caret that takes no inline room (so moving the cursor cannot move a
  line break), and horizontal-only `followTail` and `keepCaretInView` on the line that holds them. The play view passes none of these props,
  so its markup is unchanged.
- **Part cards** get one `OverflowMenu`, a modal `<dialog>` holding a `role="menu"`. Modal makes "an outside tap acts on nothing" and "one
  menu at a time" hold by construction. The label becomes a link to capture. It and the Edit item call one `partCaptureHref`.
- **Saving words** come from one pure `pendingWords(signInKnowledge(session, syncState), pending)`, and the top bar and the capture header
  both call it. "Not known" shows the count and never says sign in.
- **The status row** separates its facts with 1px rules and weight, at 3px *less* than today's gaps in the tightest case. The words are
  untouched.

The risky claims were measured on the production build first ([research.md](./research.md) R1, R6, R7, R10):

| Measure | Figure | What it means |
|---|---|---|
| One line, six strings, chord and bracket | 184px touch, 155.2px fine | |
| Band at 412×915 | 434px | fits two lines, so the blank at rest goes from 250 to **54** |
| Band at 1280×800 | 376px | blank goes from 220.8 to **53.6** |
| Band at 390×844 | 363px | **short of two such lines by 17** (Deviation 1) |
| Top bar free width at 375 | 66.5px | left after `Saved on this device` |
| `saved · sign in` | 69.4px | inside the 73.9 that `99 unsynced` takes today |

No migration, no new dependency, no new route, no change to `public/sw.js`, and no change to a byte of the export.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router).

**Primary Dependencies**: Tailwind CSS 4, Dexie 4 with `dexie-react-hooks`, `lucide-react`, and `better-auth` 1.7.15 (`useSession`, read
only). **No new dependency.** The platform's `<dialog>`/`showModal` and `ResizeObserver`.

**Storage**: Dexie/IndexedDB locally, mirrored to Postgres through `src/lib/sync/`. **No change**: no field, table, key or outbox entry. One
additive read query (`songCountsByBand`).

**Testing**: Vitest 5 (`npm test`), node by default and jsdom by docblock. Playwright 1.64 (`npm run test:e2e`) against a production build,
with the projects `mobile` (Pixel 7, coarse), `desktop` (fine), `firefox` (staves only) and `no-pointer` (density only). New specs run on
`mobile` and `desktop`. A person-level browser pass and three real-phone items follow.

**Target Platform**: Installable PWA in a mobile browser, offline-capable, plus a desktop browser. The budgeted sizes are 375×667, 390×844,
412×915 and 1280×800.

**Project Type**: Next.js web application, single package.

**Performance Goals**: A fret tap shows its note no slower wrapped than on one line (FR-008). Spec 001 to 007's timing and capture specs pass
unedited. Anchoring reads layout only inside effects, never on the tap path.

**Constraints**:
- The one-line branch of `TabStaff` and `src/lib/tab/` have **zero diff**. `baseline.json` is **unedited**.
- `e2e/usability-height-budget.spec.ts` is **re-pinned per line** (FR-003 as amended, Open item 7 / Deviation 8), not unedited.
- `PlayView.tsx` has **zero diff**. The play view's wrapped staff is unchanged (FR-010).
- `src/lib/sync/`, `src/db/`, `drizzle/`, `src/app/api/`, `src/lib/model.ts` and `src/lib/export/` have zero diff. `src/lib/local/` changes
  only by addition, in `queries.ts` and `hooks.ts`.
- `tsconfig.json` includes `specs/` and test files, so the research probe must pass `npm run typecheck`.
- A visual tier is never opacity over a surface. Unlayered CSS beats any Tailwind utility.
- Never run the build or the e2e suite while a dev server holds `.next`.
- Edits keep each file's line endings. In this tree, every file touched is **LF** (research R14).

**Scale/Scope**: about 9 new source files (about 600 LOC), about 8 modified source files, 5 new e2e specs, 1 recording script, 1 helper, 2
guard scripts, and 13 existing e2e files edited. **US-1 is what must land.** US-2 to US-6 are independent of it and of each other.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no ratified constitution to gate against. As in
entries 1 to 7, the gates are the project's working rules from `docs/DECISIONS.md`, `AGENTS.md` and the code's own headers.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Browser testing is part of done**, at actual size, in both themes. | `docs/DECISIONS.md` | PASS (owed) | `quickstart.md` §6, FR-034, INV-025. |
| **No colour decision from a magnified crop.** | `docs/DECISIONS.md` | PASS | No new colour. The invitation and the separators use existing tokens, measured by INV-016 and INV-021. |
| **A visual tier is never opacity over a surface.** | `docs/DECISIONS.md` | PASS | Rules and invitation are solid tokens. |
| **A distinction never rests on hue.** | `docs/DECISIONS.md` | PASS | Delete has an icon and a word. The invitation has a glyph and a dashed underline. The status row has rules and weight. |
| **The layout is the one source for screen and export.** | `layout.ts`, `ascii.ts` headers | PASS | Neither changes. Wrapping is the drawing's, and the line breaks come from CSS. |
| **Barlines are stored, never inferred.** | `layout.ts` header | PASS | Lines break only at stored barlines (`barRuns`). |
| **Domain rules live in `src/lib/`.** | `editing.ts` header | PASS | `capture/band.ts`, `saving.ts` and `words.ts` are React-free and unit-tested. |
| **Every write goes through `mutate.ts`.** | `mutate.ts` header | PASS | No new write. The menu calls the same `deleteRow` and `createVariant`. |
| **The SQL schema cannot drift from `model.ts`.** | `assert-model.ts` | PASS | Neither changes. |
| **Tests must be able to fail for the right reason.** | Entry 4 to 7 reviews | PASS | Oracles are hand tables and recorded "before" fixtures. FR-028's quiet-state wait also checks that the signed-out words are absent, so it cannot pass on a page that only lost the count. |
| **Never reuse a server, never share `.next`.** | `playwright.config.ts` | PASS | No harness change. The research probe uses its own port and no rebuild. |
| **Simplicity: no component library, thin primitives.** | `ui/index.tsx` header | PASS | `OverflowMenu` is one file on the platform's `<dialog>`. |
| **Offline first.** | `public/sw.js` header | PASS | The band list reads IndexedDB. "Not known", which is offline, never invites a sign-in. |
| **Earlier requirements stay true.** | spec 007 FR-064 | PASS | FR-035's amendments, pinned by `check:polish-amendments`. |

**Post-design re-check (after Phase 1)**: PASS. Nothing is stored, and every pair of things that must agree is closed by one calling the other
(*Agreement is structural*, below). No gate needs a Complexity Tracking entry.

## Invariants — what must never happen *(mandatory)*

Probed through `e2e` on a production build, through `renderToStaticMarkup(TabStaff)` in jsdom, and through the pure functions'
public exports, with the hooks in [contracts/](./contracts/).

Named sets:

- **Sz**: 375×667 (coarse), 390×844 (coarse), 412×915 (coarse), 1280×800 (fine).
- **Wr**, sizes where a 6-string, chord and bracket line wraps: 412×915, 1280×800. **Wr390** adds 390×844 with a 6-string part with a chord
  and no bracket.
- **Rows**: 6 strings plain; 6 + chord; 6 + chord + bracket; 4 + chord + bracket; 5 + chord + bracket; 7 + chord + bracket.
- **Th**: dark, light.
- **Pos**: cursor at the end; mid-part on the last line; mid-part on an upper line; at the start (before the first column).
- **Shape**: a 16-bar part; a 2-line part that fits whole; a part with one bar wider than the band; a part with no barlines; an empty part.
- **Trig**, anchor triggers (research R4): open; part change by chip; part change by key; fret tap; typed fret; dead-note key; `space`;
  barline; `paste`; stable delete; repeat −; repeat +; ×4; chord symbol set; triplet; column back and on; bar back and on; start key; end
  key; `start` jump; `end` jump; cut selection; delete selection; entering wrapped mode; band resize (window height, window width, chord form
  open, chord form closed).
- **Still**, never anchors: tap a column on each visible line; select; extend to another line; long press; an inspector write; group from a
  selection (reveal only); ungroup; copy; cancel selection; each latch toggle; a sync arrival from a second context; the help overlay
  opening.
- **Card**: base part named; base part unnamed; variant part named; variant part unnamed.
- **Close**: Escape; a backdrop tap; Tab; Shift+Tab; each item running.
- **Outside**: another card's trigger; another card's label link; a staff; the bottom bar's Capture; the page background; the top bar's Sign
  in.
- **Sess**, sign-in states (by route interception of `/api/auth/get-session` and `/api/sync/push`): never signed in (200 null); session 401;
  session check aborted (no network); session check held pending; signed in and online; signed in, then push 401; signed in and offline
  (`setOffline`).
- **Pend**: 0; 1; 14; 99.
- **Surf**: top bar on bands, band, song, play, tunings; capture header.
- **Lat**: none; stack; hammer-on; pull-off; slide up; slide down; stack and a transition.
- **Chd**: none; `Am`; `Dsus4`; a 10-character symbol (`Cm7b5add11`); an unknown symbol.
- **Dur**: none; `whole note`; `dotted sixteenth`.

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never does capture differ from today where the band does not wrap. | `e2e/polish-band.spec.ts` compares each row's rect and the staff's `outerHTML` with `e2e/fixtures/capture-375-before.json`, recorded from the unedited build (`quickstart.md` §1). `usability-height-budget.spec.ts` runs as re-pinned (the band does not wrap only where two whole lines do not fit; six strings with chord and bracket at 375×667 stays the deciding byte-identical case). | {4, 5, 6 strings} × {plain, chord, chord + bracket} × **Th** × {at rest, selecting} at 375×667. Also 7 strings at 375×667 and 6 at 375×553, which are one line with a swipe. |
| INV-002 | Never does the band wrap unless two whole lines fit, or show exactly one wrapped line. | e2e: read the band's content height, a column's height and the band's `row-gap`. Assert `.tab-staff-wrapped` exists ⇔ `band ≥ 2·line + gap`, and when it exists, the number of distinct run tops in view is ≥ 2 (or the part's line count). A height sweep checks that the mode never flips back and forth within one size. | **Sz** × **Rows** × {chord form closed, open}. Then 412 wide × heights 600 to 1000 in 20px steps, with 6 + chord + bracket, which crosses the threshold at 380 + fixed rows. |
| INV-003 | Never, at rest after a trigger, is the cursor's line anywhere but the bottom when the part overflows the band. Never is the blank at rest at the end a whole line or more. | e2e: the caret's `.tab-bar-run` bottom against the band's content bottom, within 1px. Blank = band top to the top of the highest run in view, less than one line. | **Trig** × **Pos** × **Wr**, on the 16-bar **Shape**. Also **Wr390**. At the start: line 1 at the bottom, with only runway above it. |
| INV-004 | Never does anything in **Still** move the band. | e2e: the band's `scrollTop` and every run's `top` before and after, within 1px. The second context writes through its own page. | **Still** × {the top line in view, the bottom line} × **Wr**. |
| INV-005 | Never does a line break move while content and width are unchanged. | e2e: map each `data-column` to its run's top. Move the cursor to every column, to the start and to the end; start and extend a selection; long press. The map must be identical each time. | Every column of the 16-bar part × **Wr**. Also the wide-bar **Shape**. |
| INV-006 | Never is a row that capture draws missing or misaligned on a wrapped line. Never is a caret drawn at the head of the next line. | e2e: on every line, the chord label, the bracket, the active rule, the selection band and the caret each sit within 1px of their column. The caret's run is the run of the column it follows (or the first run at the start). | **Rows** × every line × {caret after the last column of a line, after the first, before the first column of the part, after a ×4 column} × **Wr**. |
| INV-007 | Never does an interaction give a different result wrapped than on one line. | e2e: run one scripted sequence on a one-line staff (375×667) and on a wrapped staff (412×915). Compare full Dexie dumps (ignoring ids and clocks), the inspector's title, and the selection count. | Tap-select; extend across a line; group (tuplet and plain), with the bracket in view after; ungroup; long-press the inspector on line 1 and on the last line; each key in **Trig**; `followTail` and `keepCaretInView` on the wide bar. |
| INV-008 | Never does wrapping slow a fret tap. | e2e: median time from a fret's `pointerup` to the new column's paint (a `MutationObserver` with `requestAnimationFrame`), over 40 taps, on the same 16-bar part, wrapped against one-line. Spec 001 to 007's timing and capture specs run unedited. | Wrapped (412×915) ≤ one-line (375×667) × 1.1 + 2ms. At the end and mid-part. |
| INV-009 | Never does the song page or the play view change width, packing or markup. | `frets-unchanged.test.ts` with `baseline.json` unedited. `usability-wrap.spec.ts` unedited (`usability-staves.spec.ts` is re-pinned for capture only). `PlayView.tsx` zero diff in the fence. A jsdom render of `TabStaff` with `wrap` and no capture props equals the same render on `main`. | {song page expanded, compact, play view} × {frets, notes, intervals}. The fixture shapes of `baseline.json`. |
| INV-010 | Never does a card's face show Delete, `+ variant` or Edit as a control, or anything in the danger style. | e2e: count those accessible names in each card, without opening a menu, and expect 0. Walk the face's elements and expect no computed `color`, `background-color` or `border-color` equal to `--danger`. | **Card** × **Th** × **Sz**. The song page with three parts (SC-005). |
| INV-011 | Never is a card's menu unreachable by keyboard, or announced as something other than a menu with named items. | e2e, keyboard only: Tab to the trigger, then Enter or Space opens it; the first item is focused; ArrowDown, ArrowUp, Home and End visit each item; Enter activates; each **Close** route returns focus to the trigger. The accessibility snapshot shows `menu`, with `menuitem` names, and the trigger's name holds the label (and the name). | Every card × **Card** × {Enter, Space} × **Close**. |
| INV-012 | Never does the tap that opens the menu, or a tap outside it, act on anything else. Never does a part delete unless Delete was chosen. | e2e: open by pointer with the menu placed so Delete is under the press point, and the part count is unchanged after release. For each **Outside**, tap it with the menu open: URL unchanged, Dexie dump unchanged, menu closed, focus on the trigger. | Open by {tap, mouse click, Enter, Space} × **Outside** × {coarse, fine}. |
| INV-013 | Never is the menu off screen, under the bottom bar or printed, or are two menus open. | e2e: the menu's rect is inside the viewport and above the top of `song-actions` when that is visible. Print emulation: no trigger, no dialog. A second trigger cannot be activated while a menu is open, because it is inert. | The first card; the last card scrolled to the page end; a card scrolled to the top edge × **Sz**. |
| INV-014 | Never is a trigger, label link, invitation or menu item under its floor. | `e2e/usability-floors.spec.ts` walker, run with each menu open as well. Touch ≥ 44×44 (items ≥ 44 tall), and the mouse column of spec 007's floors table. | Each of those × **Card** × **Sz**. |
| INV-015 | Never does Edit, `+ variant` or Delete do anything other than what it does today. | e2e: Dexie dump after the menu's `+ variant` and Delete equals the dump after the same action on the unedited build, recorded in `capture-375-before.json`'s sibling `card-actions-before.json`. The label link's URL equals the Edit item's URL. Both come from one `partCaptureHref`. | **Card** × each action. Delete on a part used in the arrangement; on a variant's base. |
| INV-016 | Never does an unnamed part look like a name, or fail contrast. | e2e: the invitation has an `svg` and a computed `text-decoration-style: dashed`, and a real name has neither. A greyscale screenshot of the two crops differs. `measureContrast` ≥ 4.5 on `bg-raised`. Activating it opens the `Part name` input with today's value. | {null name, a name saved as spaces} × **Th** × {coarse, fine}. |
| INV-017 | Never does the bands list show a slug or a wrong count, or make a request to count. | e2e: no band's slug in the list's text. The count line equals a hand-expected value. `page.on("request")` sees no request while the list renders and updates. | Bands with {0, 1, 2, 3} songs; one with a deleted song; songs in another band; a song arriving by sync in a second context. |
| INV-018 | Never is a user who is known to be signed out shown `unsynced` or a count, and never is a user who may be signed in invited to sign in. | `src/lib/__tests__/saving.test.ts`: a hand table over `signInKnowledge` × `pendingWords`. e2e: each **Sess**, by route interception, on each **Surf**: the text `unsynced`, a digit count, `Saved on this device` and `saved · sign in`, present or absent as the table says. | **Sess** × **Pend** × **Surf** × {375, 1280}. |
| INV-019 | Never does the capture short form take more width than `99 unsynced` did, squeeze the title under 8ch, or push the open chip out of view. | e2e: the link's width ≤ the width of a `99 unsynced` span with today's classes, injected into the same header. The back button ≥ 8ch. The open chip is inside the chip strip's visible rect. The link is ≥ 44 tall and named `SAVED_HERE_NAME`. | {1, 5, 12 parts} × {a short title, a 120-character title} × **Th** × {375, 390}. |
| INV-020 | Never does a sync error lose its place. | e2e: push answers 500. The top bar shows the message, and neither the saving words nor the count. | Error × **Sess** × **Pend** (non-zero). |
| INV-021 | Never does the status row wrap, grow past 26px, cut what must be whole, or separate facts by colour alone. | `e2e/usability-status-row.spec.ts`, extended: row height 26; one line; `status-position` whole (`scrollWidth ≤ clientWidth`); a symbol of up to 10 characters whole except beside a refusal; a `Sep` between each pair of adjacent visible segments; the symbol's weight greater than the tones'; the accessible text reads `<symbol> chord: <t1>, <t2>, …`; jumps ≥ 44×24. | **Lat** × **Chd** × **Dur** × {a digit waiting, none} × {refused, not} × {end, start, mid} at 375. The F23 case (stack with `Dsus4`) is named. |
| INV-022 | Never do the status words change. | `latches.ts` has zero diff in the fence. e2e: the text of `status-position` equals today's literal for each state, from a hand table. | **Lat** × {end, start, mid} × {a digit waiting, none}, plus the refusal. |
| INV-023 | Never does a stored row, sync, schema, wire format, storage path or the export change. | `npm run check:untouched-polish`. `frets-unchanged.test.ts` unedited. | The paths in *Scope fence* below. |
| INV-024 | Never is an earlier requirement left saying something untrue, or a pin moved in silence. | `npm run check:polish-amendments`: each row of *Existing tests this changes on purpose* is named in `docs/DECISIONS.md`, and each FR-035 requirement carries `Amended by spec 008` on its own line. `check:usability-amendments` still passes. | Spec 007 FR-056, FR-001, FR-026, and the Out of Scope line "Wrapping … capture". Every row of the table. |
| INV-025 | Never is a claim that a desktop cannot prove, or that needs a person, marked done. | `tasks.md` carries the browser pass and the three real-phone items as human tasks, `🛑 BLOCKED` until done. | `quickstart.md` §6 × 4 sizes × 2 themes. The three items of §7. |

### Requirements to invariants

| Requirements | Invariants |
|---|---|
| FR-001, FR-002 | INV-002, INV-003 |
| FR-003 | INV-001 |
| FR-004, FR-005 | INV-003, INV-004 |
| FR-006 | INV-006, INV-007 |
| FR-007 | INV-005 |
| FR-008 | INV-008 |
| FR-009 | INV-002, INV-003 at 1280×800 |
| FR-010 | INV-009 |
| FR-011 | research R1 (before), `quickstart.md` §1 and §6 (after), recorded in `docs/DECISIONS.md` |
| FR-012, FR-015 | INV-010, INV-014 |
| FR-013 | INV-014, INV-015 |
| FR-014 | INV-012, INV-015 |
| FR-016 | INV-011, INV-012 |
| FR-017 | INV-013, INV-014 |
| FR-018 | INV-024 |
| FR-019, FR-020 | INV-016 |
| FR-021 to FR-023 | INV-017, INV-023 |
| FR-024 to FR-026 | INV-018, INV-019 |
| FR-027 | INV-020 |
| FR-028 | INV-018, INV-024 |
| FR-029 to FR-031, FR-033 | INV-021 |
| FR-032 | INV-022 |
| FR-034 | INV-025 |
| FR-035, FR-036 | INV-024 |
| FR-037 | INV-023 |
| SC-001, SC-003 | INV-002, INV-003 |
| SC-002 | INV-001 |
| SC-004 | INV-004, INV-007 |
| SC-005, SC-006 | INV-010, INV-011 |
| SC-007 | INV-018 |
| SC-008 | INV-017 |
| SC-009 | INV-021 |
| SC-010 | INV-016 |
| SC-011 | INV-023 |
| SC-012 | INV-025 |
| Edge: one line fits; seven strings; under 667 | INV-001, INV-002 |
| Edge: chord form, keyboard, rotation, resize | INV-002, INV-003 (resize triggers) |
| Edge: cursor at the start; a short part | INV-003, Deviation 2 |
| Edge: a wide bar; caret at a line end; selection across lines; a group | INV-005, INV-006, INV-007 |
| Edge: a widened chord column; insert mid-part | INV-005, INV-006, INV-003 |
| Edge: twelve parts, signed out | INV-019 |
| Edge: offline signed in; after a refusal; an error | INV-018, INV-020 |
| Edge: two menus; menu near the bottom; printing | INV-013 |
| Edge: whitespace name | INV-016 |
| Edge: songs not yet synced | INV-017 |

### Agreement is structural

| Two things that must agree | How |
|---|---|
| The wrap decision and the drawn line | The decision measures a drawn column, which is a whole line's height, and the band's computed `row-gap`, which is the same `--line-gap` the wrapped lines use. It never recomputes TabStaff's rows. |
| The anchor and where the cursor is drawn | The anchor reads the caret element TabStaff draws, or the `aria-current` column. It never recomputes which line a column is on. |
| Line packing and the cursor | The wrapped caret takes no inline space, so packing reads only content and width. |
| The top bar's words and the capture header's | One `pendingWords(signInKnowledge(…), pending)`, through one `useSaving()`. |
| The label link and the menu's Edit | One `partCaptureHref`. |
| The menu's Delete and `+ variant` and today's | The same `deleteRow("parts", id)` and `createVariant(part)` calls, moved and not rewritten. |
| The band list's count and the songs a band has | `songCountsByBand` filters with the same `isLive` as `listSongs`. |
| The status words and today's | `statusFor`, `statusShortFor`, `TRIPLET_REFUSAL` and the position literals are moved into `StatusRow`, not retyped. `latches.ts` is fenced. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| **Deletion**: Delete part, now behind a menu. | **Unchanged in effect.** One extra tap, and no confirm or undo is added or removed. A32 stays logged. | The spec keeps "what exists", and nothing exists. A confirm or undo is new behaviour. | INV-012, INV-015 |
| **Deletion**: could the tap that opens the menu delete? | **No.** A modal dialog, plus a stray-click guard: a click whose press did not begin inside the dialog runs nothing. | The opening release lands where Delete may be drawn. `Sheet` already met this exact bug (spec 007 T121). | INV-012 |
| **Deletion**: could an outside tap act on what is beneath? | **No.** The page is inert while the menu is open, and the backdrop takes the tap. | That is owed to a real phone, and `popover` would let it through (R9). | INV-012, INV-013 |
| **Authority**: who sees the menu and its items. | Everyone who sees the card today, with the same items. `+ variant` only on a non-variant, as today. | No role exists, and none is added. | INV-015 |
| **Authority**: telling a user to sign in. | Only when the app **knows** they are signed out: the check settled with no session, or a 401. "Unknown" shows the count. | A false sign-in prompt in rehearsal is the same alarm in a new form (spec's decision). | INV-018 |
| **Data rewrite**: existing rows. | None. No migration, backfill or normalisation. Names already store whitespace as `null`. | FR-037. | INV-023 |
| **Data read**: band list counts. | This device's live songs only, with no request. | FR-022. A count that fills in as songs arrive is true. | INV-017 |
| **Publishing**: what leaves the app. | Nothing new. The export, sync messages and the wire format are unchanged. | FR-037. | INV-023 |
| **Money** | None involved. | | |

### Scope fence

`scripts/untouched-by-polish.sh`, run as `npm run check:untouched-polish`, prints `zero diff` for every path below against `main`, tracked
or untracked, and fails on any other result:

`src/db/`, `drizzle/`, `src/lib/server/`, `src/lib/sync/`, `src/app/api/`, `src/lib/model.ts`, `src/lib/tab/` (all of it, tests too),
`src/lib/export/`, `src/lib/rhythm/`, `src/lib/reading/`, `src/lib/arrangement/`, `src/lib/capture/latches.ts`, `src/lib/chords.ts`,
`src/components/app/PlayView.tsx`, `public/sw.js`, `e2e/usability-height-budget.spec.ts`, `e2e/usability-wrap.spec.ts`,
`e2e/usability-staves.spec.ts`, and every file in `src/lib/local/` **except** `queries.ts` and `hooks.ts`.

For `queries.ts` and `hooks.ts`, `git diff main -U0` must contain no removed line, other than a changed import list, and the guard prints
the added declarations.

It also checks that `TabStaff.tsx`'s diff touches no line between the one-line branch's `return (` and the end of `TabStaff`'s body. It does
this by comparing that slice of the file on `main` and on the branch, byte for byte. Test the guard in a throwaway worktree, and with
`grep -U`, as spec 006's review advised.

### Deviations and readings, all cheap to overturn

Spec text is not edited by this plan. Each item says how the plan reads it.

1. **At 390×844, six strings with a chord *and* a bracket stay one line.** Two such lines need 380px (368 with no gap), and the band has 363
   (measured, R1). FR-002 governs. SC-003's 390×844 trial uses six strings with a chord and no bracket, which wraps at 344.8.
   **To overturn**: shrink the touch staff rows, which breaks FR-003 at 375, or drop a row from capture.
2. **A part that fits whole shows every line, even when the cursor's line has lines below it.** FR-004's "no line below the cursor's line
   at rest" applies when the part overflows the band. This follows the spec's own edge case, "A short part with spare height".
   **To overturn**: hide later lines with a runway, which leaves blank space showing while content exists.
3. **Beside a triplet refusal, a 10-character symbol is cut.** FR-031 asks for both whole, which needs 376.4px of 351. This is spec 007's
   Deviation 3, carried over. The refusal lasts until the cursor moves.
4. **"Shown as cut" means an ellipsis while there is room for one.** Below that width the segment, and its separator, are clipped to
   nothing. Today's tones already do this.
5. **More routes anchor than FR-005 lists.** The extra ones are `space`, barline, `paste`, the stable delete, the contextual row (repeat, ×4,
   chord symbol, triplet), cut or delete of a selection, entering wrapped mode, and resizes. Each puts or keeps the caret where a line can
   drop it out of view. Inspector writes and grouping from a selection do not anchor (R4).
6. **The menu is modal.** While it is open the page is inert, so "opening one card's menu closes any other" happens as two taps: one closes,
   the next opens. FR-016's "at most one menu" holds by construction.
7. **The capture short form reads `saved · sign in`**, at 69.4px against the 73.9px budget. The fallback, if a phone's sans is wider, is
   `local · sign in` at 64.0.
8. **The top bar's words are `Saved on this device`, in the sans face,** not in mono as the count is.
9. **A just-signed-in user may see the saved words for one sync cycle,** if an older `signed-out` is still persisted. `syncNow` overwrites it
   with `syncing` on the first cycle, and fixing it at source would touch `src/lib/sync/`, which is fenced.
10. **`--line-gap` moves to `:root`**, with its value unchanged, so the band can read it as its own `row-gap`. The play view inherits the
    same 12px.
11. **The status row's gap goes from 4px to 2px**, with separators taking the difference. The tightest case nets −3px.

### Existing tests this changes on purpose

Each is named in `docs/DECISIONS.md` as it changes, and none is deleted or weakened (FR-018, FR-028, FR-036).

| File | Why |
|---|---|
| `e2e/grouping-queued-row.spec.ts` | FR-028: the quiet state waits for no `N unsynced` **and** no `Saved on this device` or `saved · sign in`. |
| `e2e/capture-matrix.spec.ts` | FR-028: its FR-001 rows run signed out, so they pin the short form in place of `N unsynced`. |
| `e2e/rhythm-capture-height.spec.ts` | FR-028: INV-009's long title with the short form in place of `N unsynced`. |
| `e2e/usability-status-row.spec.ts` | FR-033: its `read` walks segments by test id rather than by child index, and adds the separation checks. |
| `e2e/capture-surface.spec.ts` | FR-018: `Delete part A` goes through `partAction`. |
| `e2e/capture.spec.ts` | FR-018: `+ variant` goes through `partAction`. |
| `e2e/grouping.spec.ts` | FR-018: `+ variant`. |
| `e2e/reading-sync.spec.ts` | FR-018: `+ variant`, Edit and `Delete part A`. |
| `e2e/sync-no-lost-rows.spec.ts` | FR-018: `+ variant`. |
| `e2e/usability-toolbars.spec.ts` | FR-018: the "part delete" gap is measured with the menu open, between Delete and its nearest item, and must still be ≥ 8. |
| `e2e/variant-marks.spec.ts` | FR-018: `+ variant`, Edit and `Delete part A`. |
| `e2e/variant-marks-paint.spec.ts` | FR-018: `+ variant` and Edit. |
| `e2e/usability-floors.spec.ts` | FR-036: the song-page walk also runs with a menu open. Its floors are unchanged. |
| `e2e/usability-height-budget.spec.ts` | FR-003 as amended (Deviation 8): counts distinct `.tab-cell` tops within the cursor's line (last wrapped run, or the staff), still expecting every string, in view. A four-string part wraps at 375×667. |
| `e2e/usability-staves.spec.ts` | FR-003 as amended (Deviation 8): `measureSurface` takes each chord's edge from the run it sits in when wrapped. INV-016/017 keep their limits. |

**Must pass unedited:** `usability-wrap.spec.ts`,
`usability-every-input.spec.ts` (it reaches `Part name` by a named part's button, which stays), `grouping-band.spec.ts`, every `click-*`
spec, `src/lib/tab/__tests__/`, and `src/lib/reading/__tests__/` with `baseline.json`. If one trips, stop and report it. Do not edit it.

## Project Structure

### Documentation (this feature)

```text
specs/008-usability-polish/
├── plan.md                 # This file
├── research.md             # Phase 0: R1–R14, measured figures
├── data-model.md           # Phase 1: derived state only, nothing stored
├── quickstart.md           # Phase 1: validation guide
├── contracts/
│   ├── capture-band.md     #   band.ts, useCaptureBand, TabStaff's wrapped branch, CSS
│   ├── part-card.md        #   OverflowMenu, PartCard, e2e helper
│   ├── saving-and-lists.md #   saving.ts, useSaving, TopBar, capture header, band list
│   └── status-row.md       #   StatusRow segments and budget
├── research-probes/        # Phase 0 measurement probe and its config (no rebuild, own port)
├── checklists/             # pre-existing
├── spec.md
└── tasks.md                # Phase 2 output (/speckit-tasks, NOT created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── capture/
│   │   ├── band.ts                    # NEW: bandLines, bandWraps, anchorFor
│   │   └── __tests__/band.test.ts     # NEW
│   ├── saving.ts                      # NEW: signInKnowledge, pendingWords, the words
│   ├── words.ts                       # NEW: songCountWords
│   ├── __tests__/saving.test.ts       # NEW
│   ├── __tests__/words.test.ts        # NEW
│   └── local/
│       ├── queries.ts                 # ADDITIVE: songCountsByBand
│       └── hooks.ts                   # ADDITIVE: useSongCounts
├── components/
│   ├── ui/OverflowMenu.tsx            # NEW
│   ├── app/
│   │   ├── useSaving.ts               # NEW
│   │   ├── TopBar.tsx                 # MODIFIED: SyncBadge via useSaving
│   │   └── SongView.tsx               # MODIFIED: PartCard face, menu, label link, invitation, partCaptureHref
│   ├── capture/
│   │   ├── useCaptureBand.ts          # NEW
│   │   ├── StatusRow.tsx              # NEW (moved out of CaptureScreen, segmented)
│   │   └── CaptureScreen.tsx          # MODIFIED: band ref, wrap, anchorRequest, header words, StatusRow
│   └── tab/TabStaff.tsx               # MODIFIED: wrapped branch only (contracts/capture-band.md §4)
└── app/
    ├── globals.css                    # MODIFIED: --line-gap to :root
    └── page.tsx                       # MODIFIED: song count in place of the slug
e2e/
├── polish-before.record.ts            # NEW: records the unedited build's 375 capture and card actions
├── fixtures/capture-375-before.json   # NEW, recorded once
├── fixtures/card-actions-before.json  # NEW, recorded once
├── part-card-helpers.ts               # NEW: openPartMenu, partAction
├── polish-band.spec.ts                # NEW: INV-001 to 003, 005, 008
├── polish-band-interactions.spec.ts   # NEW: INV-004, 006, 007
├── polish-part-card.spec.ts           # NEW: INV-010 to 016
├── polish-saving.spec.ts              # NEW: INV-018 to 020
└── polish-bands-list.spec.ts          # NEW: INV-017
scripts/
├── untouched-by-polish.sh             # NEW: check:untouched-polish
└── check-polish-amendments.sh         # NEW: check:polish-amendments
package.json                           # MODIFIED: the two scripts
playwright.config.ts                   # MODIFIED: two specs added to PHONE_ONLY
docs/DECISIONS.md                      # MODIFIED: figures, amendments, re-pinned tests, browser findings
specs/007-usability-pass/spec.md       # MODIFIED: FR-001, FR-026, FR-056, Out of Scope, amended in place
```

`polish-before.record.ts` is matched by no project's default `testMatch`. It is run by path, once, as in `quickstart.md` §1. The new
`polish-*.spec.ts` that are phone-only go into `PHONE_ONLY` in `playwright.config.ts`: `polish-saving.spec.ts` and
`polish-bands-list.spec.ts`. The band and card specs run on both `mobile` and `desktop`.

**Structure Decision**: a single Next.js package, unchanged. The decisions go in `src/lib/` (band arithmetic, sign-in knowledge, words) as
React-free functions with hand-table tests. The DOM reading sits in two hooks. The one new primitive, `OverflowMenu`, goes in `ui/` beside
`Sheet`. `src/lib/reading/` and `src/lib/tab/` are not opened.

## Build order

Each step leaves the suite green and is usable alone. **Step 0 must come first.**

0. **Record "before"** (`quickstart.md` §1) from the unedited build, and commit the fixtures.
1. **Guards**: the fence and amendment scripts, with the table rows above.
2. **Saving words** (US3): `saving.ts`, `useSaving`, TopBar, the capture header, and the three FR-028 test edits. This is small, and it
   unblocks every signed-out e2e that reads the header.
3. **Band list** (US6).
4. **Part cards** (US2, US5): `OverflowMenu`, `PartCard`, `part-card-helpers.ts`, then the eight test reroutes.
5. **Status row** (US4): extract `StatusRow` with no change and the suite green, then segment it.
6. **Capture band** (US1): `band.ts`, then TabStaff's wrapped-branch changes (jsdom first), then `useCaptureBand`, then the band wiring,
   then the triggers one at a time, with `polish-band*.spec.ts` growing alongside.
7. **After-figures, amendments, `DECISIONS.md`, the browser pass.**

If the entry runs long, **US-1 is the one that must land**. Steps 2 to 5 are independent of it and of each other.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No gate violations. Two choices add machinery:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| A JS measure of the band (`ResizeObserver`) | FR-002 makes wrapping depend on the height actually available, which CSS cannot test against content height. | A breakpoint is forbidden by FR-002. Always wrapping breaks FR-003. |
| A runway (computed top padding) | It lets line 1 reach the bottom at the start of a long part (Edge Cases). | Scrolling alone cannot pass the content's top. Switching the band off column-reverse breaks spec 007 FR-005. |

## Open for the human

Not blocking. Planning went ahead under the standing instruction to decide and move on.

1. **Deviation 1: 390×844 with a chord and a bracket stays one line.** This is measured, not guessed. It is the most visible gap between the
   brief and what fits. The only fixes cost the 375 screen.
2. **The spec's own "worth your eye" items stand:** the cursor's line at the bottom rather than later lines below it, and "not known" showing
   the count.
3. **Deviation 5: the wider trigger set.** It is reasoned rather than asked for. Worth a thumb-test on a real phone, owed item 2.
4. **The short form `saved · sign in`** has 4.5px of margin on this machine's font. A phone may need the fallback (Deviation 7).
5. **The constitution is still the scaffold template**, as for the previous entries.
6. **Spec 006 FU19, the sync flake, is still open,** and can fail this entry's runs. Do not lengthen a wait for it.
7. **Deviation 8 (found in T019): 4-string parts wrap at 375×667.** A four-string line with a bracket is 116.8px, so two lines and the gap
   (245.6) fit the 257px band, and FR-002 wraps it. That contradicts INV-001's "unchanged at 375×667 for 4 and 5 strings", and it trips specs in
   the fence that must pass unedited: `usability-height-budget` (2 tests: it counts distinct `.tab-cell` tops, expecting one per string) and
   `usability-staves` INV-016/017 (chord past the staff, on the wrapped capture). 6-string chord+bracket at 375×667 is byte-identical
   (`e2e/polish-band-unchanged.spec.ts`). Choices: (a) accept FR-002 and amend those tests, which the fence forbids, so it needs a human;
   (b) add a minimum, e.g. no wrap below some band height, which departs from FR-002's "depends only on the height it has".
   **Decided 2026-11-12 (supervisor, under Jamie's standing "decide and log" instruction): (a).** Using spare height is the point of
   US-1, and the roadmap promised "exactly as today" only where there is no spare height, which is the six-string case; that stays
   byte-identical. A minimum would be a hidden breakpoint FR-002 forbids. So FR-003 and INV-001 now read "where two whole lines do not
   fit", and the three tests are amended per line, keeping every guarantee: `usability-height-budget` counts the strings of the
   cursor's line (distinct tops in the last wrapped run, or in the staff when one-line) and still requires all of them in view;
   `usability-staves` INV-016/017 measures each chord against the right edge of the run it sits in. If a chord label really does cross
   its run's edge, that is a defect in the wrapped branch: fix the code, not the measure. T056-T057 carry this; T019 then runs.

