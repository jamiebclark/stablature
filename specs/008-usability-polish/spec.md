# Feature Specification: Usability polish: capture height, part card overflow, honest labels

**Feature Branch**: `008-usability-polish`

**Created**: 2026-11-12

**Status**: Draft

**Input**: User description: "Fix six specific problems found in a design review of every screen at phone and desktop size. This entry adds NO new musical capability, NO new event or part fields and NO migration. It changes layout, wording and where controls live." (full roadmap entry: `.specify/roadmaps/best-in-class.json`, entry `usability-polish`)

## Summary

A design review of every screen at phone and desktop size found six problems. None needs new data. Each is about layout, wording or where a control lives.

1. **Capture uses its height.** On a tall screen the tab band fills with earlier bars, wrapped at barlines, instead of leaving a quarter of the screen blank. The cursor's line stays nearest the neck. Where there is no spare height, nothing changes.
2. **Part cards stop shouting.** `+ variant`, Edit and a red Delete move behind one overflow button per card. The part's label becomes the one-tap way into editing it.
3. **An unnamed part reads as an invitation,** not as a name.
4. **The band list stops showing the slug.** It shows how many songs the band has instead.
5. **A signed-out user is not told `N unsynced`.** They are told their work is saved on this device and invited to sign in.
6. **The capture status line reads as separate facts,** not as one run-on phrase.

Nothing here changes a song. No field, table, migration, sync message or export changes.

### Where the brief and the code differ

The brief came from a visual review. The code adds detail, and this spec follows the code.

| The brief says | The code says | What this spec does |
|---|---|---|
| "adding at the end Dsus4 D G A whole note" is position, symbol, tones and **an armed latch** | `whole note` is the **duration of the column at the cursor** (`cursorDuration.words`). An armed latch *replaces* the position words. For example, `stacking onto the marked column` takes the place of `adding at the end`. | The status line has up to four facts: position **or** latches, chord, duration (or the waiting digit), and the jump buttons. See FR-030. |
| TopBar shows `{pending} unsynced` to a signed-out user | The top bar already says `N local` in the `signed-out` sync state. That state is set only when the server answers 401, and sync never starts without a session (`SyncProvider`). So a user who has never signed in never reaches it, and sees `N unsynced` for ever. | The wording follows whether there is a session, not the sync state. See FR-024 to FR-026. |
| Delete must keep "whatever confirmation or undo it has today" | **It has none.** One tap deletes the part (`deleteRow`). Spec 007 logged a confirm or undo as a new idea (A32). | Delete moves behind the overflow, which adds a step. No confirmation is added and none is taken away. The logged idea stays logged. See FR-014. |
| The rhythm row must keep working on wrapped capture lines | Capture draws **no** rhythm row today: `showRhythm` is off there. | Any row capture draws must hold on every line. This covers a rhythm row if `rhythm-notation` adds one. This entry adds none. See FR-006. |
| The column-reverse band is "the cause" | It is there on purpose. It keeps overflow on the side a swipe reaches (spec 007, FR-005, Option A). | The fix fills the band. It does not remove the reachable-overflow rule. See FR-004. |
| Moving Edit off the card may leave no one-tap route into the part | It would. The song page's Capture button opens the **most recent** part, not a chosen one. Edit is the only per-part route. | The part's label becomes that route. See FR-013. |
| Link the signed-out words to /sign-in | The top bar already has a `Sign in` link beside the sync word. | The top bar gets no second link. Its words sit next to the existing one. Capture has no top bar, so its short form is itself the link. See FR-025. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture uses the whole screen (Priority: P1)

A guitarist is capturing a riff on a Pixel 7. Today one staff line sits on the neck with a quarter of the screen blank above it. After this change the earlier bars fill that space on lines above, wrapped at barlines. The capturer sees what came before the note they are adding, and the line they are working on stays right above the neck.

**Why this priority**: It is the biggest waste in the app. It is on the screen the app exists for, and on most phones taller than 667px.

**Independent Test**: Open a six-string part of at least twelve bars at 412×915 with the cursor at the end. Measure the blank height in the band and confirm the cursor's line is the bottom one. Repeat at 375×667 and confirm the screen is unchanged.

**Acceptance Scenarios**:

