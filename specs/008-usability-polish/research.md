# Research: Usability polish

Phase 0 for [plan.md](./plan.md). Each item has a **Decision**, a **Rationale**, and the **Alternatives considered**. Figures marked
**measured** come from `research-probes/measure.probe.ts`, run on the production build of `d503e97` (`npx playwright test --config
specs/008-usability-polish/research-probes/playwright.measure.config.ts`), in Chromium on the Windows machine in use. A real phone's
system font differs by a few percent. Every figure that a requirement depends on is measured again at implement (FR-011).

No `NEEDS CLARIFICATION` was left in Technical Context. The open questions were design questions, and each is settled below.

## R1. How much the band has, and how tall a line is (measured)

Six strings, a chord row and a bracket row, cursor at the end, at rest:

| Size | Pointer | Band content (px) | One line (px) | Two lines + gap (px) | Lines that fit | Blank at rest today (px) |
|---|---|---|---|---|---|---|
| 375×667 | touch | 186 | 184 | 380 | 1 | 2 |
| 390×844 | touch | 363 | 184 | 380 | **1** | 179 |
| 412×915 | touch | 434 | 184 | 380 | 2 | 250 |
| 1280×800 | fine | 376 | 155.2 | 322.4 | 2 | 220.8 |

The band's outer heights are 189.6, 366.6, 437.6 and 379.6. They include `pt-1`, which is 4px of padding. The gap between lines is
`--line-gap`, 0.75rem, or 12px. Row heights: title 45, status 26, toolbars 46/46 (touch) and 34/34 (fine), latch strip 39 and 34, neck
274.4 and 246.4.

Other row sets, calculated from the measured tokens (`--string-height` 24.8 and 20.8, `--staff-row` 17.6 and 15.2):

| Row set | Line (touch) | Two lines (touch) | Fits at 390×844 (363)? | Line (fine) |
|---|---|---|---|---|
| 6 strings, no rows | 148.8 | 309.6 | yes | 124.8 |
| 6 strings + chord | 166.4 | 344.8 | yes | 140.0 |
| 6 strings + chord + bracket | 184.0 | 380.0 | **no, short by 17** | 155.2 |
| 4 strings + chord + bracket | 134.4 | 280.8 | yes | 113.6 |
| 7 strings + chord + bracket | 208.8 | 429.6 | no | 176.0 |

**Decision**: the band wraps when `bandContent ≥ 2 × line + gap` (FR-002). At 412×915 after the change, the blank at rest is 434 − 380 =
**54px**, against 250 today. That is less than one line (SC-001). At 1280×800 it is 376 − 322.4 = **53.6px**.

**Finding, recorded as Deviation 1**: at 390×844, two lines of six strings with a chord row *and* a bracket row need 380px, and the band has
363. Even with no gap they need 368. FR-002 is the rule, so that configuration stays one line, as today. SC-003's "at 390×844 the band shows at
least two lines" holds for every row set in the table except six or seven strings with both rows. The SC-003 fixture at 390×844 is
therefore six strings with a chord row and no bracket, which needs 344.8px.

**Alternatives considered**: shrinking `--line-gap` on capture. That is not enough, because 368 > 363. Shrinking `--staff-row` would break
the 375×667 pixel-for-pixel rule (FR-003). A breakpoint was ruled out by FR-002.

## R2. What decides "wrapped", and how it stays stable

**Decision**: a hook, `useCaptureBand`, observes the band with one `ResizeObserver`. On each observation, and after each render whose
content changed, it reads three numbers:

- the band's content height: `clientHeight` less its padding;
- the height of the first drawn `[data-testid="tab-column"]`, which is one line;
- the gap: the band's own computed `row-gap`.

A pure function, `bandLines(band, line, gap)` in `src/lib/capture/band.ts`, returns how many whole lines fit. The band wraps when that is at
least 2.

