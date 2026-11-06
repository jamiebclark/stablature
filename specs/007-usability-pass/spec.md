# Feature Specification: Usability pass across every screen, phone first

**Feature Branch**: `007-usability-pass`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Make every screen easy to use, above all on a phone. This entry adds no new musical capability: no new event fields, no new notation, no migration. It changes layout, sizing, reach and the speed of getting around, and it starts by measuring rather than assuming." (full roadmap entry: `.specify/roadmaps/capture-expression.json`, entry `usability-pass`)

## Summary

Six entries each added controls to the same small screen. This one spends nothing new on music. It makes what is there fit, reach, read and respond, and it starts from a measured audit of every screen.

1. **The capture screen gets its height back.** At 375×667, six strings with a chord row and a bracket fit whole, at rest and while selecting, with the frets still 36×36.
2. **Every control can be hit.** Touch targets rise to 44px wherever the layout allows. The few that cannot are named, with their reasons.
3. **Density follows the pointer.** A mouse gets a tighter layout at any window width. Touch sizing does not change because of it.
4. **What is drawn is whole.** Chord labels stop being cut to `E…`, numerals and rhythm marks become legible and sit on their notes, and the staff gets the typeface it was always meant to have.
5. **Reading gets faster.** Rarely used controls collapse, tab fills the width across several lines, bars are numbered, sections are named, and a highlight follows the click.
6. **A keyboard works.** On a mouse-and-keyboard device the common actions have shortcuts, shown in a help overlay.

Nothing here changes a song. No field, table, migration or sync message is added, and the text export does not change. The only things remembered are a reader's own panel state, on the device.

The audit was run for this spec and its raw summary is in `audit/before.txt`. Re-running `audit/` gives the after figures in the same shape.

### Where the brief and the code differ

The brief was written from earlier browser checks and some details have moved. This spec follows the measurements.

| The brief says | The code or the measurement says | What this spec does |
|---|---|---|
| Retire the `flex-col-reverse` branch if six strings fit | Six strings do fit at 375×667. But `Guitar 7` exists and overflows by 59px after the recovery. And on any shorter screen, `justify-end` strands content above the scroll origin where no swipe reaches: at 375×553, about a small phone in a browser with its bars showing, five strings have 47px unreachable even after the recovery. Removing the branch literally would regress Option A. | What retires is the **branch on string count**. One rule replaces it: overflow is always reachable, at any string count and any height. See FR-005. |
| About 65px recovered against a worst case need of 58px | The rows give 59.8px, not 65. The need is 70px while the band keeps its 16px of padding. | Band padding drops from 16px to 4px, which the brief did not list. That makes 71.8px against 70px: **it fits with 1.8px to spare**, tried in the browser. See The height budget. |
| The status row is about 35px | It measures 29.8px, and its jump buttons must reach the 24px floor | It can give 3.8px, not 10px. |
| The status row wraps with a chord active and the stack armed (F23) | It no longer wraps. It is one line, and both texts are cut: 151px of the status, 92px of the chord. | The defect is lost words, not a wrap. See FR-026. |
| Chord symbols truncate in the chord picker | There is no chord picker. The cut is in the chord row of **every staff**, and it is worse than `Em...`: at a one-digit column the play view shows `E…`, `C…`, `A…`. `F#m7b5` gets 18px of the 41px it needs. | Closed on every staff. See FR-024. |
| Bracket numerals are 10.4px at about 3.4:1 | True, and the bracket's line also runs through the numeral. The colour is `--text-faint`, which fails 4.5:1 on every surface in both themes (2.83 to 3.82). On the selection band even `--text-dim` is 4.08 in the dark theme. | The token is fixed, not one numeral. See FR-029, FR-030 and FR-031. |
| JetBrains Mono ligatures are on, so turn them off where tab text is shown | True in the paste box and the refused and ignored lines. The staff is not in JetBrains Mono at all: `.tab-staff` computes to the system stack (spec 006, FU14). | Both are fixed. The right font widens a column from 18.2px to 19.2px. See FR-032 and FR-033. |
| `review-redraw-ledger.test.ts` runs on the default 5s timeout | It already has `vi.setConfig({ testTimeout: 120_000 })`, on `main` since entry 6. Its 26 cases ran in 17s here. | Already closed. FR-039 keeps it and asks for no change. |
| Show a time signature at the start of the part | **The data holds none.** No row has a time signature, and bars are whatever the barlines make them. A new field is out of scope. | Beats per bar is derived where every bar agrees, and shown in words. It never says `4/4`. See FR-051. |
| A highlight follows "playback or the click" | There is no note playback, only the click. The click knows ticks, not columns, and knows them only while it follows the notation. | The highlight runs only while following. See FR-053. |
| "The second verse" | A section is announced only when the name changes, so `Verse ×2` is labelled once. Expansion does not carry which time through it is. | The occurrence is derived when the arrangement is expanded. Nothing is stored. See FR-049. |
| "Settings" is one of the screens | There is no settings page. The nearest is a band's tunings. | Tunings was audited as settings. Sign-up, join, offline, privacy, terms, the paste panel and the tempo sheet were also walked. |
| Check whether 14px inputs trigger focus zoom on iOS | They can. The viewport's `maximum-scale=1` is what hides it on iOS, and on Android the same setting blocks pinch zoom for everyone. Sources agree on the first point and on 16px as the real fix, though none is Apple's own. | Inputs go to 16px on touch and the lock goes. See FR-017 and FR-018. A real phone must confirm it. |
| Anything needing a long press with no visible alternative | Only staff columns have a long press. A playable column has the details button. A barline does not, but its sheet holds only delete, which the stable row also offers. | **No gap found.** FR-021 keeps it that way. |

## The audit

**Method.** A scripted walk of every screen at 375×667 and 390×844 in both themes, with touch and coarse-pointer emulation, on a production build. It read every interactive element's box, every text run's size and contrast against its real surface, every clipped or truncated element, and the position of every input against a keyboard. The results were then checked by eye in screenshots.

**The four limits of that method.**

