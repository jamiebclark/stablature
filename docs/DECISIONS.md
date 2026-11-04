# Decisions

A running log of calls made while you were away, with the reasoning, so you
can overturn any of them quickly. Newest first. Anything marked **worth your
eye** is either a judgement call I am least sure about or something with a
cost you should know about.

---

## 2026-11-03 — capture-expression roadmap, browser checks

Each entry gets a Chrome check after it merges, from a separate worktree. These
notes live on the local `verify-log` branch of that worktree (not pushed), so they
stay out of the runner's tree. Defects here are notes, not fixes.

### Entry 1: capture-control-surface (PR #1, `5986674`)

Checked at a true 375×667 viewport (an iframe, since this Chrome window will not
shrink), dark and light, on a five-string part with a chord and a triplet. Light
was the `prefers-color-scheme: light` tokens copied onto the root, not a real OS
theme. Dev server, on a separate origin, so your data was not touched.

Holds: strip reads as part of the neck; unarmed chip separated by its border in
both themes; armed chip is a solid accent bar; arming moves no control; sheet
readable with visible separators; chord edit through the sheet works and the field
keeps its text; no page scroll; all five strings shown. The sheet stayed open after
a simulated long press followed by the finger-lift click, which was review F2.

**Worth your eye:**

- **Long press on a real phone is unconfirmed.** Touch was simulated here and in
  the review. Android Chrome and iOS Safari need trying by hand.
- **Chord label still clipped.** With a chord and a tuplet, cursor at the end, the
  label loses 7.2 px of its 17.6 px height at the top of the staff. `main` recorded
  7.4 px, so the "no worse than main" test passes, but F18's fix has not removed
  clipping in this state.
- **Status row wraps with a chord active and stack armed.** "stacking onto the
  marked column", "start" and "end" each break over two lines, and the chord tones
  truncate. Review F23 records `main` doing the same, so it is not new, but it is
  the wrapped-label look this file calls a layout bug. Entry 2's longer latch
  messages may make it more common.
- **No release from this merge, most likely.** The squash subject is the PR title,
  with no `feat:` type, so semantic-release should see nothing to release. Every
  roadmap entry will land the same way.

---

## 2026-11-02 — session with Jamie away

### Process

**Browser testing is now part of "done", not an afterthought.**
Three defects this session reached you despite a green suite, and all three
were rendering or wiring problems a test could not see: a selection band that
was invisible, a cursor highlight that buried the staff, and buttons wrapping
their labels. Playwright asserts structure; it does not have an opinion about
whether something is legible. Every visual change from here gets looked at in
Chrome at actual size.

**Verifying a colour through a magnified crop is not verifying it.**
I confirmed the selection band by zooming into a 400×120 region, which
flatters a subtle tint into looking obvious. Screenshots for colour and
contrast decisions are taken at actual size now.

**Two stale-artifact traps bit this session; both are now closed.**

- The long-running dev server served a CSS chunk that predated a whole
  feature. Source and clean build were both correct. If styling ever looks
  impossible, kill the dev server and `rm -rf .next` before debugging
  anything else.
- Playwright was reusing an orphaned `next start` left behind by an
  interrupted run, so the suite was testing a build from before the changes —
  a renamed button passed its own test. `reuseExistingServer` is now `false`.
  Costs ~20s a run; worth it.

---

### Fixed

**Light mode: the fretboard was unusable.** Worth your eye — this one was a
genuine defect, not a polish item, and nobody had ever looked at the light
theme. The cell tiers were `bg-raised` at 25% and 60% opacity. On near-black
that gives three readable steps; on near-white `bg-raised` *is* white, so the
tiers collapsed into the background and the fret numbers went with them. The
primary input surface effectively disappeared if your phone was in light mode.

Tiers are now explicit colour tokens per theme (`--fret-cell`,
`--fret-cell-inlay`, `--fret-number`) rather than opacity over a surface.
Checked in both themes at actual size.

The lesson generalises: opacity over a surface token is only safe when the
surface is dark. Anywhere else, name the colour.

---

### Merged: chord-tone highlighting (another Claude session)

**Worth your eye** — this is someone else's feature and I merged it on your
behalf. A second session built it in a worktree on `feat/chord-tones`: chord
symbols are parsed into notes, and the frets belonging to the chord in force
at the cursor light up on the neck. Roots in bold, the notes actually in the
current column still win. 26 new unit tests; the status bar now reads e.g.
`C · C E G`.