1. **Given** a part long enough to fill the band at 412×915, **When** capture opens with the cursor at the end, **Then** the band shows the last bars on its bottom line and earlier bars on lines above it, broken at barlines, with less than one line's height blank.
2. **Given** that part, **When** a note is added at the end, **Then** it appears on the bottom line, and if it starts a new line, the band moves so the new line is the bottom one.
3. **Given** a six-string part with a chord row and a bracket at 375×667, **When** capture opens, **Then** the screen looks as it does today: one line that scrolls sideways, with every string, the chord row and the bracket row in view.
4. **Given** a wrapped band, **When** the capturer taps a column on a line above, **Then** the cursor moves there and the band does not move under the finger.
5. **Given** the cursor is on an upper line, **When** a key moves it, or a jump button or a note sends it somewhere, **Then** the band moves so the cursor's line is the bottom line.
6. **Given** a wrapped band, **When** the capturer taps a column, taps another on a different line to extend, groups the run and long-presses a column, **Then** each works as it does on one line: the selection shows on every line it covers, the new bracket is brought into view, and the inspector opens on the pressed column.
7. **Given** a desktop window of 1280×800, **When** capture opens on a long part, **Then** the band wraps across the window width and fills the height the same way.

---

### User Story 2 - Part cards stop shouting (Priority: P2)

A band member scrolls the song page on a phone. Each card shows its label, its name and its staff. Its actions wait behind one quiet button, so three red Deletes no longer sit down the screen.

**Why this priority**: It is the loudest thing on the song page and the most dangerous control on it. Later entries also need a place for their per-part controls.

**Independent Test**: Open a song with three parts at 375×667 and count red controls and visible Deletes. Then reach every action from the keyboard alone and with a screen reader.

**Acceptance Scenarios**:

1. **Given** a song with three parts, **When** the song page opens, **Then** no card shows a Delete, `+ variant` or Edit on its face, and nothing on a card's face is red.
2. **Given** a part card, **When** its overflow button is activated, **Then** a menu offers Edit, `+ variant` (not on a variant, as today) and Delete. Its accessible name names the part.
3. **Given** the menu is open, **When** the user presses Escape or taps outside it, **Then** it closes and focus returns to the overflow button.
4. **Given** a keyboard only, **When** the user tabs to a card's overflow button, opens it and moves through the items, **Then** every item can be reached and activated without a pointer.
5. **Given** a part card, **When** the user taps the part's label, **Then** capture opens on that part in one tap.
6. **Given** Delete is chosen from the menu, **When** it runs, **Then** the part is deleted exactly as today, and nothing deletes on the tap that opens the menu.

---

### User Story 3 - Say what is true about saving (Priority: P2)

Someone tries the app without an account. They capture a riff on their phone or their laptop. Instead of `14 unsynced`, which reads like a fault, the app says the work is saved on this device and offers to sign in.

**Why this priority**: A first-time user is told something alarming and false. They may leave, or distrust the app with real work.

**Independent Test**: Signed out, add notes and read the top bar and the capture header at 375×667 and 1280×800. Signed in and offline, add notes and confirm the count shows.

**Acceptance Scenarios**:

1. **Given** a signed-out user with local changes, **When** any page with the top bar opens, **Then** it says the work is saved on this device, next to the Sign in link, and shows no count of unsynced changes.
2. **Given** that user on capture, **When** the header is drawn at 375px with several parts and a long title, **Then** a short form is shown that links to sign-in, and the title keeps its 8ch floor.
3. **Given** a signed-in user with changes not yet pushed, **When** the top bar or capture header is drawn, **Then** it shows the count, as today.
4. **Given** a signed-out user with nothing waiting, **When** a page opens, **Then** no saving words are shown.
5. **Given** the app cannot yet tell whether there is a session, **When** a page is drawn, **Then** it does not tell a possibly signed-in user to sign in.

---

### User Story 4 - Read the capture status line at a glance (Priority: P2)

Mid-capture, the capturer glances at the status line. Instead of `stacking onto the marked column Dsus4 D G A whole note` they see separate facts: what the next note does, which chord, its notes, and the length at the cursor.

**Why this priority**: The line is read in a glance between notes, and today it parses as one phrase.