- A desktop browser has no on-screen keyboard. The keyboard column is geometry against a stated height (260px at 375×667, 336px at 390×844), not a sighting.
- Sizes do not differ between themes, so a size row covers both. Contrast does, so contrast gives both.
- The thumb column uses the brief's rule, the bottom half of the screen, at the page's first scroll position.
- Not walked: the open invite form, join while signed in, and the sync error badge.

### Per screen, at 375×667

The figures come from the 375×667 run. Where 390×844 differs, the row says so. Fret cells and staff columns are excluded from the counts and sized under **Size floors**.

| Screen | Targets | Under 24px | 24 to 43px | Frequent controls outside the bottom half | Truncates or wraps | Long press | Keyboard |
|---|---|---|---|---|---|---|---|
| Bands (empty, list) | 5, 6 | 3: Sign in 36×16, Privacy 37×16, Terms 31×16 (A1, A2) | 2: logo 24 tall, Band name 38 tall (A4) | None: add band is first-use only | None | None | Clear (input ends at 155) |
| Band's songs | 10 | 4: as above, plus back link 49×16 (A3) | 6: Tunings, Song title, Invite 38 tall, title link 24 tall, Capture 36 tall (A4) | None: Capture sits on each row | Long title cut by 142px (A17) | None | Clear (251) |
| Tunings (settings) | 17 | 4 (A1, A2, A3) | 13: family tabs 53×24, Add 73×38, Delete 86×36 (A4) | None: rarely used | None | None | No inputs |
| Song page | 36 | 7: as above, plus three part names 20 tall (A8) | 28: everything else, including density and view controls 28 tall (A4) | **Capture and Play view at y=155 (A10)** | Chord labels: Em7 +4, Am7 +5, Dsus4 +12, Cmaj7 +14 (A15). Title can be cut (A17) | None | Section and Cue start under it, and the page scrolls them clear |
| Arrangement entry | 43 | 7, as song page | 35, adding stepper 30×32, Done 58×36, Last pass 71×35, move 38×38 (A5). A cue is bare text with a tap handler, not a control (A9) | Move and remove sit lower down: fine | As song page | None | Select opens the native picker |
| Paste panel | 38 | 7, as song page | 29 | Fine | As song page | None | **Box ends at 522, keyboard top is 407: the status under it is hidden while typing (A19)** |
| Capture | 20 | 3: title 51×20, start 47×21, end 44×21 (A6) | 17: tempo 54×33, chip 28×28, + part 64×36, toolbars 36 to 38 tall, delete 41×33, stepper 30×32, latches 70×31 (A5, A6) | **At six strings the whole toolbar is in the top half: status y=217, stable row y=251, contextual row y=306 (A11).** At 390×844 only the header and chips are, and the status row at six strings | Status and chord cut (A16). Chord label cut (A15). Chord form hint cut at "writte" (A18). Details button is 44 tall among 38s and squeezed to 43 wide (A33) | Columns only, with a visible alternative | Chord form clear (230) |
| Selecting | 13 | 1: title (A6) | 12: bracket controls 28×36, side by side (A7) | Selection row is in the top half at six strings (A11) | None | Swallowed by design | No inputs |
| Inspector | 11 | 0 | 5: close 52×32, stepper 34×36, text 185×38, delete 63×36 (A5) | None: it is a bottom sheet | None | Is the target of the long press | **Chord input ends at 475, keyboard top is 407 (A20)** |
| Tempo sheet | 2 | 0 | 1: close 52×32 (A5) | None | None | None | No inputs |
| Play view | 11 | 4 (A1, A2, A3) | 5: logo, Capture 38 tall, frets, notes, intervals 28 tall (A4) | **View control y=164, Capture y=69 (A10)** | Chord labels cut to one letter (A15). Numeral struck through (A26) | None | No inputs |
| Sign in, sign up | 8, 11 | 4, 6: top bar, footer, inline links (A1, A2) | 4, 5: inputs 38 tall, submit 36 tall (A4) | Fine | Sign-up is 19px taller than the screen (A30) | None | Sign-up's submit is mostly under it; the keyboard's Go key submits (A30) |
| Join, offline, privacy, terms | 5 to 6 | 3 to 4 (A1, A2) | 1 to 3 | Fine | None | None | No inputs |

### Across screens

| Id | Finding | Measured | Goes to |
|---|---|---|---|
| A1 | Top bar's Sign in and logo are small on every page but capture | 36×16, 104×24 | FR-011 |
| A2 | Footer links are small on every page | 37×16, 31×16 | FR-011 |
| A3 | Back links are small | 44 to 49 wide, 16 tall | FR-011 |
| A4 | Buttons and inputs sit at 36 to 38 tall, segmented controls at 28, tuning family tabs at 24 | Every page | FR-011 |
| A5 | Steppers and sheet close buttons are small | 30×32, 34×36, 52×32 | FR-011, FR-012 |
| A6 | Capture's title, jump buttons, part chips and delete are small | 20, 21, 28×28, 41×33 | FR-012 |
| A7 | The two bracket controls are narrow and adjacent | 28×36 | FR-013 |
| A8 | Part names are 20 tall and are the only way to rename | 51×20 up | FR-011 |
| A9 | A cue in the roadmap can only be selected by tapping bare text | Not a control at all | FR-016 |
| A10 | The song page's and play view's main actions sit at the top | y=155, y=69 | FR-041, FR-044 |
| A11 | At 375×667 the neck fills the bottom half, so the toolbars cannot be there | See table | Accepted, see Decisions |
| A12 | The song page's first staff is more than a screen down | y=744 | FR-042 |
| A13 | The play view spends the screen on chrome | First staff y=244, click bar 81 tall | FR-043, FR-044 |
| A14 | The play view's strip wastes width | 295px of a 2605px part on a phone. On a 1280 window, 688px | FR-055 |
| A15 | Chord labels are cut on every staff | Up to 23px | FR-024 |
| A16 | The status row loses words | Status 151px, chord 92px | FR-026 |
| A17 | Long titles are cut with no way to read them | +142px | FR-027 |
| A18 | The chord form's hint is cut | Cut at "writte" | FR-028 |
| A19 | The paste status hides behind the keyboard | 115px under | FR-019 |
| A20 | The inspector's chord input is under the keyboard | 68px under | FR-020 |
| A21 | Every input and select but the paste box is 14px | All screens | FR-017 |
| A22 | The viewport locks zoom | Blocks pinch on Android | FR-018 |
| A23 | Nothing allows for safe areas, though the app asks for a translucent status bar when installed | No inset anywhere | FR-022 |
| A24 | `--text-faint` is under 4.5:1 on every surface | Dark 3.22 to 3.82, light 2.83 to 3.42 | FR-029 |
| A25 | Fret numbers and the neck's header are under 4.5:1 | Cells: dark 3.46 to 3.79, light 4.36 on an inlay. Header: 9.6px at 3.02 to 3.82 | FR-015, FR-029 |
| A26 | Bracket numerals are small, faint and struck by the line | 10.4px, 3.46 | FR-030 |
| A27 | Rhythm marks sit left of their notes and are small | 5 to 10px off, 10.4px | FR-031 |
| A28 | The staff is not in its typeface | System stack | FR-032 |
| A29 | Ligatures are on wherever tab text is monospace | `normal` | FR-033 |
| A30 | Sign-up is slightly taller than the screen | 686 of 667 | Accepted: it scrolls, and Go submits |
| A31 | On a short screen the band strands or vanishes | At 375×553, six strings show none today, and five have 107px unreachable | FR-005 |
| A32 | Delete on a part or tuning is one tap, beside Edit, with no undo | Not a size problem | Logged as a new idea. FR-014 keeps it clear of its neighbours |
| A33 | The contextual row is 1px overfull and its controls differ in height | 43 wide, 44 tall among 38s | FR-012 |