- **A column's height is a line's height in both modes.** Every column stacks every row the part has: bar number, chord, bracket, cells,
  rhythm and diff mark. Wrapped columns stretch to the run's height, which is the same stack. Measuring the drawn column means the hook never
  re-derives which rows a part has, so the decision cannot drift from the drawing. The staff's own height would not do. On a desktop with
  classic scrollbars, the one-line staff carries a horizontal scrollbar, which the wrapped staff hides.
- **The gap has one owner.** `--line-gap` moves from `.tab-staff-wrapped` to `:root`, with its value unchanged. The band gets
  `gap-y-(--line-gap)`. The band has exactly one child, so the gap draws nothing, and `getComputedStyle(band).rowGap` returns the token in px.
  The play view inherits the same value as before.
- **No feedback loop.** The band is `flex-1 min-h-0` in an `h-dvh` column of fixed-height rows. Its height does not depend on its content,
  and a column's height does not depend on the mode. So switching mode cannot change either input, and the decision cannot oscillate.
  INV-002 probes this with a height sweep.
- **An empty part** has no column, so `line = 0`, and `bandLines` returns 0. Nothing wraps, and the screen is as it is today.

**Alternatives considered**:
- Computing the line height from tokens and row flags in JS. That copies TabStaff's row logic, and would drift the day a row is added, for
  example by `rhythm-notation`.
- Container queries. These can say nothing about content height.
- Always rendering the wrapped markup. That breaks FR-003's "pixel for pixel" and SC-002's "same markup".

## R3. Putting the cursor's line at the bottom of a column-reverse band

The band stays `flex-col-reverse overflow-y-auto` (spec 007, FR-005). Its scroll origin is the bottom. `scrollTop` is 0 at the bottom and
negative upward in current Chromium, Firefox and Safari.

**Decision**: anchoring is a relative move, `band.scrollBy({ top: lineBottom − bandBottom })`. It never assigns an absolute `scrollTop`, so it
does not depend on the sign convention. The cursor's line is the `.tab-bar-run` that holds the caret. All runs on one flex line share top and
bottom, because `align-items` is `stretch`. When a selection hides the caret (`insertAfterEventId` is undefined), the line is the one holding
`[aria-current="true"]`.

**The runway.** With the cursor near the start of a long part, scrolling alone cannot bring line 1 to the bottom, because content cannot
scroll past its own top. The spec wants line 1 at the bottom with honest blank above it (Edge Cases). So when a part overflows the band,
`anchorFor()` returns a *runway*: the extra top padding needed for the cursor's line to reach the bottom.

```
runway = max(0, bandContent − (cursorLineBottom − contentTop))
```

The runway is applied as `padding-top` on the band's single child, and only in wrapped mode. Recomputing it moves nothing on screen, because
in a column-reverse scroller added top space grows the scroll range above the origin and leaves the visible bottom where it is.

**A part that fits whole** has no overflow, so there is no runway and no scroll, and every line shows. This is the "short part with spare
height" edge case. Here the cursor's line can have lines below it at rest. See Deviation 2.

**Alternatives considered**:
- `scrollIntoView({ block: "end" })` on the run. It also scrolls every scrollable ancestor, and the line's own horizontal scroll, and it gives
  no way to make a runway.
- Switching the band to a normal `flex-col`. That would break spec 007 FR-005's reachable-overflow rule, which the brief asks to keep.

## R4. What moves the band (anchor triggers) and what never does

The spec lists notes added, keys, jumps, opening and part changes as triggers (FR-005). It also lists a tap, a selection start and a
selection extend as never moving the band. Every other route had to be placed on one side or the other.

**Decision**: one request counter, `anchorRequest`, in `CaptureScreen`. It is bumped on the triggers below and on nothing else. The band
anchors on the render after each bump, and again on the first render that delivers the requested write. That second anchor is needed
because a write reaches `columns` through the live query a render later. The request is then spent, so a later `columns` change with no
request outstanding, such as a sync arrival, moves nothing.