**Independent Test**: Run the status-row matrix from spec 007 at 375px, including stack armed with a chord active (F23). Check that each fact is a separate segment, the row is one line at 26px, and nothing that must be whole is cut.

**Acceptance Scenarios**:

1. **Given** the stack armed with `Dsus4` active, **When** the row is drawn at 375px, **Then** it shows `stacking onto the marked column`, then `Dsus4`, then its tones, as separate segments on one line, with both jump buttons.
2. **Given** a digit is waiting, **When** the row is drawn, **Then** the short position or latch words, the chord symbol and `fret 1…` each read as their own segment.
3. **Given** the triplet button refuses, **When** the row is drawn, **Then** the refusal reads whole and the chord symbol stays a separate segment.
4. **Given** a chord symbol the app cannot read, **When** the row is drawn, **Then** the symbol and `not a chord I know` read as one fact, apart from the position words.

---

### User Story 5 - An unnamed part invites a name (Priority: P3)

A part with no name says so in a way that looks like something to tap, not like a name somebody chose.

**Why this priority**: It is small, but it makes people read the card wrong.

**Independent Test**: Put a named and an unnamed part side by side in both themes, in greyscale, and confirm the difference shows without colour.

**Acceptance Scenarios**:

1. **Given** an unnamed part, **When** the card is drawn, **Then** the empty name is visibly a control to add a name, and looks different from a real name in shape or glyph, not only in colour.
2. **Given** that control, **When** it is tapped, **Then** renaming opens exactly as today.

---

### User Story 6 - The band list shows what a member cares about (Priority: P3)

The bands page lists each band by name with its number of songs, not its URL slug.

**Why this priority**: It is a small cleanup. The slug is plumbing a band member never needs.

**Independent Test**: Open the bands page with a band of three songs and a band with none.

**Acceptance Scenarios**:

1. **Given** a band with three songs on this device, **When** the list is drawn, **Then** it reads the band's name and `3 songs`, and no slug.
2. **Given** a band with no songs, **When** the list is drawn, **Then** it reads `No songs yet`.

---

### Edge Cases

- **Exactly one line fits.** The band shows today's single line, which scrolls sideways. It does not show one wrapped line. Wrapping starts only when two whole lines fit (FR-002).
- **Seven strings, or a screen shorter than 667px.** One line, overflow reachable by a swipe, as spec 007 left it.
- **The chord form opens, or the on-screen keyboard rises.** The band loses height. If fewer than two lines then fit, it goes back to one line, and the cursor stays in view. When the form closes it wraps again. The cursor and any selection survive both changes.
- **Rotating, or resizing a desktop window.** Lines are worked out again for the new size. The cursor's line ends up as the bottom line.
- **The cursor at the start of a long part.** The first line is the bottom line. The blank above it is honest, because nothing comes before it. Later lines are a swipe down.
- **A short part with spare height.** Every line shows, and the leftover height stays above the top line.
- **A bar wider than a line.** It takes a line of its own, and only that line scrolls sideways, as on the play view (spec 007, FR-056). `followTail` and the caret keep the cursor's column in view on that line.
- **The caret after the last column of a line, or before the first column of the part.** It is drawn on the line that holds its column. It is never drawn at the start of the next line.
- **A selection across a line break.** The selection band shows on each line it covers. Extending to a column on another line works the same as on one line.
- **A group and a line break.** A group cannot cross one: groups do not cross barlines, and lines break only at barlines.
- **A chord whose label widens its column.** The label stays whole on every line (spec 007, FR-024). Line breaks use the widened widths.
- **A note inserted mid-part.** Later lines may reflow. The cursor's line stays the bottom line after the write.
- **Twelve parts and a long title, signed out.** The short saving form fits beside the chips. The title keeps 8ch and the open chip stays in view.
- **A signed-in user offline in a rehearsal room.** The app cannot check the session. It shows the count as today, and never says sign in (FR-026).
- **Signed out, after a server refusal.** Today this says `N local`. It now uses the same signed-out words.
- **A sync error message.** It is shown as today, before any saving words.
- **Two menus.** Opening one card's menu closes any other.
- **The menu near the bottom of the screen.** It opens where all of it can be seen. No item sits under the bottom bar or off the screen.
- **Printing.** The overflow button and menu do not print, as the action buttons do not today.
- **An empty name is whitespace.** Renaming already stores an empty name as none, so whitespace shows the invitation.
- **A band whose songs have not synced to this device.** The count is what this device holds. That is true, and it fills in as songs arrive.

