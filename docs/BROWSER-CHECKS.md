
# Browser checks

After each roadmap entry merged, the supervisor checked it in a browser from a separate worktree and noted what it saw here. Findings
are notes, not fixes. These were kept on a side branch while the roadmaps ran, so the runner's tree stayed clean, and are merged here
as one log, oldest first.

## 2026-11-03 — capture-expression roadmap, browser checks

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
- **No release came from this merge.** The squash subject took the PR title, with no
  `feat:` type, so semantic-release had nothing to publish. This happened because my
  extra roadmap commit made it a two-commit PR. A single-commit PR keeps its
  `feat(...)` subject, as PR #2 did, so entry 1 reaches the changelog only if a later
  release picks it up by hand.

### Entry 2: playing-techniques (PR #2, `421b130`)

Same setup, on a five-string part with all four connectors and all six decorations:
`5 h 7 p 5 / 9 \ 5 7~ <7> (7) 7b t7 7m`. T048 is still unticked on `main`, because
its last item needs a real phone.

Holds, in dark and light: all four connectors can be told apart and `/` and `\` stay
crisp; `t7` reads differently from `5h7`; all five chips sit on one line and are
legible lit and unlit; toggles read on and off by fill, not hue; connectors stay
legible inside a selection and on the song page's raised surface. Each decoration
landed alone, so no toggle flipped on a simulated finger lift.

**Worth your eye:**

- **Hold a column and lift, on a real phone.** The last item of T048. Only simulated
  here.
- **A selection hides the top string.** With a selection up, G is out of view and four
  of five strings show. F18 measured `main` hiding one too, so this is not new.
- **Chord symbols truncate on narrow columns.** "Em7" reads "Em…" on capture and "E…"
  on the song page, which hides the chord. The `truncate` class is on `main` from
  before this roadmap, so it is not new, but later entries add no fix for it.

---

### Entry 3: generalised-grouping (PR #3, `eaa56ba`)

Checked at a true 375×667 viewport, dark and light (same iframe and token copy as
above), on a new six-string part of 23 columns. Touch is simulated, so this proves
appearance, not how it feels under a thumb.

Holds: any-size bracket from a six-column selection, with the selection ended and
the cursor unmoved; plain bracket; plain to numbered on the same columns; a selection
across a barline drops the numbered control and makes one bracket per bar; `ungroup`
from two columns removes the whole bracket; the sheet reads `tuplet of 6` and its
`ungroup` closes it; the triplet button makes no bracket from two notes, shows
`a triplet needs three columns in one bar`, and the message clears on the next tap;
16 offers a numbered control and 17 does not. Plain brackets show on capture, the
song page in both densities and the play view, and over a selected column. The empty
bracket reads as a bracket. All seven controls fit on one line, unwrapped.

Not checked: the `,-----,` export by eye (unit tests cover it); the control's digits
at 3 and 16 by eye (seen at 2, 4, 6, 8 and 10; 16 confirmed by its label only); whether
copy, cut and delete feel right, and thumb comfort, which need a real phone. T056,
the Postgres sync item, was run by the review, not by me.

**Worth your eye:**

- **Bracket numerals are faint.** 10.4px text at about 3.4:1 in light (`#8a8a94` on
  white) and roughly 3.5:1 in dark, under the 4.5:1 AA needs for text this size. They
  are legible but they are the weakest thing on the staff, and the number is the whole
  point of a tuplet. Added to entry 7.
- **A new bracket can land out of sight on six strings.** At rest the band shows the
  low strings, so making a group gives no visible result until you swipe up. Confirmed
  on the real flow. Already in entry 7.
- **The two bracket controls are 28px wide.** Above the 24px floor, well under 44px, and
  they sit side by side. Added to entry 7.

### Calls made while you were away (2026-11-04)

- **Six strings at 375×667: reachable by swipe.** You chose this; FR-020, SC-009 and
  INV-013 were amended in `specs/003`.
- **T021 and T023 narrowed, T057 and T058 added.** **Worth your eye.** Implement stalled
  on two broad tasks, so I cut each to what was done and moved the rest to new tasks.
  Nothing was dropped.