I reviewed it rather than taking their word, rebased it onto main, resolved
one conflict in the fretboard cell renderer, and verified it in a browser. It
is on main. Revert `6d62315..5982f0b` if you would rather it waited.

Two things I changed in the merge:

- Their background tiers used the opacity approach I had just removed for
  breaking the light theme, so the resolution kept their `tier`/`ink` split
  but on the per-theme tokens.
- **The feature silently did not work after merging**, and the measurements
  caught it where eyes would not have: the chord-tone colour was rendering at
  the resting grey. `.fret-cell { color }` was beating `text-accent`.

  The cause is worth remembering. Lightning CSS flattens `@layer components`
  into plain rules and hoists the layer declaration to the top, so custom
  classes land *after* the utilities in source order and win every specificity
  tie. Wrapping rules in a layer buys nothing here. The fretboard has no
  classes of its own now — the tokens are exposed as Tailwind colours and the
  component emits exactly one background utility and one text utility per
  cell. Nothing to override, nothing to order.

### `npm run dev:clean`

Turbopack's CSS cache went stale on the long-running dev server three separate
times today, each time silently: source right, production build right, browser
serving an older chunk. It is what made the selection highlight look invisible
to you. Added a `dev:clean` script that clears `.next` first, and documented it
in the README as the first thing to try when a style change appears to do
nothing.

---

### Design

**Favicon — the app was still shipping Next's default.** `src/app/favicon.ico`
was the 15KB scaffold file, so every browser tab showed the Next.js logo.
Replaced with the staff mark at 16/32/48 (469 bytes), generated by the same
script as the app icons. At 16px the five-string staff turns to mush, so the
small sizes drop to three strings and one note.

Next decodes `app/favicon.ico` at build time and its ICO reader rejects an
embedded PNG that is not RGBA — my first attempt broke the build outright with
"The PNG is not in RGBA format!". The generator writes RGBA now.

**Tab font: Geist Mono → JetBrains Mono.** Measured, not picked. At the 11px
the staff actually renders at, JetBrains Mono has a visibly larger x-height
than Geist Mono, IBM Plex Mono or Roboto Mono — and all four turn out to share
an identical 0.6em advance, so the digits get easier to read at zero cost in
columns per screen. Columns per screen being the whole point of this app, that
made it a free win rather than a trade.

**No third font.** Geist Sans stays for the interface. Nothing about a band
tool is improved by a more opinionated UI face, and a third family is weight
an offline PWA carries for no return. The wordmark is monospace, which ties it
to the content rather than to a logo typeface.

**Logo:** three strings and a note — the icon, simplified. Five lines close
into a grey block at header size. Deliberately not a guitar, a pick or a
quaver: the app is about tablature, and a staff with something on it is what
tablature looks like from across a room.

**Homepage:** the explanation now lives in the empty state and disappears
once you have a band. Someone opening it for the first time has no idea what
it is; someone opening it for the hundredth wants their bands and nothing
else.

### Paperwork

Added `/privacy`, `/terms` and `SECURITY.md`, linked from a footer and from
the sign-up form, which is the actual consent point. Written specifically for
this app rather than from a template — most of what a privacy policy usually
discloses genuinely does not apply, since there are no third parties, no
analytics and no advertising.

Two things I made a point of disclosing because nobody would guess them:

- **Deletes are soft.** Tombstoned rows stay in the database until purged.
  That is what makes offline merging work, and it is dishonest to call it
  deletion without saying so.
- **A full copy lives in the browser.** Which is also the reassuring half: if
  you never sign in, nothing leaves the device.

I am not a lawyer and this is not legal advice. For a band tool on your own
box it is proportionate; if you ever host it for strangers, have someone
qualified read it.

### ~~Needs you~~ RESOLVED: MIT (Jamie chose, 2 Nov)

**Settled.** `LICENSE` added, `package.json` says MIT, README links it.
The copyright line reads `jamiebclark` — the GitHub identity, since the only
other names available were "Jamie" and the machine's git label "Jamie
 Desktop". Say the word if you want your full legal name there instead; it is
a one-line change and worth getting right while the project is young.

The reasoning that was waiting on you is kept below for the record.

`gh repo view` reports the repo is **public**, and it has no `LICENSE`. The
default in that situation is *all rights reserved*: legally nobody may use,
copy or modify it, which is often not what someone publishing code intends.