### The height budget

At 375×667, six strings, a chord row and a bracket. The neck does not change.

| Row | Today | After | Gives |
|---|---|---|---|
| Title row and part row | 37 + 45 | 45, one row | 37 |
| Status row | 29.8 | 26 | 3.8 |
| Stable toolbar row | 55 | 46 | 9 |
| Contextual or selection row | 56 | 46 | 10 |
| Band padding | 16 | 4 | 12 |
| Neck and latch strip | 314.2 | 314.2 | 0 |
| **Room for the staff** | **114** | **185.8** | **71.8** |
| Staff needs | 184 | 184 | |
| **Spare** | **−70** | **+1.8** | |

Tried with a style tag on a real build, before writing this spec. It holds at rest and with all seven selection controls showing. Four and five strings have room to spare. Seven strings still overflow by 59px with one string out of view, and they keep the swipe.

There is 1.8px left. Nothing else can be added to this screen without taking something away, which is why the budget gets a test.

### Size floors

| Target | Touch today | Touch after | Mouse after |
|---|---|---|---|
| Fret cell | 36×36 | **36×36**, unchanged | 32×32 |
| Dead-note cell | 36×28 | **36×28**, decided below | 32×24 |
| Latch chip | 70×31 | 70×31, no height to spend | 70×26 |
| Toolbar control | 36 to 38 tall in rows of 55 and 56 | **44 tall in rows of 46** | 32 tall |
| Repeat stepper half | 30×32 | at least 32×44 | at least 24×32 |
| Selection bracket control | 28×36 | at least 36×44 | at least 28×32 |
| Part chip | 28×28 | at least 36×44 | at least 28×28 |
| Jump to start, end | 47×21 | at least 44×24, in a 26px row | same |
| Back to the song | 51×20 | at least 44×44 | at least 24×24 |
| Everything else | 16 to 38 tall | at least 44 tall, and 44 wide or as wide as its label | at least 24×24 |

A link inside a sentence is exempt, as WCAG 2.2 exempts it, and those links are named in the plan.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See the whole part while capturing (Priority: P1)

A guitarist is capturing a six-string riff on a small phone. Today about four and a half strings show and the rest is a swipe away. After this, all six show with the chord above them and the bracket, and the frets are the size they always were.

**Why this priority**: It is the reason the entry exists, and capture is the screen the app exists for.

**Independent Test**: At 375×667 with six strings, a chord and a bracket, every string and both rows are inside the band at rest and while selecting, with no swipe.

**Acceptance Scenarios**:

1. **Given** a six-string part with a chord row and a bracket at 375×667, **When** the screen opens, **Then** every string, the chord row and the bracket row are in view and the page does not scroll.
2. **Given** that part, **When** a run is selected with all seven controls showing, **Then** nothing leaves view and the stable row does not move.
3. **Given** a part with several lettered parts, **When** the capturer switches part from the merged row, **Then** it opens as it does today, and the current chip is in view.
4. **Given** a seven-string part, or any part on a shorter screen, **When** the content does not fit, **Then** a swipe reaches every string and the bracket.
5. **Given** the capturer groups a run that is off screen, **When** the bracket is made, **Then** the band brings it into view.

---

### User Story 2 - Hit what you mean (Priority: P1)

Anyone using the app with a thumb, in a dim room, with the other hand on a bass. Controls are big enough to hit first time and far enough apart that a miss does not do damage.

**Why this priority**: A mis-tap is how bad data gets captured, and most of the app's controls sit under the floor today.

**Independent Test**: Walk every screen at both sizes and read every target against the floors table.

**Acceptance Scenarios**:

1. **Given** any screen on touch, **When** the targets are measured, **Then** none is under 24px and each meets its row in the floors table.
2. **Given** an input on touch, **When** it is focused, **Then** its text is 16px and the page does not zoom.
3. **Given** a reader wants to enlarge a staff, **When** they pinch, **Then** the page zooms, and a double tap on the neck does not.
4. **Given** the on-screen keyboard is up in the paste panel, **When** text is typed, **Then** the status line stays visible above the keyboard.

---

### User Story 3 - Read what is drawn (Priority: P1)

A bassist reads a part on the play view. Every chord symbol is whole. Bracket numbers and rhythm marks are legible and sit on the notes they belong to. Pasted tab looks the way it was typed.

**Why this priority**: `E…` for `Em7` is a wrong answer on the app's main reading screen.

**Independent Test**: A staff holding every row, at actual size in both themes, with each mark measured against its note.