- **Entry 7, `usability-pass`, added after `reading-aids`.** **Worth your eye.** You
  asked for it; the contents are my reading. It audits every screen first, recovers
  height on capture, sets density by pointer rather than width, and closes the defects
  logged here. From Songsterr it takes ideas only: a collapsible control cluster,
  desktop keyboard shortcuts, bar numbers and section labels, a reading cursor, and
  width-filling tab in the play view. I saw Songsterr on desktop only, not its phone
  layout. The capture toolbars stay as a judgement call for that spec, because capture
  speed depends on one-tap controls.

### Entry 4: ascii-import, line classification (2026-11-04)

**Worth your eye.** Five reviews each found a blocker in how the parser tells a tab row
from commentary (13, 6, 3, 5, then 1 finding). I had planned to refuse any block the
parser could not place with certainty. I dropped that: refusing every line touching a
staff would refuse the lyric line between systems, which Story 2 scenarios 5 and 7
require. I took review F61's choice instead (T082): a line holding both a note and a
rail or pipe counts as a row. The cost is that lines like `-- Verse 2 --` move from
listed to refused, which is safe and cheap to overturn.

Still read as commentary on purpose (F62): `5 7 5 7`, `(5) (7)` and `5-sl-7`. They are
the declared edge of the rule. Reopen them on a real paste, not a wider sweep.

**Worth your eye, added after round 9.** Each round has moved the parser toward refusing,
and that has a cost in real pastes. Of 202 ordinary lines from tab headers, chord charts
and footers, each standing alone, 42 now refuse the whole paste until deleted (review F75,
rated MINOR): `Am7-D7`, `(c) 1999-2004`, `m.1-4`, `1-2-3-4-`. Each names its line, costs
one tap to delete, and none is read as notes. Hyphen-joined chord lists are the likeliest
to appear and the cheapest to narrow. Try a real web tab before judging this one.

### Entry 4: ascii-import, browser check (PR #4)

Checked at a true 375×667 viewport, dark and light (same iframe and token copy), on a
six-string song and a new empty song. Pasting was simulated by setting the box's value,
so a real paste gesture is still owed (quickstart §7), as is the 30-second phone timing
(SC-005) and the box with the phone keyboard up.

Holds: **Paste tab** and **+ part** share one line; the empty song's two buttons sit
together; 16px text in the box, so no iOS focus zoom from it; a 200-character line stays
inside its box and refusal with no sideways page scroll; refusals show line number, text
and reason legibly; the preview scrolls inside itself; the ignored list reads well in
light (`#5c5c66`, 14px). A two-system, eight-bar paste with commentary read as 8 bars, 40
columns with three ignored lines listed; a real import added part C and closed the box.

**Worth your eye:**