| Triggers (anchor) | Never anchors |
|---|---|
| Capture opens; the part changes (chip, part key) | A tap on a column, on any line |
| A fret tap; a typed fret; the dead-note key | Starting a selection; extending it, on any line |
| `space`; barline; `paste`; the stable row's delete | Long press, the inspector opening, and any write made from the inspector |
| Contextual row: repeat − and +, ×4, chord symbol set, triplet | Grouping or ungrouping from a selection (this reveals the bracket instead, R5) |
| Column, bar, start and end keys | Copy; cancel selection; latch toggles |
| The `start` and `end` jump buttons | A sync arrival from another device |
| Cut or delete of a selection (the cursor goes to the end) | The help overlay; the tempo sheet |
| The band entering wrapped mode; any change of the band's width or height (rotation, window resize, chord form, on-screen keyboard) | |

Contextual-row writes are triggers, though the spec does not name them. ×4 and repeat + widen the cursor's column. The widening can push
the caret onto a new line below the bottom one, and without an anchor it would sit out of view. Triplet makes a group that ends at the cursor.
Groups never cross a barline and lines break only at barlines, so its bracket sits on the cursor's line, and anchoring shows it. Inspector
writes are excluded because the inspector acts on a long-pressed column that may be on another line. Moving the band under an open sheet
would hide the column being edited. See Deviation 5.

**Alternatives considered**:
- Anchoring on every `columns` change. That moves the band on sync arrivals and breaks spec 007 INV-005.
- Anchoring on cursor change. A tap changes the cursor and must not move the band.

## R5. Wrapped mode in an editing surface: what TabStaff needs

Today the wrapped branch serves only the play view. It is missing four things capture needs:

1. **The start caret.** `insertAfterEventId === null` draws a caret only in the one-line branch. **Decision**: the wrapped branch draws it at
   the head of the first run.
2. **A caret that takes no room.** The one-line caret is a `w-0.5` flex item. In a run it adds 2px to whichever line holds it, so moving the
   cursor could move a line break, which FR-007 forbids. **Decision**: in wrapped mode, the caret is a zero-width holder with the 2px bar
   absolutely positioned and centred on the boundary. Line packing is then a function of content and width alone (INV-005).
3. **Scroll handlers.** `followTail`, `keepCaretInView` and `revealGroups` read `scroller.current`, which the wrapped branch never sets.
   **Decision**: each acts horizontally on the run that holds its target, by setting that run's `scrollLeft`. They act only when the caller
   passes them, and the play view passes none of them, so the play view is unchanged. Vertical movement belongs to the band (R3), with one
   exception: `revealGroups` keeps `scrollIntoView({ block: "nearest", inline: "nearest" })`, because a group made from a selection on an
   upper line must be brought into view, and nearest is the least movement that does it.
4. **Nothing else.** Columns, `InspectableColumn`, the gap and connector cells, chord rooms, brackets and the selection band are all
   per-column, so each line already draws them on every column it holds. The gutter repeats the string labels per line, as on the play view.

The one-line branch is not edited, so its markup is byte-identical (FR-003, SC-002). `baseline.json` pins TabStaff's markup without
`insertAfterEventId`, which is how the play view and the song page call it. Nothing it pins changes.

**Alternatives considered**: a capture-only staff component. That would be a second drawing of the tab, and the layout's one-owner rule
(`layout.ts` header) is the reason TabStaff exists.

## R6. The top bar has room for the words (measured, at 375)

The bar's inner width is 343. The logo is 104.5. The right-hand group is 136.1: the help button is hidden on touch, `2 unsynced` is 72, and
`Sign in` is 52.1, with `gap-3`. That leaves **102.4px free**.

`Saved on this device` at `text-xs` measures **107.9**. Replacing the count (72) adds 35.9, which leaves **66.5px free**.

**Decision**: the top bar says **`Saved on this device`** beside the existing `Sign in` link, in `text-text-faint` (it was `font-mono` for the
count). The words are true on any device (FR-024). No second link is added.

**Alternatives considered**: `Saved here` (58.4) is shorter but vaguer. `Not synced` is the alarm the spec removes.

## R7. The capture header's short form (measured)