**Acceptance Scenarios**:

1. **Given** chords on adjacent one-digit columns, **When** the staff is drawn, **Then** each symbol is readable in full and no two touch.
2. **Given** a bracket with a number, **When** drawn on any surface, **Then** the number is at least 12px, at least 4.5:1, and clear of the line.
3. **Given** a column with a duration, **When** drawn, **Then** the mark is centred on the note within 1px.
4. **Given** `|-` in the paste box or a refused line, **When** shown, **Then** it reads as two characters.
5. **Given** a chord and a stack armed, **When** the status row is drawn at 375px, **Then** the status words are whole and both jump buttons are present.

---

### User Story 4 - Get to the tab quickly (Priority: P2)

A band member opens a song on a phone during rehearsal. The tab is on the first screen, the main actions are under the thumb, and the rarely used controls wait behind one tap.

**Why this priority**: Every visit pays this cost, though nothing is broken without it.

**Independent Test**: Open the song page and the play view at 375×667 and read where the first staff starts and where the main actions sit.

**Acceptance Scenarios**:

1. **Given** a song with parts on touch, **When** the song page opens, **Then** the first staff starts inside the first screen and Capture and Play view are in the bottom half.
2. **Given** the tools panel is collapsed, **When** the reader opens it, **Then** tempo, export, density and view are one tap away.
3. **Given** the play view, **When** nothing needs saying, **Then** the control cluster is one row, with start and tempo showing.
4. **Given** the click has stopped itself, or no tempo is set, **When** the cluster is collapsed, **Then** the reason still shows.

---

### User Story 5 - Keep your place, and say where you are (Priority: P2)

A band talks through a song: "from bar 17", "the second verse". The tab fills the screen across several lines, with bars numbered and sections named. While the click runs, a highlight shows where the music is.

**Why this priority**: It is the largest change to how the app reads, and it builds on data that already exists.

**Independent Test**: A sixteen-bar part arranged twice inside a section, read at phone and desktop widths with the click running.

**Acceptance Scenarios**:

1. **Given** a long part on the play view, **When** drawn, **Then** it breaks at barlines across as many lines as it needs, with no sideways scrolling unless one bar is wider than a line.
2. **Given** an arrangement, **When** read in the play view, **Then** bars number through the song as played, and bar 17 means the same to everyone in the room.
3. **Given** `Verse ×2`, **When** read, **Then** the second time through is labelled as the second.
4. **Given** the click follows the notation, **When** it runs, **Then** a highlight moves with it and the view keeps it on screen.
5. **Given** the reader scrolls away while it runs, **When** they stop scrolling, **Then** the view leaves them alone for a few seconds before following again.
6. **Given** a part where every bar is four beats, **When** the play view opens, **Then** tempo and `4 beats a bar` show once at its start.
7. **Given** bars of different lengths, **When** the part is drawn, **Then** no beats figure is shown.

---

### User Story 6 - A mouse gets a tighter screen (Priority: P2)

Someone tidies a part at a desk. On a mouse the app stops being sized for a thumb and shows more of the part, even in a narrow window. A tablet stays sized for a thumb, however wide it is.

**Why this priority**: The desktop looks oversized today, and nothing in the app can tell a mouse from a thumb.

**Independent Test**: Compare the same window on a fine and a coarse pointer, and a narrow mouse window with a wide tablet.

**Acceptance Scenarios**:

1. **Given** a 500px window on a mouse, **When** capture opens, **Then** it uses the mouse sizes.
2. **Given** an 820px tablet on touch, **When** capture opens, **Then** it uses the touch sizes.
3. **Given** the same window, **When** compared, **Then** the mouse layout shows at least 15% more columns on a line.

---

### User Story 7 - Paste ordinary text without a fight (Priority: P3)

Someone pastes tab with `Am7-D7` written above it. The line is listed as ignored and the paste reads. A line that is still refused says what it looks like.

**Why this priority**: A false refusal is safe but irritating, and the reason given today explains nothing.

**Independent Test**: Run the named lines alone and beside a good system, then run spec 004's sweeps.

**Acceptance Scenarios**:

1. **Given** `Am7-D7` beside a good system, **When** read, **Then** the paste reads and the line is listed as ignored.
2. **Given** `A7-D7` beside a good system, **When** read, **Then** it is refused, and the reason says it looks like chords joined by hyphens.
3. **Given** every invariant in spec 004, **When** its sweeps run, **Then** every one holds, and no line that may be a damaged row became commentary.

---

### User Story 8 - Work from the keyboard (Priority: P3)

At a desk, a capturer enters a riff by number without leaving the keyboard. A reader starts and stops the click with the space bar. Typing in a box is never taken over.

**Why this priority**: A real speed-up, but only for the smaller group using a keyboard.

**Independent Test**: Run every shortcut on its screen, then type each key into every kind of input and confirm nothing else happens.

**Acceptance Scenarios**:

1. **Given** the play view, **When** space is pressed, **Then** the click starts, and pressing it again stops it.
2. **Given** capture on a string, **When** `7` is pressed, **Then** the note goes in exactly as if that cell were tapped, with any armed latch applied.
3. **Given** focus in any input, **When** any shortcut key is pressed, **Then** the input receives it and nothing else happens.
4. **Given** a mouse-and-keyboard device, **When** the reader looks for help, **Then** a visible control opens the overlay, as does `?`.

---

### Edge Cases