- **`|-` draws as one `⊢` glyph.** JetBrains Mono's ligatures are on (`font-variant-ligatures:
  normal`), so in the paste box and refusal lines, tab text is not shown as typed. Here that
  misleads: the whole point of those views is to show the characters. Added to entry 7.
- **A chord line refuses with the wrong reason.** `Am7-D7` above a staff says "This
  character is not part of the tab notation", which does not tell you it took a chord list
  for a tab row. This is the false refusal noted above, seen on a real shape. Added to entry 7.
- An empty song shows **Paste tab** twice, once in the header and once in the panel. Harmless.

### Entry 5: rhythm-and-tempo, browser check (PR #5)

Checked at a true 375×667 viewport, dark and light, plus a greyscale filter on light, on
a six-string part with all six durations set and 96 bpm. Touch is simulated, and nothing
here proves timing or sound; I could not listen to the click.

Holds: the capture header's tempo control is findable (`no tempo`, then the value); the
tempo sheet shows its reading large, and real clicks gave a clear out-of-range message;
all six duration positions fit on one line at 54×44 each; the rhythm row reads on the
play view in both themes and in greyscale, so nothing depends on colour; the click bar sits
below the tab rather than on it, and its controls are 44px high; Start gives Stop, a
beat dot and a silent-switch hint; Stop returns to Start. No sideways page scroll.

Not checked: a long title against the tempo control, the lit position in the inspector,
accent and soft beats told apart (I only saw the plain beat), the song-page rhythm row, and
a tempo read from real taps. Simulated taps did not register on the pad.

**Worth your eye:**

- **Rhythm marks sit left of their notes.** Measured text centres: marks at 55, 72, 91, 109,
  138, 165 against notes at 60, 79, 97, 119, 146, 173, so 5 to 10px left in 18 to 27px
  columns. The cells line up; the text in them does not. In a dense part a mark could read
  as belonging to the column before. Added to entry 7.
- **The marks are small:** 10.4px, the same size as the bracket numerals.

**Owed to a real phone:** click audible over a played bass; silent switch; airplane mode from
the home screen; screen stays on for five minutes; lock and incoming call stop it cleanly;
fast tapping neither zooms nor drops taps.

**Flaky test on main.** `review-redraw-ledger.test.ts` (from entry 4) runs at the default 5s
timeout. It passes alone, 26 of 26 in about 14s, but "row 1" timed out twice in the
pre-commit run while the runner was busy, blocking a docs commit. It is the same class as
entry 5's F17. Nothing is wrong with the parser. Added to entry 7.

### Entry 6: reading-aids, browser check (PR #6)

Checked at a true 375×667 viewport on the song page, in dark, and in light with a greyscale
filter, on a variant with one column removed, two added and a chord added. Play view
checked in dark and without a variant.

Holds: the control row fits with export, BPM, density and the view control; note names and
intervals were correct against the frets and against `Am` (`5`, `1`, `b3`, `b7`, `4`); with no
chord the intervals view shows note names and says so; marked columns read at a glance,
including in greyscale; the caption read `1 changed, 2 added, 1 removed`, which was right.
No sideways page scroll.

Not checked: variant marks on the play view (variants are not offered in the arrangement's
add buttons, so I could not put one there), the `·` mark, a print preview, the caption's
fit there, and a classic Windows scrollbar past the card's width.

**Worth your eye:**

- **The view control is 28px high**, like the density control beside it. Above the 24px floor,
  under 44px. Entry 7's audit should pick it up; it was not named in that entry.
- **Accidentals are all sharps**: `A#` and `D#` in a part with no chord or key. Correct, not
  always what a player would write.

### Entry 6: calls made while you were away (2026-11-05)

- **Timeouts in three test files, by hand.** **Worth your eye.** Entry 4's heavy sweeps ran on
  the default 5s and failed the commit hook while another project loaded the CPU. I added
  `vi.setConfig({ testTimeout: 120_000 })` to three files. No assertion moved. The review then
  caught that this broke entry 6's own guard, which it fixed in the plan and the guard.
- **Rebased PR #6 and force-pushed its branch.** The 1.9.0 release conflicted, and the branch had
  flipped `package.json` and `ci.yml` to CRLF. I kept the new scripts and main's line endings.
- **The 20ms budget stayed.** CI failed at 25.06ms and 23.39ms on a shared runner while the
  desktop passed. SC-009 says "on a desktop", so the check arguably measures the wrong machine,
  but I did not change a failing check. T073 sped up `compareVariants` instead, through
  implement and review, and CI passed. **Worth your eye:** the budget may flake on CI again;
  whether it belongs there is your call.
- **Set PR #6's title to `feat(...)`** so a two-commit squash still releases.

### Browser check: usability-pass (PR #7, `8de435d`)

Checked in Chrome from the verify worktree on a 375×667 same-origin iframe. The harness has a mouse pointer, so it shows the fine-pointer sizes. Touch sizes come from the e2e suite, not from this check.

**Works**

- Capture, six strings with a bracket, shows all six strings at 375×667 with no swipe, in both themes. The page does not scroll.
- Song page: tools and add-to-arrangement panels collapse and leave the parts in view.
- Play view wraps at 375 and at 1280, with bar numbers. No sideways page scroll.
- Highlight with the click following the notation: a solid 2px outlined column, clear in both themes, moves with the beat, stays above the control bar, and does not look like a selection. Tested with a real click after setting quarter notes on part B in the test origin's database.
- Selection row: copy, cut, delete and cancel all show.
- Help overlay lists only what works on the play view.