## Requirements *(mandatory)*

### Functional Requirements

**Capture: the band fills its height**

- **FR-001**: The capture band MUST use its spare height to show more of the part. Earlier bars go on lines above the cursor's line, broken at barlines, and every line spans the band's width.
- **FR-002**: Whether the band wraps MUST depend on the height it actually has, not on a breakpoint, a device class or a string count. It wraps only when at least two whole lines, at their full drawn height, fit. Otherwise it MUST show today's single line, which scrolls sideways.
- **FR-003**: Where the band does not wrap (where two whole lines do not fit), the capture screen MUST look exactly as it does today, pixel for pixel. The deciding case is 375×667 with six strings, a chord row and a bracket. Spec 003 FR-020, SC-009 and INV-013, as amended by spec 007, MUST still hold. `e2e/usability-height-budget.spec.ts` and `e2e/usability-staves.spec.ts` are re-pinned per line, weakening nothing, because a four-string part wraps at 375×667 (plan.md Deviation 8; amended by decision of 2026-11-12).
- **FR-004**: At rest, the line holding the cursor MUST be the band's bottom line, nearest the neck. No line is shown below it at rest, and later lines are reachable by a swipe. Spec 007 FR-005 still holds: whatever does not fit is reachable by a swipe, and nothing sits above the scroll origin.
- **FR-005**: The band MUST bring the cursor's line to the bottom when a note is added, when a key moves the cursor, when a jump button is used, and when capture opens or the part changes. A tap on a column MUST NOT move the band, and neither may starting or extending a selection (spec 007, FR-008).
- **FR-006**: On wrapped lines, everything capture relies on MUST work as it does on one line: the caret and the insert-after mark, `followTail`, `keepCaretInView`, `revealGroups`, tap-to-select, tap-to-extend across lines, the long-press column inspector, the chord row, the group bracket row, and any rhythm row capture draws. Each row MUST be present and aligned on every line whenever the part has it.
- **FR-007**: Line breaks MUST stay put while the content and the band's width do not change. Moving the cursor or selecting MUST NOT reflow lines.
- **FR-008**: Wrapping MUST NOT make a fret tap any slower to show its note. Spec 001 to 007's timing and capture tests MUST pass.
- **FR-009**: This applies to desktop capture as it does to phones. The fine-pointer sizes from spec 007 FR-023 apply.
- **FR-010**: Capture MUST NOT gain bar numbers (spec 007, FR-048 stands). The song page and the play view MUST NOT change width, line packing or how many staves sit side by side.
- **FR-011**: The band's height MUST be measured before and after at 375×667, 390×844, 412×915 and 1280×800, with six strings, a chord row and a bracket, and recorded in `docs/DECISIONS.md`. The figures are: band height, line height, lines shown, and the blank height at rest.

**Part cards**

- **FR-012**: Each part card MUST show one overflow button in place of `+ variant`, Edit and Delete. Its accessible name MUST name the part by label, and by name when it has one. On touch its target MUST be at least 44×44px, and on a mouse it meets spec 007's floors table.
- **FR-013**: The part's label MUST become a one-tap way to open that part in capture. It MUST show this without hover, with a visible edit cue. Its accessible name MUST say it edits that part, and on touch its target MUST be at least 44px tall. Edit also stays in the menu.
- **FR-014**: The menu MUST hold Edit, `+ variant` (only where the card offers it today) and Delete, in that order. Delete MUST be kept apart from the other items by a divider and at least 8px (spec 007, FR-014). Delete MAY be red inside the menu, and MUST carry its icon and word, so colour is never the only cue. Delete MUST do exactly what it does today. No confirmation or undo exists today, and this entry neither adds nor removes one.
- **FR-015**: Nothing on a card's face MUST use the danger style.
- **FR-016**: The menu MUST close on Escape, on a tap or click outside it, and after an item runs. Escape and outside closes MUST return focus to the overflow button. The menu MUST be fully usable by keyboard: open with Enter or Space, move with arrow keys, reach every item, and close with Escape. Screen readers MUST hear it as a menu with named items. At most one menu is open at a time.
- **FR-017**: Each menu item MUST meet the touch floor, at least 44px tall. The open menu MUST be wholly on screen and not under the song page's bottom bar. It MUST NOT print.
- **FR-018**: Tests that press `+ variant`, Edit or `Delete part A` on the card MUST be routed through the menu by a shared helper. None may be deleted or weakened. Each is named in `docs/DECISIONS.md`.