- **A shorter screen.** At 375×553 six strings show about three and the rest is a swipe. The band must never be left with no staff showing where the recovered height can prevent it.
- **Seven strings at 375×667.** One string stays out of view, reachable by a swipe. This is the amended floor.
- **The chord form is open.** The band gives up the form's height while it is open, as it does now, and comes back on closing. Anything out of view is reachable by a swipe.
- **Landscape.** Unchanged, and must not regress. The neck stays reachable, as spec 001 recorded.
- **A long title in the merged row.** The title gives way to the chips, and is cut last to no fewer than its back target. The full title is on the song page.
- **Twelve parts.** The chips scroll sideways inside the row and the open part is kept in view.
- **`N unsynced` with a long title.** The sync word shows only when something is unsynced, so the common case costs nothing.
- **A chord symbol longer than a whole line.** It stays whole and takes the room it needs on screen. The text export does not change.
- **Two chords one column apart.** The columns on screen widen so both are whole. Bars and alignment hold, and the export is untouched.
- **One bar wider than a line.** That bar takes a line of its own, and that line alone scrolls sideways. The highlight scrolls it.
- **A bracket that crosses a line break.** It cannot: groups do not cross a barline, and lines break only at barlines.
- **A variant's marks and removal gaps on a wrapped staff.** They stay on their columns, and the caption still appears once per pass.
- **A bar number on a sliced pass.** The running number counts what is played, and the pass's own heading still says which of the part's bars it is.
- **A part with no barlines.** It is one bar, drawn as one bar, and numbered once.
- **Trailing barline.** Bars are counted as they are everywhere else in the app, so a barline with nothing after it opens no new bar.
- **Sections with the same name, not adjacent.** They count as occurrences of one name, in the order played.
- **A pickup bar.** Bars differ, so no beats figure is shown.
- **The click on a part that stops being timed.** The highlight stops at the last timed column, and the plain beat carries on without one.
- **The click at very high speed.** The highlight may skip columns but never lags behind the beat, and never affects when a click sounds.
- **The keys move the position while stopped.** The highlight shows where the keys put it. It does not set where the click starts, which is always the top.
- **Reduced motion.** The highlight moves in steps and the view jumps rather than glides.
- **Two digits for one fret.** See FR-061. `1` waits briefly for a second digit, and `25` on a 24-fret neck enters 2 then 5.
- **A shortcut while a sheet is open.** Shortcuts rest until it closes, except Esc, which keeps its usual meaning.
- **Space on a focused button.** The button gets it, as it always does.
- **A hybrid laptop with a touch screen.** The primary pointer decides. Touching a mouse layout still meets every floor.
- **A device reporting no pointer.** It gets the touch sizes, because they are the default.
- **A tablet with a keyboard.** Shortcuts work. The help control shows only on a fine pointer, and `?` works everywhere.
- **A paste line that looks like chords but sits at an offset above a system.** It is read as a chord row exactly as today.
- **A hyphen-joined line where a piece could be a label and a fret, such as `E5-A5`.** It stays refused. A false refusal is acceptable.
- **Printing.** Not redesigned. Panels and clusters stay out of print and a pass still avoids breaking across a page.

## Requirements *(mandatory)*

### Functional Requirements

**Height on the capture screen**

- **FR-001**: The title and the part chips MUST share one row of at most 45px at 375px wide. It MUST hold the way back, the part chips, adding a part, the tempo, and the sync word when something is unsynced. Every action on the two rows today MUST stay on it.
- **FR-002**: The stable, contextual and selection rows MUST each be at most 46px high including their border, with the reserved row matching, so the stable row still does not move as the cursor moves (spec 001, FR-012).
- **FR-003**: The status row MUST be at most 26px high in every state, and the selection status line the same.
- **FR-004**: All height recovered MUST go to the tab band. The neck, the latch strip and the fret cells MUST keep their size on touch.
- **FR-005**: There MUST be one rule for overflow, with no branch on string count: whatever does not fit is reachable by a swipe, at any string count and any screen height, and the band opens showing the strings nearest the neck. Nothing may sit above the scroll origin.
- **FR-006**: At 375×667, four, five and six strings MUST each be wholly in view with a chord row and a bracket row, at rest and while selecting, with no swipe. The page MUST NOT scroll.
- **FR-007**: Swipe reachability MUST stay the guaranteed minimum everywhere FR-006 does not reach. This entry MUST NOT regress Option A.
- **FR-008**: A selection MUST NOT hide any string that was in view before it, and MUST NOT move the band.
- **FR-009**: A newly made group MUST be brought into view, sideways and vertically, as soon as it is drawn.
- **FR-010**: A test at 375×667 MUST hold the budget: each row's height, and six strings with both rows wholly in view at rest and while selecting. Adding a row or growing one MUST fail it.

**Size floors**

- **FR-011**: On touch, every target MUST meet the floors table, and no target anywhere may be under 24×24 except a link inside a sentence.
- **FR-012**: The capture toolbars MUST fit one line at 375px with every control at its full floor and no control squeezed. Controls in a row MUST share one height.
- **FR-013**: The two bracket controls MUST each be at least 36px wide on touch, with all seven controls on one line at 375px, and numerals up to 16 still readable (spec 003, FR-029).
- **FR-014**: A destructive control MUST NOT touch a neighbouring control: at least 8px apart on touch.
- **FR-015**: The neck's fret-number header MUST be 11px at 4.5:1 or better, in the same row height. Inlay frets stay told apart, by weight rather than brightness. The numbers in the cells MUST reach 4.5:1 on every tier in both themes.
- **FR-016**: A cue in the roadmap MUST be a real control, meeting the floors and reachable from the keyboard.
- **FR-017**: On touch, every input, select and text box MUST be at least 16px, so no focus zoom can occur. A mouse keeps its smaller text.
- **FR-018**: The viewport MUST stop locking zoom. A pinch MUST zoom every reading screen, and a double tap on the neck or a toolbar MUST NOT.
- **FR-019**: With the on-screen keyboard up, the paste panel's status MUST be visible above it, with the first refused line reachable.
- **FR-020**: With the on-screen keyboard up, the inspector's text input and its set button MUST be visible together.
- **FR-021**: Everything a long press does MUST stay available by a visible control or an equivalent one, on every column kind.
- **FR-022**: Installed on a phone, no control or text MUST sit under the status bar or the home indicator.

**Density**

- **FR-023**: A fine pointer MUST get the tighter sizes in the floors table, at any window width, and more columns and shorter staves as in SC-009. A coarse pointer, or no pointer, MUST get the touch sizes at any window width. Nothing in density may depend on width. Touch sizes MUST be unchanged by this requirement.

**What is drawn**