The budget is `99 unsynced` in `font-mono` at 0.7rem: **73.9px**.

| Candidate, 0.7rem | Sans | Mono |
|---|---|---|
| `saved · sign in` | **69.4** | 100.8 |
| `local · sign in` | 64.0 | 100.8 |
| `saved, sign in` | 66.3 | 94.1 |
| `saved here · sign in` | 94.4 | 134.4 |
| `sign in` | 32.5 | 47.0 |

**Decision**: **`saved · sign in`**, in the interface sans at 0.7rem, as a `Link` to `/sign-in`. Its accessible name is **"Saved on this
device. Sign in to sync with your band."** It is `min-h-(--control)` tall, in a 45px header. INV-019 checks its width against a `99 unsynced`
span drawn in the same page. A system sans can be a few percent wider on a phone, so the probe runs on the real fonts at the browser pass, and
the fallback is `local · sign in` (64.0).

**Alternatives considered**: `sign in` alone fits easily, but it hides the reassuring half of the message from sighted users. An icon would
say "phone" or "laptop", which FR-024 forbids.

## R8. Knowing whether the user is signed in

`useSession()` (better-auth 1.7.15, `dist/client/query.mjs`) starts with `{ data: null, error: null, isPending: true }`. A 200 with no session
gives `data: null, error: null, isPending: false`. A 401 gives `error.status === 401` and `data: null`. A network failure, such as offline or a
dead server, gives `error` set, `data` kept as it was (null on first load), and `isPending: false`. The service worker never answers
`/api/*` (`public/sw.js:159`), so offline really is a network failure.

The sync engine writes `state: "signed-out"` into Dexie when push or pull gets a 401 (`src/lib/sync/client.ts:121, 192`). It only runs while
a session exists (`SyncProvider`). The state is persisted, and `syncNow` overwrites it with `syncing` at the start of the next cycle.

**Decision**: one pure function, `signInKnowledge(session, syncState)` in `src/lib/saving.ts`:

| Session check | Sync state | Knowledge |
|---|---|---|
| any | `signed-out` | **signed-out**. The server refused. |
| `isPending` | not `signed-out` | **unknown** |
| `error.status === 401` | any | **signed-out** |
| `error` set, not 401 | not `signed-out` | **unknown**. There is no signal, so the session cannot be checked. |
| settled, `data` present | not `signed-out` | **signed-in** |
| settled, `data` null, no error | any | **signed-out** |

A second pure function, `pendingWords(knowledge, pending)`, returns `null` when `pending` is 0, `"saved-here"` when the knowledge is
signed-out, and `{ count }` otherwise. **Both surfaces call it.** The top bar and the capture header cannot disagree about which words show,
because there is one decision, and each surface only picks how to draw it. The top bar still checks for a sync error first, as today
(FR-027), and still shows `offline` or `syncing…` when nothing is pending.

A known transient: with a persisted `signed-out` left from before, a user who has just signed in sees the saved words until the first sync
cycle writes `syncing`. That happens on the first render after the session arrives. See Deviation 9.

**Alternatives considered**: reading the sync state alone. That is the bug the spec found: a user who never signed in never reaches
`signed-out`. Treating any session error as signed-out would tell a signed-in bassist in a basement to sign in, which FR-026 forbids.

## R9. The overflow menu: platform choice

The requirements are: close on Escape and on an outside tap, return focus to the trigger, arrow-key navigation, at most one open, wholly on
screen, and, from *Owed to a real phone*, an outside tap must not also act on what was under it.

| Option | Outside tap acts on what is under it? | One open at a time | Focus return | Verdict |
|---|---|---|---|---|
| `popover="auto"` | **Yes**. Light dismiss lets the click through. | yes | partly | rejected |
| A hand-made div with a document `pointerdown` listener | Yes, unless a full-screen scrim is added | by hand | by hand | rejected |
| **Modal `<dialog>` (`showModal`)** | **No**. The rest of the page is inert, and the backdrop takes the tap. | **by construction** | yes, and also restored explicitly | **chosen** |