**Defects, for Jamie (not fixed)**

- The help overlay has no padding. `KeyboardHelp.tsx:55` lacks the `p-4` that `TempoSheet` has, because `Sheet` is `p-0`. The heading, keys and Close button sit against the sheet's edge at every width. One class.
- With four parts, the capture title gives way to `← …` at 375, so capture shows no song name. This follows from F28's fix, where the title yields first. Worth your eye: whether the name matters more than seeing a fourth chip.
- At 1280 on a short song, the play view's control bar sits directly under the card, mid-page. It is sticky, so it only reaches the bottom on a long song.
- A part whose notes lack durations gets no highlight and no way to find out why beyond `Click is a plain beat.` This is FR-053 as written.

**Calls made, worth your eye**

- `--chord-ch` is 7px, not 6.72px. Linux Chrome at 1× rounds glyph advances to whole pixels, which failed 14 CI tests. Not reproducible on Windows: the arithmetic matched CI's -4.96 and CI passed after the change. It costs 0.28px per character on columns a chord label widens.
- I split T072 and T106, cleared a stale block on T062, removed a false block on T181, and added T153 to T156, T173, T182 and T183 by hand.
- I ran T181's remaining slices myself outside the pipeline and ticked it, recording one failure not on its exception list. Review round 4 ruled it a test race in an untouched file (FU27).
- T121 was written so the double tap had to be fixed in the product, with its test left alone.

**Not checked**

Status row with stack armed, chord-tone contrast in the light theme, mouse density at 500×800, landscape capture, print preview, and sideways scrolling of a bar wider than a line on Windows. T114 stays owed for these. T108 to T113 are owed to a real phone. 33 non-gating follow-ups are in `specs/007-usability-pass/review.md`.


## Browser check: usability-polish (spec 008, #17), 2026-11-13

Screenshots of every screen on merged `main` (d9d2393) at 375x667, 412x915 and 1280x800, dark and light, plus the part menu open.
Taken with Playwright over `e2e/probe-screens.ts`, since the Chrome extension could not reach a local server this session. Noted, not fixed.

Held: the band list shows `1 song`, not the slug. Signed out, the top bar reads `Saved on this device` and the capture header `saved · sign in`.
The part card has one `…` menu, with Delete only inside it, and an `A ✎` label that edits. The status row is segmented. Both themes read.