- **FR-024**: A chord symbol MUST be shown whole on every staff, with no ellipsis, and no two symbols may touch. Where they would, the columns on screen widen as needed. This MUST NOT change the text export or the stored data.
- **FR-025**: A chord label MUST NOT be clipped by the band when a chord and a bracket share a column, at any string count that FR-006 covers.
- **FR-026**: In the status row at 375px, the status words MUST be whole, the chord symbol whole up to ten characters, and both jump buttons present, in every combination of status and chord. Only the chord's list of tones may be cut, since the neck shows them. Spec 001, FR-007's wording stands.
- **FR-027**: A long title MUST wrap to at most two lines on lists and page headings. Only the capture row cuts it.
- **FR-028**: The chord form's hint MUST fit its box at 375px at 16px text.
- **FR-029**: All text MUST reach 4.5:1 on the surface it is drawn on, in both themes, apart from disabled controls. The faint grey and the grey of the neck's numbers change to reach this, everywhere they are used.
- **FR-030**: Bracket numerals MUST be 12px or larger, at 4.5:1 on the page, a raised card and the selection band, and no line may cross a digit.
- **FR-031**: Rhythm marks MUST be centred on their note within 1px, at the same 12px as the numerals, at 4.5:1 on every surface, and MUST still fit under the narrowest column without widening it (spec 005, FR-014).
- **FR-032**: The staff MUST be drawn in JetBrains Mono, as the layout has always said. The string labels and every row stay aligned.
- **FR-033**: Ligatures MUST be off wherever tab text is shown: the staff, the paste box, and refused and ignored lines.

**Pasting**

- **FR-034**: A line of two or more whole chord symbols joined by single hyphens, with no rail at either end and at least one symbol carrying a quality a fret row cannot hold (`Am7-D7`, `Cmaj7-Fmaj7`), MUST be commentary beside a good system: listed as ignored with its number.
- **FR-035**: A hyphen-joined line of chords that stays refused (`A7-D7`, `E5-A5`, `D-7-G-7`) MUST say it looks like chords joined by hyphens, and how to fix it, rather than give a reason about notation characters.
- **FR-036**: `(c) 1999-2004` and `1-2-3-4-` MAY stay refused. If either stops refusing, it MUST do so with the same proof as FR-037.
- **FR-037**: Every invariant in spec 004 MUST hold, with its sweeps unnarrowed. Above all INV-006, INV-009 and INV-010: a false refusal is acceptable, and a silent wrong note is not. No line FR-034 admits may be read as notes, as a chord row or as a label.
- **FR-038**: The cost F75 measured, 43 of 202 ordinary lines refused, MUST be measured again the same way and MUST NOT rise.

**Tests**

- **FR-039**: The redraw ledger's heavy cases MUST keep their explicit timeout and everything they cover.

**Compact controls**

- **FR-040**: On a screen where rarely used controls take permanent height, they MUST be grouped behind one visible control that collapses. The frequent ones stay out. Whether a panel is open MAY be remembered on the device, and MUST NOT be stored on the song or synced.
- **FR-041**: On touch, the song page MUST keep Capture and Play view in the bottom half of the screen at any scroll position. On a mouse they stay in the page header.
- **FR-042**: On the song page, tempo, export, density and view MUST collapse into one tools control, and adding to the arrangement into another. The roadmap stays visible. Spec 006, FR-020's note MUST stay beside the export controls.
- **FR-043**: The play view's heading MUST take one row for the way back and the title, with tuning and tempo beneath it.
- **FR-044**: The play view MUST have one bottom cluster. Collapsed, it shows start or stop, the beat, the tempo and the control that opens it. Open, it adds the view control, the click's follow choice and the way to capture.
- **FR-045**: Collapsed, the cluster MUST still show any message the reader must see: no tempo, why the click stopped, and the help while it runs (spec 005, FR-027, FR-035 and FR-037). It MUST keep spec 005, FR-026: in reach, at least 44px high, not covering the last staff, not printed.
- **FR-046**: The capture toolbars MUST NOT collapse. Every control on them stays one tap away.

**Bars and sections**

- **FR-047**: The play view MUST number every bar as played, through the whole arrangement, counting bars as the app counts them everywhere. The number sits at the bar's first column and collides with nothing.
- **FR-048**: The song page MUST number each part's bars from 1. Capture MUST NOT show bar numbers: it has no height for them. The text export MUST NOT change.
- **FR-049**: The play view MUST name a section at each pass through it, not only when the name changes, and mark which time through it is, from the second on. Nothing is stored for this.
- **FR-050**: A pass cut to a bar range MUST say that its range is in the part's own bars, so it cannot be mistaken for the running number.
- **FR-051**: Beats per bar MUST be shown only when every bar of the part is timed and all are the same whole number of beats. It MUST be in words (`4 beats a bar`), never as a fraction: a bar's length cannot tell 6/8 from 3/4.
- **FR-052**: Tempo and beats per bar MUST appear once at the start of each part: on each card on the song page, and at a part's first pass in the play view. With no usable tempo, tempo is left out and nothing is assumed.

**Reading position**

- **FR-053**: While the click follows the notation, a highlight MUST mark the column being played, from the end of the count-in to the last timed column. It MUST NOT show during the count-in or the plain beat. While the click is stopped the reader MAY place it by key (FR-057), and starting the click clears that, because the click always starts from the top.
- **FR-054**: The highlight MUST move on the same moment as the on-screen beat. It MUST NOT change when any click sounds or add to what spec 005's budgets measure. It MUST be told apart from the selection and from a variant's mark without colour alone, in both themes, and MUST NOT print. The view MUST keep it on screen, unless the reader has scrolled in the last four seconds.

**Filling the width**

- **FR-055**: The play view MUST draw each pass across as many lines as it needs, breaking at barlines, filling at least 90% of the window at 1280 wide and all of the column on a phone. String labels repeat on each line. Every row stays aligned on every line, in frets, notes and intervals.
- **FR-056**: A bar wider than a line MUST take a line of its own and scroll sideways alone. The song page's staff, capture and the paste preview stay as they are.

**Keyboard**