**An unnamed part**

- **FR-019**: An unnamed part MUST show an invitation to name it, and MUST NOT show a name-styled placeholder. It MUST differ from a real name by at least one cue that is not colour, such as a glyph or a dashed outline or underline. Its text MUST reach 4.5:1 in both themes on the card's surface. Its accessible name MUST say what it does, for example "Name part A".
- **FR-020**: Activating the invitation MUST open renaming exactly as today.

**The band list**

- **FR-021**: The bands list MUST NOT show a band's slug. Slugs stay in the data and the URLs.
- **FR-022**: Under each band's name, the list MUST show how many songs that band has on this device, not counting deleted songs. It reads `1 song`, `N songs` or `No songs yet`. It reads only local data and makes no request.
- **FR-023**: The slug-uniqueness defect (spec 007, FU31) MUST NOT be touched by this entry.

**Saving words**

- **FR-024**: When the app knows the user is signed out and has local changes, the top bar and the capture header MUST say the work is saved on this device. They MUST NOT show a count or the word "unsynced". The words MUST be true on any device: no "phone" and no "laptop". "Knows" means the session check finished with no session, or the server refused sync as signed out.
- **FR-025**: In the top bar, the words MUST sit next to the existing Sign in link, and no second link is added. In the capture header, a short form MUST itself link to /sign-in. It MUST fit in no more width than `99 unsynced` takes today, with the same text size. It MUST NOT reduce the title's 8ch floor or push the open chip out of view (spec 007, FR-001 and the usability-pass follow-ups). It MUST meet spec 007's target floors. Its accessible name MUST carry the full meaning: saved on this device, and sign in to sync with the band.
- **FR-026**: A signed-in user with changes not yet pushed MUST see a count, as today. While the app cannot tell whether there is a session (the check has not finished, or it failed because there is no signal), it MUST NOT invite the user to sign in. It shows the count, as today.
- **FR-027**: A sync error message MUST keep showing as today, and it takes precedence over the saving words. With nothing waiting, no saving words are shown in any state.
- **FR-028**: `e2e/grouping-queued-row.spec.ts`, which waits for no `N unsynced` text, MUST be updated, not deleted. Its quiet-state wait MUST also check that the signed-out words are absent, so that it cannot pass on a page that only lost the count. `e2e/capture-matrix.spec.ts` (FR-001, `N unsynced`) and `e2e/rhythm-capture-height.spec.ts` (INV-009) MUST be re-pinned to the new short form where they run signed out. Each is named in `docs/DECISIONS.md`.

**The capture status line**

- **FR-029**: The status line MUST present each fact as its own segment, visibly apart from its neighbours by a separator, by weight and, where a fact could be mistaken for another, by a short label. The separation MUST NOT rely on colour alone. The segments are:
  - position, or the armed latches, or the triplet refusal;
  - the chord, as a symbol with its tones, or a symbol with `not a chord I know`;
  - the duration at the cursor, or the waiting digit;
  - the two jump buttons.
- **FR-030**: Within the chord segment, the symbol MUST be told apart from its tones without colour, for example by weight. A screen reader MUST hear the facts apart, for example "Dsus4 chord: D, G, A", and separators are not read aloud.
- **FR-031**: The row MUST stay one line at `--status-row` (26px) in every state and MUST NOT wrap. At 375px the position or latch words, the triplet refusal and a chord symbol of up to ten characters MUST be whole, and both jump buttons present at their floors. When room runs out, the tones give way first, then the duration, each shown as cut. This amends spec 007 FR-026, which named only the tones.
- **FR-032**: The words MUST NOT change. "stacking onto the marked column" stays exact (spec 001, FR-007), stack plus a transition still says both (spec 002, FR-023), and duration words stay words. The short forms used while a digit waits, the triplet refusal and `not a chord I know` MUST all still read as their own facts.
- **FR-033**: `e2e/usability-status-row.spec.ts`'s matrix MUST pass, including stack armed with a chord active (the F23 case), with the separation added to what it checks.