1. **The empty band is still there for any part that fits on one line.** At 412x915 about a third of the screen sits blank above a
   three-bar part, and at 1280x800 about 270px. Wrapping fills the band only when there are earlier bars to show, and most riffs
   captured at practice are a few bars. This was the review's headline capture complaint. A candidate for a follow-up: let a short part
   use the height (a larger staff, or the part's other passes), within FR-002/FR-003.
2. **At 375 the chip strip shows `+` alone.** `saved · sign in` takes the room, so `+ part` is cut to its first glyph until swiped.
   It is reachable, which capture-matrix FR-001 checks, but it reads as a stray plus.
3. **The status separators are tight and one trails.** `adding at the end|Dsus4 D G A|whole note|` has the rules touching the words,
   and a separator after the last segment before `⇤ start`. MINOR.

## Browser check: rhythm-notation (spec 009, #18), 2026-11-16

Screenshots on merged `main` (03fc3c7) of a part holding every duration (w, h, q, lone and beamed 8ths, beamed 16ths, lone 32nds
beside quarters, a triplet, a repeat) and a part with none, on the song page, the play view and capture, at 375x667, 412x915 and
1280x800, dark and light. Playwright, as before. Noted, not fixed.

Held: beams join runs within a beat and stop at barlines; the triplet's bracket and `3` sit under the beams once; the part with no
durations draws no rhythm row and costs no height; the 32nd's flags clear the `12` above them; both themes read; capture keeps every
string in view at 375x667.

1. **The flags read as letters.** The round-2 budget made each flag a straight foot, so a lone eighth is an `L` and a lone 32nd is a
   stack of three feet that reads as `E` or `≡`, beside a `12` in a monospace face. A musician will work it out, but it does not read
   as notation at a glance. This is review round 3's NOTE F2, and T043/T044 (owed) are the place to judge it on a phone. If it fails
   there, the honest fix costs height: a curved flag needs about 7px more in the stem band.
2. **At 1280 (fine pointer) the rhythm row is tiny.** Half and quarter differ by stem length alone, about 4px against 8px, which is
   hard to tell apart at desktop density. The wide layout (entry 3) changes widths, not this row's height.
3. **Desktop play view is still a narrow card per part** (the staff uses about 35% of the card). Expected: entry 3 owns it.

## Browser check: wide-reading-layout (spec 010, #19), 2026-11-16

Screenshots on merged `main` (023faa2): the fit song, `long` and `short`, on the song page and play view at 375, 768, 1024, 1280 and
1920, dark and light; the play view with the click running at 1280; print preview of the song page. Playwright, as before. Noted, not
fixed.

Held: the fit song's ten passes draw as six cards and fit 1280×800 above the fixed click bar, in both themes; card numbers, `×3 ·
passes 1–3 of 4` and `bars 1–12` read at a glance; the running click lights its column and swaps in `pass 1 of 4`; 768 is two columns
with the staves wrapping inside each card; 375 looks as it did before (one card per row, nothing new but the numbers).

1. **Short cards waste most of a wide screen.** The `short` song (twelve one-bar parts) at 1280 draws three cards a row, each about
   415px wide around a 100px staff, and the twelfth row falls under the click bar. Five or six a row would fit the song on one screen,
   which is this entry's own goal. The column count follows the floor width, not what the cards hold.
2. **Uneven cards at 1920.** `long` (16 bars, then 2, then 2) gets three equal tracks: A wraps into four rows in a third of the width
   while B and C leave most of theirs empty. Same cause as 1.
3. **A gap opens when the click runs.** The hidden `×3 · passes 1–3 of 4` keeps its width (`visibility: hidden`), so `pass 1 of 4` is
   followed by a blank stretch before `bars 1–12`.
4. **Print breaks chord symbols.** On the printed song page, `Em7` above bar 1 wraps to `Em` over `7` in both parts A and A′.

## Browser check: tab-playback (spec 011, #20), 2026-11-16

Screenshots on merged `main` (2d95102) of `seedPlaybackSong` (the fit song with durations cleared, plus part T's techniques): the part
card menu, the play view's cluster at rest and with Notes on and one step slower, the whole song playing, and part T playing, at
375×667 (touch) and 1280×800 (mouse), dark and light. Sound itself was not judged; that is T061/T062 (owed). Noted, not fixed.

Held: **Play** is the first item of every part menu; part playback opens on the part with `Part T · Whole song`; the outline follows the
sounding column in both themes and reads apart from a selection; the null-duration rule is said in words ("No note has a length, so
each plays one beat."); the session speed shows as `95% · 114 bpm` and as a badge on the tempo, and `song.bpm` still reads 120.

1. **The open cluster takes 40% of a phone.** At 375×667 with Notes on, the cluster is five rows (Notes/Click/Loop, speed, view,
   Play/tempo/Less, status line), and the staff keeps about 380px. It folds away with **Less**, but that is where you'd want it while
   playing.
2. **At 1280×800 the open cluster breaks entry 3's fit.** It wraps to two rows, and the fit song's seventh card (T) falls under the
   bar. It fits with the cluster closed.
3. **A tuplet bracket with no number.** When a part keeps its counted groups but loses its durations (as this seed does), the bracket
   still draws above the staff (bars 1, 13 and 25) with no `3` and no rhythm row under it. It's a rare case in real data, but the
   bracket then reads as a stray line.
4. **Faster is disabled at 100%.** Speed only goes down. That's a defensible choice for practice, but the disabled button says nothing
   about why.

## Browser check: voice-memos (spec 012, #23), 2026-11-21

Screenshots on merged `main` (738b3c9, served with Next 16.4.6 from PR #21's install) of `seedSongM` with five memos on part B (ready
and named, saved on this device, refused for a full band, out of room on this device, couldn't download), then a recording on part A
with the fake microphone, at 375×667 (touch) and 1280×800 (mouse), dark and light. Sound itself was not judged, and recording on a real
phone stays owed (DECISIONS "012 — owed on real phones"). Noted, not fixed.

Held: the newest three are drawn and **Show 2 earlier memos** / **Show fewer** works; each state says what happened in words and
offers **Try again** where one applies; the memo menu is Rename, Download, Delete (red, after a rule); the recorder shows the
running time, the time left, Stop and Discard inside the part card; the new memo lands as `Memo 1 · Saved on this device.`; after the
first recording the storage warning ("This browser may clear memos …", **Dismiss**) appears once above the list. Both themes read.

1. **A memo list makes a wide grid uneven.** At 1280 part B's five memos make its card about 760px tall next to 180px cards for A
   and B′. It's the same cause as wide-reading-layout finding 1, and `cards-per-row` (entry 6) is where it belongs.
2. **The player's right-hand time reads 0:00 at rest** beside `0:04` in the line above. That's the position, not the length, but at
   rest it reads like a zero-length clip. Consider showing the length until play starts.

Not findings: the menu drawn near the top of the page at 1280 and a dimmed band below 800px are artifacts of the full-page
screenshot (the menu's backdrop covers only the first viewport).

## Browser check: cards-per-row (spec 013, #24), 2026-11-22

Screenshots on merged `main` (ae6f7a8) of the fit, short and long songs at 1280×800 and 1920×1080, dark and light, the song page and
the play view (desktop, mouse), plus each page under print media at 1047. The click running and a real print preview stay owed to a
person (013 T032). Noted, not fixed.

Held: wide-reading-layout findings 1 and 2 are fixed. `short` (12 one-bar parts) packs 8 cards a row at 1280 and the whole song sits
above the click bar. In `long` at 1920, part A's 16 bars take a whole row on one line, and B and C share the next. Cards keep reading
order, and the last row keeps its own widths. Finding 4 is fixed too: `Em7` prints on one line. On paper the short song packs 4 a row,
and a variant's "Differs from A in bar 4: 8 changed" stays on one line.

1. **"+ Add a name" prints.** On paper each unnamed part's head row still shows the dashed "+ Add a name" invitation, an edit
   control. It predates spec 013 (spec 008's invitation), but packing more cards a row makes it more visible.
2. **A full-row card stretches past its staff.** At 1920, `long`'s A card spans the row and leaves about 190px of empty card after
   bar 16. That's what flex-grow does for the only card on a row; it reads fine, but a card the width of its staff would look tighter.

## Follow-up: defects fixed from these checks (2026-11-22)

A sweep of every finding above against `main` (d983387). Already fixed by later entries: the clipped chord label, truncated chord
symbols, faint bracket numerals, controls under 44px on touch, the help overlay's padding, ligatures in the paste box, and the
hyphen-chord refusal's wording. tab-playback finding 3 was a misreading: the seed's group is a plain bracket, which has no number
by design. Fixed in this change:

- **"+ Add a name" no longer prints**: a print rule in `globals.css`, not a class, so the narrow markup still equals `main` (wide-narrow-unchanged).
- **The memo player shows the clip's length at rest**, and the position once played, instead of `0:00`.
- **Capture's `+ part` is bordered like a chip**, so when the strip cuts it at 375 it reads as a cut chip, not a stray `+`.
- **The status row's inline separators get 4px after them**, not 2px. The row's own gaps stay at 2px: at 375 the row has about 5px
  to spare with "stacking onto the marked column" and a 10-character chord, and 4px gaps clipped `end ⇥` (usability-status-row).
  So the separators between the words and the chord, and before `⇤ start`, are still tight.

Left as design calls, not errors: the rest of the "worth your eye" notes above.