- **FR-057**: The shortcuts below MUST work on their screens, on any device with a keyboard.

  | Screen | Key | Action |
  |---|---|---|
  | Play view | Space | Start or stop the click |
  | Play view | `r` | Stop, then start again from the top with the count-in |
  | Play view | Left, Right | Move the reading position by a column |
  | Both | `[`, `]` | Move by a bar |
  | Capture | Left, Right | Move the cursor by a column |
  | Capture | Home, End | Cursor to the start, to the end |
  | Capture | `,`, `.` | Previous part, next part |
  | Capture | Up, Down | Choose the string to type on |
  | Capture | `0` to `9`, then Enter if needed | Enter a fret |
  | Capture | `x` | Dead note on that string |
  | Every screen | `?` | Open or close the help overlay |

- **FR-058**: A shortcut MUST NOT act while focus is in an input, select, text box or anything editable, during text composition, while a sheet is open, or with Ctrl, Cmd or Alt held. A focused button or link keeps its own keys.
- **FR-059**: A help overlay MUST list what works on the screen it opens from. A visible control opens it on a fine pointer, and `?` opens it anywhere. It closes with Esc, its close control, or `?`.
- **FR-060**: A fret entered by key MUST do exactly what tapping that cell does, with every armed latch and the stack. The chosen string MUST be marked on the neck once the keyboard has been used. It starts on the lowest string and is never stored.
- **FR-061**: `0` and `3` to `9` MUST enter at once. `1` and `2` MUST wait about 600ms for a second digit, or Enter, or any other key. A pair above the neck's highest fret enters as two notes. The digit waiting MUST show on screen.
- **FR-062**: The app MUST NOT name, copy or imitate another product in its interface, and no fixture may hold tab content from one.

**Scope and recording**

- **FR-063**: This entry MUST NOT change any stored field, table, migration, sync message, or the text export. `parse.ts` changes only for FR-034 and FR-035. A read-side derivation in the arrangement's expansion is allowed for FR-049.
- **FR-064**: Every requirement of an earlier spec that this entry changes MUST be amended in place and noted in `docs/DECISIONS.md` with before and after figures. At least: specs/003 FR-020, SC-009 and plan INV-013, with the wording below; specs/001 FR-026's list of rows; specs/002 SC-006's "toolbar position unchanged"; specs/005 FR-026 and FR-013 to FR-015 where marks and the cluster change; specs/006 FR-001 where the control moves into the cluster; and spec 004's reader contract and INV-010's cost.

  > FR-020 as amended: At 375×667 with all seven controls present, labels MUST NOT wrap, the staff MUST keep every string of a four-, five- or six-string part in view with a chord row and a bracket row, and the page MUST NOT scroll. Where a part does not fit, at seven strings or on a shorter screen, every string and the bracket MUST be reachable with a swipe.

- **FR-065**: A test that pins a size or position this entry changes MUST change with the requirement it pins, and be named in `docs/DECISIONS.md`. None may be deleted to pass.
- **FR-066**: Every changed screen MUST be looked at in a browser at actual size in both themes, as `docs/DECISIONS.md` requires, and `audit/` re-run to give the after figures.

### Key Entities

- **Panel state**: whether a collapsible group is open. On the device only, like the staff view.
- **Keyboard string**: which string typed frets land on. Held for the session, never stored.
- **Reading position**: the column the click is on. Derived while it runs, never stored.
- **Bar number, section occurrence, beats per bar**: all derived from what the part and arrangement already hold.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 375×667 in both themes, a six-string part with a chord row and a bracket has 0 strings out of view at rest and while selecting, up from 1 or more, with fret cells at 36×36.
- **SC-002**: The band grows from 130px to at least 189px at that size, and each row meets FR-001 to FR-003.
- **SC-003**: At seven strings at 375×667, and at four to seven strings at 375×553, every string and the bracket are reached by a swipe, and at 375×553 nothing is unreachable, down from 107px at five strings.
- **SC-004**: Across every screen at both sizes, 0 targets are under 24px outside the sentence-link exemption, down from as many as 7 on a screen, and every target meets the floors table.
- **SC-005**: Every input on touch is at least 16px, and 0 screens lock zoom.
- **SC-006**: Across every screen in both themes, 0 text runs are under 4.5:1 apart from disabled controls, down from 3 to 12 distinct runs per screen, and up to 49 on capture.
- **SC-007**: 0 chord labels are cut on any staff, including `F#m7b5` over a one-digit column.
- **SC-008**: Rhythm marks are within 1px of their notes' centres, down from 5 to 10px, and numerals and marks are at least 12px, up from 10.4px.
- **SC-009**: In the same 500×800 and 1280×800 windows, a mouse shows at least 15% more columns on a line than touch, and a six-string staff is at least 15% shorter. All touch sizes match the floors table in a window of any width.
- **SC-010**: At 375×667 on touch, the song page's first staff starts within the first screen, at y≤520, up from y=744, and the play view's at y≤160, up from y=244. Its idle cluster is at most 60px, down from 81px.
- **SC-011**: A sixteen-bar part needs no sideways scrolling on the play view, at 375px or at 1280px, where a phone shows 11% of it today. At 1280 it uses at least 90% of the window, up from 54%.
- **SC-012**: Any bar a band names by number on the play view is the same bar on every device, and every pass through a repeated section is labelled.
- **SC-013**: While the click follows the notation, the highlight changes within 50ms of the on-screen beat, and spec 005's timing checks pass unchanged.
- **SC-014**: `Am7-D7` beside a good system reads with its line listed. Every spec 004 sweep passes unnarrowed, and the F75 count is at most 43 of 202.
- **SC-015**: Every key in FR-057 does its action, and in every kind of input every one of them types and does nothing else.
- **SC-016**: The diff of the storage, sync, schema and export paths named in FR-063 is empty.
- **SC-017**: Every row of the audit table has an outcome in the after run: fixed, accepted with a reason, or logged as a new idea.

### Owed to a real phone

A desktop browser cannot prove these. Each goes in `tasks.md` as a human item and stays open until done.