I did not pick a licence because it is a grant to the public that cannot be
withdrawn from a commit once pushed, and it is a decision about your property
rather than a technical one. Options, briefly:

- **MIT** — do anything, keep the notice. The usual default.
- **AGPL-3.0** — anyone running a modified copy as a service must publish
  their changes. Fits self-hosted software if that matters to you.
- **No licence, make the repo private** — if it was only public by accident.
- **No licence, stay public** — fine as a deliberate choice; people can read
  it and legally not much else.

Say which and I will add it. I also checked the history for leaked secrets
given it is public: `.env` and `.env.local` were never committed, and the only
matches are placeholder variable references in the compose file. Clean.

---

### Merged: chord tones carried by weight, not colour

The other session found a real gap in my own fix, and I verified their numbers
from the committed tokens rather than taking them:

```
            chord tone      non-chord
dark        9.47 / 8.66     3.79 / 3.46
light       5.02 / 4.15     5.28 / 4.36
```

In the light theme the non-chord grey is *more* contrasty than a chord tone —
separation of −0.26. Both are legible, but "is this note in the chord" was
resting entirely on hue at matched lightness, which is the first thing to go
in glare, on a stage, or for a colour-blind reader.

Every chord tone is now semibold, with the root and a slash bass bold. Weight
reads identically in both themes and needs no colour at all.

The test that comes with it is the better half. Asserting roles and
aria-labels is exactly what let the original bug through — those were all
correct while the colour was gone, so the chord tests passed against a blank
neck. The new one reads computed font-weight off the cells, and they confirmed
it fails without the fix.

---

### Verified, not assumed

The other session checked something about the font change that I had not, and
it is the kind of thing that hides well: computed `font-weight` reports 600
whether or not the family actually has a 600, so the chord-tone weight test
would stay green while the distinction visually collapsed. `next/font` emits
`font-weight: 100 800` for JetBrains Mono, so 400/600/700 are genuine
instances off the variable axis — no synthesis, no snapping. Worth knowing if
anyone ever pins a static weight.

They also traced the "zombie server on port 3100" to its real cause, which
was running `npm run build` twice while their own `next start` held the same
`.next`. Same corruption I hit earlier in the day. The port was never the
problem, and `reuseExistingServer: false` does fail loudly as intended.

---

### Terminology: "chord" was doing two jobs

You spotted this and you were right. Two buttons were fighting over one word:
`stack` built an actual chord out of notes, while `chord` wrote the harmony
label above the staff. The one called "chord" was the one that did not make a
chord.

The annotation button is **chord symbol** now, and both tooltips say plainly
which is which. `stack` stays — it is a verb for what it does, and the tooltip
says "so they sound together as a chord".

One correction to the framing in your question: a chord symbol is not a key
change. `Am → C` inside a song is a chord change; a key change is a
modulation, and the app does not model keys at all. The original brief asked
for "chord changes above the tabs", which is exactly what this is.

### A test that was passing for the wrong reason

The new chord-weight test failed on desktop and passed on mobile, which looked
like a rendering difference and was not. It read the root cell's computed
weight immediately after clicking Set — before the chord annotation had
travelled Dexie → liveQuery → render — so the first cell read came back at the
pre-chord weight and a cell read a moment later came back correct. Exactly the
shape of a broken root style.

It now waits for `data-chord-role` to appear before measuring. Mobile had only
ever passed on timing luck.

### Machine housekeeping

Mid-afternoon everything started failing with `fork: Resource temporarily
unavailable`. The machine had 602 MB free and its commit limit was exhausted.
155 node processes were running, and the biggest by far was **not this
project** — an AdonisJS `bin/test.ts functional` run holding over 20 GB, plus
Nuxt dev servers for vr-ui-system, vr-campaign and vr-roadmap and a Next
server for crimeball.

I killed only the five stablature processes (leaked `next dev` and `next start`
instances of my own) and left everything of yours alone. That recovered free
memory from 602 MB to 72 GB, so the leak was at least partly mine. The Adonis
process may still be worth a look.

Related: do not run `npm run build` or the e2e suite while a dev server is up
on the same checkout. They share `.next` and corrupt each other — it produced
a fake test failure for the other session and a spawn failure for me.

### Generalised grouping (spec 003)

Events gain an optional `groupKind` (absent = ratio-derived tuplet, `plain` = a bracketed run with no ratio). Plain groups let any run be bracketed and numbered without implying a tuplet; the triplet button is unchanged and refuses runs that already carry a ratio. The toolbar's grouping controls moved to row 2 (Deviation 1 in plan.md) so seven controls fit one line.