**Decision**: `OverflowMenu`, a new primitive in `src/components/ui/OverflowMenu.tsx`.

- **The trigger** is a `button` with `aria-haspopup="menu"`, `aria-expanded` and an `aria-label` naming the part.
- **Opening** calls `showModal()` on a `dialog` holding a `div role="menu"` of `role="menuitem"` controls. Focus goes to the first item.
- **Keys**: ArrowDown and ArrowUp move with wrap-around, and Home and End jump. Tab and Shift+Tab close the menu and return focus to the
  trigger.
- **Escape** (the dialog's `cancel`), **a backdrop tap** and **an item running** all close it. After Escape or a backdrop tap,
  `trigger.focus()` is called explicitly, rather than trusting the browser's restore.
- **The press guard** is the same as `Sheet`'s: a click whose press did not begin inside the dialog is swallowed. So the release of the press
  that opened the menu can never land on Delete.
- **Position** is `position: fixed`, from the trigger's rect at open. The menu sits below the trigger, right-aligned to it. It flips above when
  it would cross the lower limit. The lower limit is the smaller of `innerHeight` and the top of `[data-testid="song-actions"]` when that bar
  is showing. Horizontally it is clamped 8px inside the viewport. The dialog is in the top layer, so nothing paints over it, and the
  clearance keeps it off the bar as well (FR-017).
- **Print**: the trigger is `no-print`, and the dialog is closed and `no-print`.

`Sheet` stays as it is. The menu shares its idea (native dialog, press guard), not its code, because a sheet is bottom-anchored and full
width.

**Alternatives considered**: putting the actions in the existing `Sheet`. It is heavy for three items, and a bottom sheet is not a menu to a
screen reader.

## R10. Status row separation within its width (measured)

From spec 007 R19, measured at 11.2px (0.7rem), 351px usable at 375. The jump buttons take 88 and the gaps 24.

| Case | Words | Symbol (10 chars) | Total | Spare |
|---|---|---|---|---|
| `stacking onto the marked column` | 166.2 | 67.2 | 345.4 | **5.6** |
| `adding after the marked column` | 159.6 | 67.2 | 338.8 | 12.2 |
| Triplet refusal | 197.2 | 67.2 | 376.4 | −25.4 |

New measurements: JetBrains Mono is width-stable across weights. `Dsus4` is 33.6px at 400 and at 600, and `F#m7b5/C#` is 60.5 at both. So
setting the symbol in **semibold costs 0px**.

**Decision**:

- **Separators** are 1px rules, `w-px h-3 bg-text-faint`, `aria-hidden`.
- **The row gap** goes from `gap-1` (4px) to `gap-0.5` (2px). The tones get `ml-0.5`, so symbol to tones is still 4px.
- **The tightest case** has position, separator, symbol, tones, separator, duration, separator, start and end. That is 18px of gaps plus 3px
  of rules, **21px**, against today's 24. Separation therefore costs **−3px** there, inside the 5.6 spare.
- **Ownership of the separators**:
  - The separator before the chord belongs to the symbol, which never shrinks.
  - The separator before the duration sits *inside* the duration's truncating box. When the duration gives way entirely, the separator is
    clipped with it, and two rules are never left side by side.
  - The separator before the jump buttons belongs to the button group, which never shrinks.
- **Weight**: the symbol is semibold, and the tones and duration are regular. The position words keep today's colour and weight.
- **Screen readers**: an `sr-only` " chord:" follows the symbol. The visible tones are `aria-hidden`, beside an `sr-only` "D, G, A". An
  unreadable symbol and `— not a chord I know` stay in one segment.
- **Giving way**: tones first (`min-w-0 truncate`, as today), then the duration (`min-w-0 truncate`, as today). A giving-way segment shows its
  ellipsis while it has the room for one. Below that it is clipped to nothing (Deviation 4).

The refusal case cannot fit a 10-character symbol, and could not before this entry. Spec 007's Deviation 3 stands: the refusal is whole, and
the symbol is cut (Deviation 3).

**Alternatives considered**:
- A middle dot `·` (6.7px in mono, about 3px in sans) with today's gaps. That costs +9 to +12px and overruns the 5.6 spare.
- Spatial separation (`ml-auto` on the jump group). It vanishes in exactly the tight case.

## R11. Song counts for the band list

`listSongs(bandId)` filters tombstones with `live()` (`src/lib/local/queries.ts:53`). Counting per band with N live queries is wasteful.

**Decision**: one new query, `songCountsByBand()`, in `queries.ts`. It reads `songs` once, keeps `isLive` rows, and counts them by `bandId`.
A hook, `useSongCounts()`, goes in `hooks.ts`. Both files change only by addition. The fence script checks that they have no removed line,
and that every other file in `src/lib/local/` has zero diff. The words come from `songCountWords(n)` in `src/lib/words.ts`: `No songs yet`,
`1 song`, `N songs`. The list makes no request, because `useLiveQuery` reads IndexedDB.

**Alternatives considered**:
- `listSongs` per band, as N live queries.
- "Last edited", which the spec rejected.

## R12. The part card's face

**Decision**:

- **Label**: the part's label becomes a `Link` to the part in capture. It shows a `Pencil` glyph at 13px beside the letter, so the cue does
  not depend on hover. It is `min-h-(--control)` tall. Its accessible name is `Edit part A`, or `Edit part A, main riff`.
- **One URL**: both the label link and the menu's Edit item call one `partCaptureHref(songId, partId)`.
- **Unnamed part**: an unnamed part shows `Add a name` with a `Plus` glyph and a dashed underline (`underline decoration-dashed
  underline-offset-4`), in `text-text-dim`. A real name has no glyph and no underline. That gives two cues that are not colour (FR-019). Its
  accessible name is `Name part A`. `text-text-dim` was set to at least 4.5:1 on `bg-raised` in both themes by spec 007 (INV-018), and is
  re-measured by INV-016. A name of only whitespace is already stored as `null` (`name.trim() || null`).
- **The menu holds**: Edit (`Pencil`), `+ variant` (`GitBranch`, only on a part that is not a variant), a divider with `my-2` (8px each
  side), and Delete (`Trash2`, the word `Delete`, `text-danger`, accessible name `Delete part A`). The accessible names of `+ variant` and
  Delete are kept as they are, so a test reaching an item finds it by the same name once the menu is open.
- **Trigger**: `MoreHorizontal`, `min-h-(--control) min-w-(--control)`, `variant="ghost"`. Its accessible name is `Actions for part A`, or
  `Actions for part A, main riff`.

## R13. Next.js and dependencies

Nothing here touches a Next.js API beyond `Link`, which is already in use. Per `AGENTS.md`,
`node_modules/next/dist/docs/01-app/03-api-reference/02-components/link.md` was read. `href` and `replace` are as the codebase uses them, and
nothing is deprecated. `<dialog>` and `showModal` are the platform's. **No new dependency.** `lucide-react` already ships `MoreHorizontal`,
`Pencil`, `Plus`, `GitBranch` and `Trash2`.

## R14. Line endings

Spec 007's plan recorded `SongView.tsx`, `ui/index.tsx` and `notation.ts` as CRLF. In this working tree, every file this plan touches reads as
**LF**, and `core.autocrlf` is `false`. Checked: `SongView.tsx`, `ui/index.tsx`, `TopBar.tsx`, `CaptureScreen.tsx`, `TabStaff.tsx`,
`app/page.tsx`, `globals.css`, `queries.ts`, `hooks.ts`, spec 007's `spec.md` and `DECISIONS.md`. New files are LF. An edit keeps each file's
endings as found, so check for a carriage return before editing.

**Baseline** (unedited tree, 2026-11-12): `npm run typecheck` clean; `npm run lint` 0 errors, 9 warnings (pre-existing: react-hooks/exhaustive-deps in CaptureScreen.tsx, unused vars in review-tunings.test.ts and reader-vs-main.test.ts); `npm test` 146 files / 6139 tests pass.