- 16px inputs do not zoom on focus on iOS Safari, and with the lock gone, a pinch zooms and a double tap on the neck does not.
- The keyboard does not hide the paste status or the inspector's input, on iOS and on Android.
- Installed to the home screen, nothing sits under the status bar or home indicator.
- Six strings in a phone browser with its bars showing, where the screen is shorter than 375×667.
- A fret tap, a jump button in its 26px row, and the two bracket controls, each tried with a thumb.
- The reading highlight, seen on a real phone with the click running.

## Decisions made for this spec

Made without waiting, as agreed, so they can be overturned at review. **Worth your eye** marks the ones I am least sure about.

- **Six strings do fit, by 1.8px.** So the amendment goes ahead. **Worth your eye:** a margin this thin means the next row anyone adds fails the budget test on purpose.
- **Only the string-count branch retires,** not the bottom-anchored scroller. Removing it would regress Option A at seven strings and on short screens.
- **Frets stay 36×36 on touch.** The audit shows height is no longer short.
- **Frets are 32×32 on a mouse, not smaller.** The brief says never below 32. I read that as all pointers.
- **The dead-note row stays 28px tall.** It clears the 24px floor, it sits at the screen's bottom edge with nothing below to mis-hit, and raising it costs 8px against 1.8px of spare height.
- **The neck's fret numbers go from 9.6px to 11px** on the same row height and to 4.5:1, because every cell repeats its number but the header is what you scan.
- **The latch strip stays 31px tall.** It is the one frequent control left under 36px, for the same reason as the dead-note row. **Worth your eye.**
- **The capture toolbars do not collapse.** Capture speed depends on one tap, and with the height recovered there is no need to.
- **At 375×667 the toolbars stay in the top half at six strings (A11).** The neck is the most-used control and rightly owns the bottom half. They do move 10 to 19px closer to it.
- **Part chips stay at the top.** Switching part happens per section, not per note. **Worth your eye:** the brief's merged row keeps them at the worst reach on the screen.
- **`--text-faint` and `--fret-number` change everywhere,** not just at the numerals. Dark fret numbers go from 3.79 to at least 4.5, narrowing the gap to a chord tone, which weight still carries.
- **The staff moves to JetBrains Mono.** A column widens about 5.5% (18.2px to 19.2px). **Worth your eye:** every staff looks different after this.
- **Numerals and rhythm marks are both 12px,** which fits under a 19.2px column even for `32`.
- **`4 beats a bar`, not `4/4`.** A bar's length cannot tell 6/8 from 3/4, so a fraction could be false. **Worth your eye:** the brief asked for a time signature, and this is the most the data can honestly say.
- **Bar numbers run through the song on the play view,** and from 1 on the song page. "From bar 17" is said about the form, and the song page has no form to count through.
- **Reach on the song page uses a bottom bar on touch only.** A mouse has no thumb.
- **The status keeps its words and the chord's tones give way,** so spec 001, FR-007 needs no change.
- **The Songsterr cluster is docked, not floating.** A floating panel would cover tab, which spec 005, FR-026 forbids.
- **Keys:** `[` `]`, `,` `.`, `r` and `x` were chosen so that no plain letter a capturer might want later is taken more than needed, and digits stay frets. Up and Down choose a string. **Worth your eye:** there was no "current string" before this, so the keyboard needed one.
- **The zoom lock goes.** The brief only asked about focus zoom, but the lock is what hides it, and it stops a reader enlarging tab on Android.
- **This stays one entry,** though the template warns against bundling. The roadmap defines it as one pass. The stories are independent, and US-1 to US-3 are the ones that must land. **Worth your eye:** expect several review rounds, and FR-047 to FR-061 are the natural cut if it runs long.

## Out of Scope

- New notation, new event data, or any new stored field.
- Audio beyond what `rhythm-and-tempo` shipped. The click always starts from the top.
- Track mixing, transposition, printing, and any change to sync or storage.
- Wrapping the song page's staves, capture or the paste preview.
- Songsterr's layout, artwork, colours, wording or tab content.
- Landscape redesign.

### New roadmap ideas, logged not built

- **A stored time signature,** so a part can say `6/8`, and bars can be checked against it.
- **Undo, or a confirm, for deleting a part or a tuning** (A32). One tap removes a part today.
- **Start the click from a chosen bar,** which needs new audio behaviour.
- **Wrapped staves on the song page,** if the play view's wrapping works well.

## Assumptions

- 375×667 and 390×844 stand for small and common phones, and the keyboard heights used are typical, not measured on hardware.
- A pointer's type is taken from the device's primary pointer.
- 600ms is long enough to type a second digit and short enough not to feel like lag.
- Four seconds is long enough to read something the reader scrolled to.
- A section with no name gets no label, as today.
- The chord tones a status row may lose are always readable on the neck.

### Dependencies

- `check:untouched`, `check:untouched-rhythm` and `check:untouched-reading` fence earlier entries against `main`, and this entry deliberately touches their paths, so they will report it. They are not in CI. The plan should say so and treat their output as expected, as spec 003 did with the storage fence.
- `e2e/capture-surface.spec.ts`, `e2e/grouping-band.spec.ts`, `e2e/techniques-layout.spec.ts` and `e2e/rhythm-capture-height.spec.ts` pin the sizes and band behaviour this entry changes. In particular the band's two tests that spec 003 kept passing unedited (T068) measure a `justify-end` band, so FR-005 needs them re-read, not just re-pinned.
- `src/lib/reading/__tests__/frets-unchanged.test.ts` hashes the layout, which is how FR-063 stays honest if drawing changes stay on the screen side.
- The sync suite's known flake (spec 006, FU19) is not this entry's and can fail its runs. Do not lengthen a wait for it.

### Sources for the focus-zoom finding

- [Form fields under 16px: why iOS Safari zooms in when one is focused](https://docs.squirrelscan.com/rules/mobile/input-zoom)
- [Preventing iOS Textbox Auto Zooming and ViewPort Sizing](https://weblog.west-wind.com/posts/2023/Apr/17/Preventing-iOS-Textbox-Auto-Zooming-and-ViewPort-Sizing)
- [Disable auto zoom in input text tag, Safari on iPhone](https://backiee.wasmer.app/https_stackoverflow_com/questions/2989263/disable-auto-zoom-in-input-text-tag-safari-on-iphone)