- [ ] Person-level pass (real browser, both themes, actual size): quickstart §6 and the Postgres-backed sync scenarios are still owed.

---

_Entries below are added as the day goes._

### Usability pass: re-pinned e2e (spec 007, FR-065)

Each assertion below pinned a size the usability pass changed on purpose. None was weakened to hide a regression; the new value is what the contract names.

- `grouping-band.spec.ts`: selection controls `≤ 36.5` → `≤ 44.5` (all controls are `--control`, 44px). The barline-tap band test was **re-read, not re-pinned**: the band is now `flex-col-reverse`, and six strings fit at 667, so it now runs at 375×553 where the band still overflows and the swipe moves it.
- `capture-surface.spec.ts` chord form open + tuplet: band overflow `≤ 0` → `≤ 8`. Rows are 44px; the band scrolls under the one overflow rule rather than clipping. Strings-clipped bound unchanged.
- `rhythm-capture-height.spec.ts`: header `37` → `45` (the merged title row).
- `techniques-layout.spec.ts`: strip `38.8` → `39`, chip `30.8` → `31` (rounding to the new tokens).
- `grouping-queued-row.spec.ts`: `all synced` no longer renders, so the two waits became "no `N unsynced` text"; the Postgres poll is still the real check.
- `click-running.spec.ts` and `click-every-ending.spec.ts`: each now calls `openCluster(page)` before reaching the click cluster's controls (the Capture link, the tempo and click buttons). The cluster is collapsed behind `panel-play-cluster` on a phone, so the control is not in the page until the button is pressed; the assertions on what the click does when running or ending are unchanged.

### Usability pass: floors and reach (spec 007, US2)

- **`* { min-width: 0 }` moved into `@layer base`.** Unlayered, it beat every `min-w-*` utility, so no minimum width in the app ever applied (the capture back button computed to 0px). Now a `min-w-*` utility wins and the reset still applies elsewhere. Checked by the full mobile e2e run.
- **Floor walker (`INV-006`) reads "44 wide or as wide as its label" as: a control with text may be as wide as its label but never under 24px; an icon-only control meets the width.** Sentence links are the named list in `usability-helpers.ts`; the list was corrected to the real link texts ("Create one", "what is stored", "the terms", "Sign in", "privacy").
- **`INV-008` counts neighbours in the same row only.** Toolbar rows are 46px around 44px controls, so a control in the next row is 2px away by design and is not a mis-tap neighbour.
- **Paste box on touch:** the status line moves above the box. On focus the status scrolls to the top and the panel gains `--kb-inset` bottom padding, so there is room to scroll it clear of the keyboard.
- **`INV-013` ignores controls inside a scroller** (the neck, the staff): the scroller's edge cuts them, and the scroller is inside the insets. `PageHeader`'s back link lost its `-ml-2`, which put it 1px into the landscape inset.
- **Accepted:** none. Every walker finding was fixed.

### Usability pass: reading the staff (spec 007, US3)

- **Chord symbols are never truncated; a column widens instead.** Width is `calc(<w>ch + var(--col-pad) + max(0px, <chars> * var(--chord-ch) + var(--chord-gap) - room))`, where `room` is what the symbol owns (`chordRooms` in `src/lib/reading/staff.ts`). Only the screen widens; `layoutPart` and the export are untouched (`INV-015`).
- **Numerals, rhythm marks and bar numbers are 12px.** The bracket hook is 0.2rem (was 0.3rem), so on the touch row (0.95rem) the 12px numeral ends exactly at the line's top. `--text-dim` replaces `--text-faint` for the bracket and numeral.
- **`barNumbers` is wired on the song page only so far**; the play view takes it with the wrapped staff (T080/T081). `wrap` is accepted but draws nothing different until T080.
- **Baseline:** only `markup:*` entries of `baseline.json` were re-recorded (`RECORD_MARKUP=1 npx vitest run .../frets-unchanged.test.ts`); layout, ASCII, description and songText entries did not move.
- **Specs moved:** `techniques-surfaces.spec.ts` INV-003 measured column padding as a literal `0.6rem`; it now reads `--col-pad`. No other old spec needed a size changed.
- **`INV-018` waits for transitions:** it polls, since a button's colour transition otherwise reads mid-fade.