**Checks, amendments and scope**

- **FR-034**: Every changed screen MUST be looked at in a browser at actual size at 375×667, 390×844, 412×915 and 1280×800, in light and dark, as `docs/DECISIONS.md` requires. The two documented traps apply. If a style change seems to do nothing, run `npm run dev:clean` first. A tier is never expressed as opacity over a surface token.
- **FR-035**: Every requirement of an earlier spec that this entry changes MUST be amended in place with an `Amended by spec 008` note on its own line, and listed in `docs/DECISIONS.md` with before and after. At least these:
  - spec 007 FR-056 ("capture … stay as they are"): capture now wraps when two whole lines fit;
  - spec 007 FR-001 ("the sync word when something is unsynced"): the signed-out short form;
  - spec 007 FR-026: the duration may give way after the tones;
  - spec 007 Out of Scope, "Wrapping … capture".
  
  `npm run check:usability-amendments` MUST still pass. A check run the same way MUST pin this entry's own amendments.
- **FR-036**: A test that pins a size, position or label that this entry changes MUST change with the requirement it pins, and be named in `docs/DECISIONS.md`. None may be deleted to pass.
- **FR-037**: This entry MUST NOT change any stored field, table, migration, sync message, wire format, storage path or the text export. It adds no audio, no notation symbols, no voice memos and no change to the song page's or play view's layout.

### Key Entities

- **Wrapped line**: a run of whole bars that fits the band's width. It is derived from the part and the width, and never stored.
- **Sign-in knowledge**: signed in, signed out, or not known. It is derived from the session check and sync's answer, and never stored.
- **Song count**: the number of a band's songs on this device. It is derived from local data, and never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At 412×915 with six strings, a chord row, a bracket and the cursor at the end of a twelve-bar part, the blank height in the band at rest is less than one staff line. Today it is about a quarter of the screen. The before and after figures are recorded.
- **SC-002**: At 375×667 with six strings, a chord row and a bracket, the capture screen matches today's in every row's height and in the staff's markup. The spec 007 height tests pass unedited.
- **SC-003**: At 390×844, 412×915 and 1280×800, the band shows at least two lines whenever the part has that many, with the cursor's line at the bottom in 100% of the trials: at the end, after a key move, after a jump and after a part switch.
- **SC-004**: On wrapped lines, every capture interaction in FR-006 passes the same tests it passes on one line, and a tap never moves the band.
- **SC-005**: On the song page at 375×667 with three parts, the card faces show 0 Deletes and 0 red controls, down from 3 and 3. Every card action is reachable in two taps or fewer, and editing a part takes one.
- **SC-006**: Using only a keyboard, each card's menu opens, reaches every item, and closes with Escape, with focus back on its button. This is checked for every card.
- **SC-007**: Signed out, with local changes, the word "unsynced" and a change count appear 0 times on any screen at any of the four sizes. Signed in, the count appears whenever changes are pending.
- **SC-008**: The bands list shows 0 slugs, and each band shows its song count.
- **SC-009**: Across the status-row matrix at 375px, the row is one line at 26px in every state. The words and symbols that must be whole are whole, and adjacent facts are separated by something other than colour.
- **SC-010**: An unnamed part's invitation is told from a real name in a greyscale screenshot, in both themes.
- **SC-011**: The diff of the storage, sync, schema, wire and export paths is empty.
- **SC-012**: Every screen this entry changes has been checked in a browser at the four sizes in both themes, with findings recorded.

### Owed to a real phone

A desktop browser cannot prove these. Each goes in `tasks.md` as a human item and stays open until done.

- A tap outside the open menu closes it on iOS Safari and Android Chrome, and does not also act on what was under it.
- On a real phone, the capture band moves its line to the bottom without a visible jump under a thumb that is resting on the neck.
- The wrapped band on a phone browser with its bars showing, where the height is between one and two lines.

## Decisions made for this spec

Made without waiting, as agreed, so they can be overturned at review. **Worth your eye** marks the ones I am least sure about.