### Usability pass: reaching the tab (spec 007, US4)

- **Panels:** `Panel` (song-tools, song-arrange) and the click cluster's own button (`panel-play-cluster`, in `ClickBar`) carry the test id on the button itself, which has `aria-expanded`. `openTools`/`openCluster`/`openArrange` in `usability-helpers.ts` click it only when collapsed, and wait up to 3s for it to exist.
- **Song page height:** `PageHeader` `mb-5` → `mb-3`, song `main` `pt-3`, the arrangement heading `mb-1` and the tools row `mb-2`, so the first staff is at y ≤ 520 at 375×667 with both panels shut (SC-010).
- **Part card shows `{bpm} bpm` for now** (`part-heading`); it becomes `partHeading` text with T062.
- **Old specs moved (T061):** `click-bar-at-size`, `click-bar-fit`, `click-layout` (a fine pointer reads the 32px toolbar floor, touch stays 44; the follow chip sits in the open cluster, so `openCluster` first; the fit check's "touches" test only compares controls on the same row), `tempo-sheet-and-tempo` (`openTools` before the BPM field), `reading-helpers`, `reading-layout`, `reading-view`, `reading-sync`, `capture` (`openTools`/`openCluster`/`openArrange` after navigation). `songWorld` opens the arrange panel first.
- **T061 finished:** `reading-helpers.columnTexts` and the in-page digit watchers in `reading-view` drop the bar-number label (a label above a column, not its content); `choose` opens the cluster on the play view; `reading-view`, `reading-sync` and `sync` call `openTools`/`openCluster` before reaching the control or BPM; `reading-view` uses `a[href$="/play"]:visible` (the header link is absent on touch); `reading-layout` INV-014 finds the carried chord by `.text-accent` (the row no longer truncates) and INV-036 ignores `data-column` ids and bar-number digits (they differ by pass). Product fix: the play view shows `ViewControl` only when the song has an arrangement (INV-007).
- **US7 (reader):** `parse.ts` gains `joinedByQuality` (one line in `readsAsProse`), the `chords-joined` code and `looksJoined`, mapped in `failed`. Spec 004's probes still fail only the 19 recorded; F75 "apart from a staff" is 39 of 202 (was 43). `spec004-holds.test.ts` is timing-sensitive, so it runs as `npm run test:spec004`, not in `npm test` (it flaked other tests under load and the pre-commit hook). `e2e/import-flow` calls `openTools` before the density buttons (they moved into the tools panel, T044). The INV-028 mutation (accept `A7-D7` in `joinedByQuality`) is caught by `spec004-holds`, not by `paste-joined-chords`: those lines stay refused through another path.

### Usability pass: amendments to earlier specs (spec 007, FR-064, FR-065)

Each earlier requirement below carries an `Amended by spec 007` note on its own line; `npm run check:usability-amendments` pins that.

| Spec | Requirement | Before | After |
|---|---|---|---|
| 003 | FR-020, SC-009, plan INV-013 | Six strings: at most one string out of view, swipe to reach | Four, five and six strings stay in view with a chord row and a bracket row; swipe is for seven strings or a shorter screen (FR-020 reworded exactly as 007 FR-064) |
| 001 | FR-026 | Rows listed as header, chips, staff, status, chord form, controls, latch strip, neck | Same rows, grouped; toolbars 10 to 19px closer to the neck; still no page scroll |
| 002 | SC-006 | "toolbar position unchanged" | Rows move up 10 to 19px and grow to the touch floor; chips still one line |
| 004 | contracts/reader.md, INV-010 | Ordinary-line cost 43 of 202 | 39 of 202; hyphen-joined chords are refused as `chords-joined` |
| 005 | FR-013 to FR-015, FR-026 | Marks 10.4px left of their notes; click bar always open | Marks 12px under their notes; bar is a cluster behind one 44px button |
| 006 | FR-001 | View control always visible | In the tools panel (song page) and the cluster (play view, only when the song has an arrangement) |

Deviations 1 to 19 of the plan that change an earlier decision are those above plus: light `--accent` `#b45309` → `#a74d08` (1); `PageHeader` one row everywhere (5); section name in the pass's head row (8); paste status above the box (10); `Tuning` in the tools panel (19); the hint `tap a column to insert after it` removed (15); a hidden scrollbar on a bar wider than a line (7).

Pinned tests that moved with these (none deleted, none weakened): `baseline.json` (markup entries only), `capture-surface.spec.ts`, `rhythm-capture-height.spec.ts`, `techniques-layout.spec.ts`, `grouping-band.spec.ts`, `grouping-layout.spec.ts`, `grouping-controls.spec.ts`, `grouping-queued-row.spec.ts`, `click-bar-at-size.spec.ts`, `click-bar-fit.spec.ts`, `click-layout.spec.ts`, `click-bar.test.tsx`, `reading-view.spec.ts`, `reading-layout.spec.ts`, `reading-sync.spec.ts`, `reading-helpers.ts`, `variant-marks.spec.ts`, `tempo-sheet-and-tempo.spec.ts`, `rhythm-marks.spec.ts`, `rhythm-unknown-values.spec.ts`, `capture.spec.ts`, `sync.spec.ts`, `techniques-surfaces.spec.ts`, `grouping-surfaces.spec.ts`, `TabStaff.test.tsx`. Where one has not needed an edit, it is named here because the plan expected it might.

Audit, before and after (375×667, production build): targets under 24px went from 7 on the song page to 0 and chord labels are no longer cut. Full figures: `specs/007-usability-pass/audit/before.txt`, `after.txt`, `outcomes.md`.

### Usability pass: guards that fail by design (Deviation 12)

`check:untouched`, `check:untouched-rhythm` and `check:untouched-reading` (guards for specs 004 to 006) report CHANGED on this branch because they name files this entry changes on purpose. None runs in CI. `check:untouched-usability` is the guard for this entry and is clean; its parse.ts check now treats a doc comment as belonging to the declaration it precedes.

## 007 T118 — neck baseline height gets a fine-pointer figure

`e2e/capture-surface.spec.ts` INV-011 failed on the desktop project by 23.98px. Cause: FR-023's fine-pointer frets (`--fret: 2rem`, 32px against 36px), six strings, 24px shorter. Not a layout defect. Before: one baseline, `NECK_HEIGHT_BASELINE_PX` = 238.390625. After: that figure stays for the coarse pointer (touch sizing unchanged); a fine pointer has `NECK_HEIGHT_BASELINE_FINE_PX` = 214.40625, picked by `(pointer: fine)`.

## 007 T119 — inspector parity spec opens the tools panel before Download

"inspector parity with the toolbar" (x6, desktop) timed out finding the Download button. The product is right: spec 007 moved export into the song page's tools panel. The spec's own `exportText` (a copy of the helper) did not call `openTools`. Added the call; all 42 runs pass on both projects. No product change.

## 007 T120 — wrapped play view: one product fix, two stale expectations

`e2e/reading-layout.spec.ts` INV-016 (play view frets, pass 1) and INV-017 failed on the play view, which wraps its staves (007).
- **Product fix:** the wrapped staff was `position: relative`, so its caption anchored to the staff and sat 12px over the last line. A new `.tab-wrapped-body` carries the positioning and the gutter; the caption now anchors to the card, as it does unwrapped.
- **Stale, amended:** INV-016's "gap between" and "row level" checks assumed one line. They now apply per line (a new line is a jump of more than 8px, or a part that starts below the last). INV-017's "card height holds across views" now covers the song page only: on a wrapped staff, notes and intervals cells are wider than frets and can need another line (play #0 at 375px: 248.7px in frets, 425.5px in notes). Holding height there would mean padding every column to the widest view, which costs the density FR-023 asks for.

## 007 T121 — a double tap on Set no longer reaches the screen behind the sheet

The second tap of a double tap on Set, 40 to 160ms after the first, landed after the sheet had closed and added a column. Fixed in `TempoControl.tsx`: when Set closes the sheet, presses are eaten at the window for 300ms (`shieldPresses`), except on the tempo control and inside a sheet, so reopening the sheet is never refused. The test is unchanged. The sheet component itself is untouched, so no other sheet gains the delay.

## 007 T183 — `--chord-ch` is 7px, not 0.6em

CI failed 14 e2e tests (chords touching, gap under 2px) on both projects. Before: `--chord-ch: 0.42rem` (6.72px). Linux Chrome at device scale 1 rounds glyph advances to whole pixels, so each of 32 characters was 7px: 224 against 32 × 6.72 + 4 = 219.04, a shortfall of 4.96px. Windows positions glyphs at subpixel precision, so it passed locally. After: `--chord-ch: 0.4375rem` (7px) in `src/app/globals.css`. The tests are unchanged.