- **The cursor's line is always the bottom line at rest. Later lines are a swipe down, not shown below it (worth your eye).** The brief asks for both "the cursor's line nearest the fretboard" and "later bars too when the cursor is mid-part". They conflict only when the cursor is near the start of a long part. I kept the cursor by the neck, because the brief says that is where the eyes are. Later bars still show on the cursor's own line, after its bar. The alternative fills the space below with later lines when there are too few earlier ones. That costs the neck distance in exactly the case of going back to fix the start of a part.
- **One line, not one wrapped line, when only one fits.** A single wrapped line shows a different stretch of bars from today's sideways-scrolled line, so the "exactly as today" rule would fail. Wrapping starts at two whole lines.
- **A tap never moves the band.** Pinning the cursor's line to the bottom on a tap would scroll the column away from under the finger that chose it, and break tap-to-extend across lines. The band re-anchors on writes, keys, jumps and part changes.
- **The part's label is the one-tap route into editing.** The staff was the other option. It already scrolls sideways and is read on the song page, so making it a link would fight both. Edit stays in the menu too, for anyone who looks there.
- **No confirmation is added to Delete.** The brief says keep what exists, and today nothing does. The menu adds a step. A real confirm or undo stays the idea spec 007 logged (A32).
- **The band list shows song counts.** They are on the device, true, and what a member scans for. "Last edited" was the alternative, but songs carry no edit time a person would trust across devices.
- **"Not known" shows the count, not the sign-in invitation (worth your eye).** Offline, a signed-in user's session cannot be checked. Telling them to sign in during rehearsal would be the same false alarm in a new form. The cost is that a signed-out user who is also offline sees the count, which is what they see today.
- **The top bar gets no second Sign in link.** The words sit beside the one that is there.
- **The duration may give way after the tones.** The code already lets it, and spec 007 FR-026 did not say so. The amendment makes the requirement match.
- **This stays one entry,** though the template warns against bundling. The roadmap defines it as one polish pass, and later entries depend on two of its parts: wrapped capture and the card overflow. US-1 is the one that must land. **Worth your eye:** US-1 touches the most tested surface in the app, so expect it to take most of the review rounds.

## Out of Scope

- Stems, flags, beams or note symbols (entry `rhythm-notation`).
- The song page's or play view's width, line packing, or staves side by side (entry `wide-reading-layout`). Wrapping is added to capture only.
- Any audio beyond the existing click (entry `tab-playback`).
- Voice memos or the microphone (entry `voice-memos`).
- Sync, storage, the wire protocol and the text export.
- Slug uniqueness (spec 007, FU31).
- Bar numbers in capture.

### New roadmap ideas, logged not built

- **Undo for deleting a part** (still A32 from spec 007).
- **Bar numbers on wrapped capture lines,** if the height allows once `rhythm-notation` settles the staff's height.

## Assumptions

- 375×667, 390×844 and 412×915 stand for small, common and tall phones, and 1280×800 for a laptop.
- A user who has never signed in is the main signed-out case. Signing out on a shared device is the other.
- The song count on this device is good enough for the band list, even before sync has delivered everything.
- The menu follows the usual menu-button pattern for keyboard and screen reader use.

### Dependencies

- `e2e/usability-height-budget.spec.ts`, `e2e/usability-status-row.spec.ts`, `e2e/capture-matrix.spec.ts`, `e2e/rhythm-capture-height.spec.ts`, `e2e/grouping-band.spec.ts` and `e2e/capture-surface.spec.ts` pin the band, the header and the status row. The first is re-pinned per line (FR-003 as amended). The others change only as FR-028, FR-033 and FR-036 allow.
- These press card actions directly and need the menu helper (FR-018): `capture.spec.ts`, `capture-surface.spec.ts`, `grouping.spec.ts`, `reading-sync.spec.ts`, `sync-no-lost-rows.spec.ts`, `usability-toolbars.spec.ts`, `variant-marks.spec.ts` and `variant-marks-paint.spec.ts`.
- `check:usability-amendments` checks spec 007's amendments and must keep passing.
- The sync suite's known flake (spec 006, FU19) and `durations.spec.ts:7` under full-suite load are not this entry's. Do not lengthen a wait for them.
