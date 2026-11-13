# Feature Specification: Rhythm notation under the tab

**Feature Branch**: `009-rhythm-notation`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "Replace the letters that stand in for rhythm with real rhythm notation, everywhere a staff is drawn and on the controls that set a duration." (full roadmap entry: `.specify/roadmaps/best-in-class.json`, entry `rhythm-notation`)

## Summary

Today a duration reads as a letter. Under the tab a reader sees `q q 8 8 8`, and the inspector's six duration buttons read `w h q 8 16 32`. This entry draws rhythm the way tab-with-rhythm is printed:

1. **Stems, flags and beams under the tab.** Every column with a duration gets a stem. A lone eighth, sixteenth or thirty-second gets one, two or three flags. Runs of them inside one beat are joined by beams. Half and whole notes have their own shapes, so all six durations are told apart.
2. **Rest symbols** for rests that have a duration.
3. **Group brackets with the rhythm.** On a staff that draws rhythm, each group's bracket and number sit under the tab with the beams. On a staff with no rhythm, they stay in the row above the staff, exactly as today.
4. **Note symbols on the duration buttons,** in place of the letters.
5. **Capture draws rhythm too.** Until now it was barred from doing so for lack of height (spec 005 FR-016). Moving the brackets under the tab pays for it.

Nothing about a song changes. No field, migration, sync message, export or import changes. A part with no durations, which is still the common case, draws exactly as it does today on every surface.

### Where the brief and the code differ

| The brief says | The code says | What this spec does |
|---|---|---|
| Rhythm is drawn on "the capture screen, including the wrapped lines" | Capture draws **no** rhythm row. Spec 005 FR-016 forbids it ("It has no height to give"), and `showRhythm` is off there. | Capture draws the rhythm row whenever its part has a duration. FR-016 is amended in place, and the height is paid for by FR-018. |
| Rhythm is drawn on "the paste-tab preview" | The parser never sets a duration (spec 005 FR-017: pasted text imports with none). A pasted draft therefore never has one. | The preview follows the same rule as every other surface. Because no pasted draft has a duration, the preview draws no rhythm row today and looks exactly as it does now. FR-024 says so, so that no one reads an unchanged preview as a missing feature. |
| "Beat boundaries come from the ticks `readNotation`/`notationColumns` already computes" | `notationColumns` stops at the **first bar of the pass that cannot be timed**. One unset column in bar 1 would leave every later bar with no ticks, so it would have no beams. | Beat positions use the reader's own arithmetic (durations, group fractions, beats counted from the bar's start), applied bar by bar. A bar that cannot be timed does not stop beaming in the bars after it. See FR-005 and FR-006. |
| "The play view, wrapped and unwrapped" | The play view always wraps on screen. The unwrapped staff is the song page's (and capture's single line). | Every layout each surface has is covered: capture's single line and its wrapped lines, the song page's single line, the play view's wrapped lines, the preview, and print. |
| "A group containing a `repeat` column" | A **counted** group with a repeated column does not read: it gets no fraction, and its bar cannot be timed. A **plain** group with one reads normally. | Both cases are specified and tested (FR-011, edge cases). |
| "If `usability-polish` left duration words in the capture status line, decide…" | It did: the status line shows `quarter note` and so on for the column at the cursor (spec 005 FR-012, spec 008 FR-029 and FR-032). | The words stay. See Decisions. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read rhythm at a glance on the song page and in the play view (Priority: P1)

A bassist opens a song on a music stand and switches to the play view. Today, under each note, there is a letter or number they have to translate. After this change, the stems, flags and beams look the way rhythm is printed in tab books. Eighths that share a beat are beamed in pairs, a lone sixteenth has two flags, and a rest shows its rest symbol. They read the groove without decoding anything.

**Why this priority**: Reading is where rhythm is used most, and it is where the letters cost the most. The song page and play view already draw a rhythm row, so this story is the core of the entry.

**Independent Test**: Make a part with bars that hold four quarters; eight eighths; a sixteenth, an eighth and a sixteenth in one beat; an eighth rest and an eighth; one half and two quarters; and one whole. Open it on the song page and in the play view at 375×667 and 1280×800 in both themes. Confirm the stems, flags, beams and rests match standard tab-with-rhythm reading, and that every symbol is told apart in a greyscale screenshot.

**Acceptance Scenarios**:

1. **Given** a bar of eight eighth notes, **When** it is drawn, **Then** each note has a stem, and the notes are beamed in four pairs, one per beat. No beam crosses from one beat into the next.
2. **Given** a beat holding a sixteenth, an eighth and a sixteenth, **When** it is drawn, **Then** the three are joined by one beam. Each sixteenth also has a second beam, as a short stub where its neighbour has only one.
3. **Given** an eighth note alone in its beat (its neighbours are quarters, rests, unset columns or barlines), **When** it is drawn, **Then** it has one flag and no beam. A lone sixteenth has two flags and a lone thirty-second has three.
4. **Given** a half note and a whole note, **When** they are drawn, **Then** the half note has a stem half as long as a quarter note's, and the whole note has a small open oval with no stem. Neither can be mistaken for a quarter note or for a column with no duration.
5. **Given** a rest with a duration, **When** it is drawn, **Then** it shows the standard rest symbol for that duration. The whole and half rests are told apart from each other by their short reference line.
6. **Given** two eighths, then a barline, then two more eighths, **When** drawn, **Then** two beams are drawn, one in each bar. No beam crosses the barline.
7. **Given** any part, **When** the view control is switched between frets, note names and intervals (which changes column widths), **Then** every stem stays under its note's centre and every beam stays attached to its stems.
8. **Given** a part with no durations at all, **When** it is drawn on any surface, **Then** there is no rhythm row and nothing on the screen differs from today.

---

### User Story 2 - See tuplets and groups with their rhythm (Priority: P1)

A guitarist has a triplet of eighths and a plain group of four sixteenths. Today the triplet's `3` and both brackets sit in a row above the staff, and the letters `8 8 8` sit in a row below it, so the eye has to join the two. After this change, the triplet is beamed as one unit with its bracket and `3` directly under the beams. The plain group's bracket sits under its beams with no number.

**Why this priority**: A tuplet is rhythm. Drawing its number apart from its notes is the one place the old layout reads wrong, not just slowly. Moving the brackets is also what gives capture the height for rhythm (Story 3).

**Independent Test**: Draw a part with durations that holds: a counted triplet of eighths; a counted group of five sixteenths; a plain group of four sixteenths; a counted group that ends at a barline; and a plain group containing a repeated column. Confirm each group's bracket is under the tab, each counted group's number appears exactly once, and no beam runs past a group's edge. Then remove every duration and confirm the brackets are back in the row above the staff, exactly as today.

**Acceptance Scenarios**:

1. **Given** a counted triplet of eighths on a staff with durations, **When** drawn, **Then** the three notes are beamed as one unit, with a bracket under them and the number 3 drawn once, under the tab. No bracket row is drawn above the staff.
2. **Given** a plain group of sixteenths, **When** drawn, **Then** its notes are beamed by beat inside the group, and it has a bracket under the tab with no number.
3. **Given** an eighth note immediately before a group and another immediately after it, in the same beat, **When** drawn, **Then** neither is beamed into the group. Beams stop at the group's edges.
4. **Given** a staff with no durations and a group, **When** drawn, **Then** the bracket and its number are in the row above the staff, exactly as today.
5. **Given** a counted group that is still being built (its number is larger than the columns it holds), **When** drawn, **Then** its bracket stays open on the right as today, its number is drawn once, and its notes are not beamed, because the group does not yet read.

---

### User Story 3 - See the rhythm while capturing (Priority: P2)

A guitarist captures a riff on a phone and sets durations as they go. Today, once they leave a column, the only sign of a duration is the status line's words for the column at the cursor. After this change, the capture staff draws the same rhythm as the song page. They can see straight away that a beat holds three sixteenths, not four, without moving the cursor along to check.

**Why this priority**: It turns a write-only setting into something you can see. It comes after Stories 1 and 2 because it depends on them, and because the capture height budget limits how it is drawn.

**Independent Test**: At 375×667 on a touch device, open a six-string part with a chord row, a counted group and durations on some columns. Confirm every string, the chord row and the whole rhythm row (bracket and number included) are in view, the page does not scroll, and the band is at least 189px tall. Repeat on a four-string part, which wraps, and confirm the rhythm row is on every line.

**Acceptance Scenarios**:

1. **Given** a capture part with no durations, **When** the first duration is set, **Then** the rhythm row appears under the staff, any group brackets move under the tab with it, and every string stays in view at 375×667.
2. **Given** a capture part with durations, **When** the last duration is cleared, **Then** the rhythm row goes away and the brackets return to the row above the staff, exactly as today.
3. **Given** wrapped capture lines, **When** the part has durations, **Then** each line draws its own rhythm row, aligned with its columns, and beams never run from one line to the next.
4. **Given** a selected or cursor column, **When** it has a duration, **Then** its symbol takes the selection's text colour, as the bracket does today.
5. **Given** the capturer creates a new group, **When** it appears under the tab, **Then** it is brought into view as a new bracket is today.

---

### User Story 4 - Pick a duration by its symbol (Priority: P2)

A capturer long-presses a column, and the inspector's duration row shows six note symbols (whole, half, quarter, eighth, sixteenth, thirty-second) instead of `w h q 8 16 32`. Someone who reads music finds the eighth note by sight. Someone who does not hears or sees its name in words.

**Why this priority**: It is a small, separate change on one control. It is worth doing with the staff so that the two speak the same language.

**Independent Test**: At 375×667 on touch and at 1280×800 with a mouse, open the inspector on a column. Confirm the six buttons show note symbols on one line, are each at least 54×44 on touch and meet spec 007's fine-pointer floor on a mouse, are named in words to a screen reader and in their title, and that the lit position is visible in both themes and in greyscale.

**Acceptance Scenarios**:

1. **Given** the column inspector, **When** it opens, **Then** the duration row shows six note symbols on one line, in the order whole, half, quarter, eighth, sixteenth, thirty-second.
2. **Given** a screen reader, **When** focus reaches a duration button, **Then** it is announced in words ("quarter note") with its pressed state. Hovering it with a mouse shows the same words as a title.
3. **Given** the column's duration, **When** the inspector opens, **Then** that symbol's button is lit. Tapping it clears the duration, and tapping another sets that one, as today.

---

### Edge Cases

- **A column with no duration among ones that have one.** It draws nothing in the rhythm row, and no beam spans it. A beam on either side ends at the column next to it.
- **A column whose position in its bar cannot be known.** It follows an unset column in its bar, or it is in or after a group that does not read. It still gets its stem and flags, but it is beamed to nothing, because which beat it falls in is unknown.
- **A note that straddles a beat.** For example, a quarter that starts halfway through a beat. Beaming looks only at where each beamable note starts. Two notes beam together only if both start in the same beat.
- **A bar that is not a whole number of beats** (for example, three eighths). Beats are counted from the bar's start, and its last, partial beat beams within itself. No time signature is assumed or added.
- **A repeated column, expanded.** Each hit is its own layout column, and the hits beam by beat like separate notes, inside the bar and group rules.
- **A repeated column, compact** (`7x8`). One layout column stands for every hit, so it draws one stem with the flags of its own duration. It is never beamed to its neighbours, because a single beamed stem cannot say that it stands for eight hits. The `x8` in its cells already says that. The columns after it still sit on the right beats, because their positions count every hit.
- **A plain group with a repeated column.** It reads, and its hits beam by beat inside the group's edges (expanded) or draw one flagged stem (compact).
- **A counted group with a repeated column.** It does not read (spec 005), so its bar cannot be timed from that group on. Its notes get stems and flags but no beams. Its bracket and number are still drawn, once.
- **A group next to a barline.** The bracket and any beam end at the group's last column. The barline breaks nothing that the group's edge has not already broken.
- **A rest inside a counted group.** It is under the bracket, it breaks the beam, and the number is still drawn once.
- **A rest with no duration.** It draws nothing in the rhythm row, as today.
- **An unknown stored duration value.** It reads as unset everywhere (spec 005), so it draws nothing and breaks beams.
- **A connector gap** (a slide or hammer between two columns), **or a variant's removal gap,** between two beamed notes. The beam runs through the gap unbroken, as the bracket does today.
- **A chord symbol that widens a column.** The stem stays under the note's centre in the widened column, and the beam stretches to reach it.
- **Print, where one bar is wider than the page and wraps.** Each piece of a beam stays attached to the stems on its own line. No beam is drawn across the page to the next line.
- **The first duration set in capture.** The rhythm row appears and any brackets move from above the staff to under it, so the strings shift up by the old bracket row's height. This happens once, when the part goes from no durations to some, and the reverse happens when the last duration is cleared. It is accepted (see Decisions).
- **Dark theme, light theme, print.** Every symbol is drawn in the theme's text colour at full opacity. Print uses its own text colour, as today.

## Requirements *(mandatory)*

### Functional Requirements

**What is drawn**

- **FR-001**: On every staff that draws a rhythm row, each column with a duration MUST show a rhythm symbol centred under its note. The shapes are:
  - **Whole**: a small open oval with no stem.
  - **Half**: a stem half the length of a quarter's.
  - **Quarter**: a full stem.
  - **Eighth, sixteenth, thirty-second**: a full stem with one, two or three flags when alone, or that many beams when beamed.

  All six MUST be told apart from each other, and from a column with no duration, without colour.
- **FR-002**: A rest with a duration MUST show the standard rest symbol for that duration. The whole and half rests MUST be told apart by a short reference line (the whole rest hangs below it, and the half rest sits on it). All six rests MUST be told apart from each other and from every note symbol.
- **FR-003**: A column with no duration, an unknown stored value, a barline, or a rest with no duration MUST draw nothing in the rhythm row.

**Beaming**

- **FR-004**: Consecutive eighths, sixteenths and thirty-seconds MUST be joined by beams when they start in the same beat of the same bar. Each note carries as many beams as it would have flags. Where a neighbour in the run has fewer, the extra beam MUST be drawn as a short stub inside the run.
- **FR-005**: A beat MUST be one quarter-note's length, counted from the start of the bar the column is in. The beats MUST come from the same tick arithmetic the notation reader and the click already use: the six durations, a counted group's fraction, and every hit of a repeated column. No time signature is read, assumed or added, and no bar length is used.
- **FR-006**: A bar's beaming MUST depend only on that bar. An earlier bar that cannot be timed MUST NOT stop later bars from beaming.
- **FR-007**: A beam MUST NOT cross any of the following:
  - a barline;
  - a rest;
  - a column with no duration;
  - a quarter, half or whole note;
  - the first or last column of a group, plain or counted, in either direction;
  - the break between two wrapped lines.
- **FR-008**: A note whose position in its bar cannot be known MUST NOT be beamed. Such a note follows an unset column in that bar, or is in or after a group in that bar that does not read. It keeps its stem and flags.
- **FR-009**: Inside a counted group that reads, the beamable notes MUST be beamed as one unit, with no break at the beats inside the group. They break only at a rest, an unset column or a longer note, as FR-007 lists. Inside a plain group, notes MUST be beamed by beat as anywhere else, within the group's edges.
- **FR-010**: In expanded density, each hit of a repeated column MUST be drawn and beamed as its own note. In compact density, a repeated column MUST draw one stem with its own duration's flags, and MUST NOT be beamed to any neighbour. In both densities, the columns after it MUST fall on the same beats, because their positions count every hit.
- **FR-011**: A plain group holding a repeated column MUST beam as FR-009 and FR-010 say. A counted group holding a repeated column does not read (spec 005), so its notes MUST be drawn with stems and flags only, and its bracket and number MUST still be drawn once.

**Group brackets**

- **FR-012**: On a staff that draws a rhythm row, every group's bracket MUST be drawn under the tab with the rhythm, below the stems and beams, and the row above the staff that holds brackets MUST NOT be drawn. A counted group's number MUST be drawn on its bracket, once. A plain group's bracket MUST have no number.
- **FR-013**: On a staff that draws no rhythm row, brackets and numbers MUST be drawn in the row above the staff, exactly as today.
- **FR-014**: On any staff, a group's number MUST be drawn at most once.
- **FR-015**: Wherever a bracket is drawn, everything spec 003 and spec 007 require of brackets today MUST still hold. That covers:
  - plain and counted groups sharing one row;
  - an open right end on a group still being built;
  - the line running across connector and removal gaps;
  - the selection's text colour on a selected column;
  - a newly made group being brought into view;
  - the bracket on every wrapped line it covers.

**Alignment**

- **FR-016**: Every stem and every rest or whole-note symbol MUST be centred on its note's centre, as the 007 marks are. That MUST hold:
  - in a column a chord symbol has widened;
  - in frets, note names and intervals view;
  - in compact and expanded density;
  - on single and wrapped lines.
- **FR-017**: Every beam MUST start and end on the stems it joins. That MUST hold for columns of unequal width, across connector and removal gaps, and when the view control changes cell widths, with no reload.

**Height**

- **FR-018**: At 375×667 on a touch device, a capture part of four, five or six strings MUST keep every string in view, together with:
  - a chord row;
  - a group;
  - durations, with the whole rhythm row, bracket and number included.

  The page MUST NOT scroll, and the band MUST stay at least 189px tall. The rhythm row MUST fit in the height the bracket row frees. If it cannot, the extra height MUST come from somewhere named, be measured before and after, and be recorded in `docs/DECISIONS.md`. Any earlier requirement that changes MUST be amended in place.
- **FR-019**: A part with no durations MUST draw no rhythm row on any surface. Its staff MUST be identical to today's: the same rows, the same heights and the same markup.
- **FR-020**: On the song page and in the play view, a staff with durations MUST NOT be taller than it is today with both its bracket row and its rhythm row (two staff rows).

**Surfaces**

- **FR-021**: Capture MUST draw the rhythm row whenever its part has a duration, on its single line and on every wrapped line. This amends spec 005 FR-016.
- **FR-022**: The song page MUST draw rhythm notation in both densities.
- **FR-023**: The play view MUST draw rhythm notation on every wrapped line.
- **FR-024**: The paste-tab preview MUST use the same rule as the other surfaces. Import sets no duration (spec 005 FR-017), so today's previews draw no rhythm row and MUST look exactly as they do now.
- **FR-025**: Printing the song page or the play view MUST print the rhythm notation in the print text colour, under the same no-split rules as the staff.
- **FR-026**: Every symbol MUST be drawn in the theme's text colour, at full opacity and at no less than 4.5:1 contrast on the surface it sits on, in both themes. No opacity may be laid over a surface token. A selected column MUST use the selection's text colour, as the bracket and the 007 marks do.
- **FR-027**: Beams MUST be at least 2 CSS px thick, and a gap between stacked beams or flags MUST be at least as wide as one beam. Stems and bracket lines MUST be at least 1 CSS px. At 375×667, three beams or flags (a thirty-second) MUST be told apart by eye at actual size.

**Duration buttons**

- **FR-028**: The inspector's six duration buttons MUST show the standard note symbol for each duration:
  - whole: an open notehead;
  - half: an open notehead with a stem;
  - quarter: a filled notehead with a stem;
  - eighth to thirty-second: a filled notehead with a stem and one to three flags.

  Each button MUST keep an accessible name and a title in words ("quarter note").
- **FR-029**: The duration buttons MUST behave and fit as they do today:
  - all six on one line at 375px wide, at 54×44 or larger on touch;
  - spec 007's fine-pointer floor on a mouse;
  - their pressed state shown without colour alone;
  - tap to set and tap again to clear.
- **FR-030**: The capture status line MUST keep showing the cursor column's duration in words (spec 005 FR-012, spec 008 FR-029 and FR-032), unchanged.

**What stays the same**

- **FR-031**: A column's screen reader description MUST be unchanged. It already names its duration in words. Every rhythm symbol, beam and stub MUST be hidden from assistive technology.
- **FR-032**: The plain-text export MUST draw no rhythm and MUST keep its bracket row above the staff exactly as today. The tab parser MUST NOT change. Every invariant in spec 004 MUST hold, and the export and parser tests MUST pass unedited.
- **FR-033**: No event field, part field, stored value, migration, sync message or new duration value is added. No fetched asset is added: no font, no image and no stylesheet from another origin. Everything is drawn inline in the theme's text colour, so it works on a cold open with no signal.
- **FR-034**: A duration MUST still never move, resize, reorder, number or create a column (spec 005 FR-002). Column widths, bar numbers and positions are unchanged by this entry.

**Amendments and tests**

- **FR-035**: Every earlier requirement this entry changes MUST be amended in place, with before and after wording, and noted in `docs/DECISIONS.md`. At least:
  - spec 005 FR-013, FR-014, FR-015, FR-016 and SC-011 (marks become notation, and capture draws it);
  - spec 003 FR-020, SC-009 and FR-032 (where the bracket sits on a staff with durations);
  - spec 007 FR-064's quoted FR-020 wording;
  - spec 008 FR-003 ("exactly as today" holds for parts with no durations).

  The amendments MUST be checked by a script, as earlier entries' were.
- **FR-036**: Unit tests over the beat and beaming rules MUST cover:
  - beat boundaries in a bar of eighths and in a bar of mixed sixteenths and eighths;
  - a note straddling a beat;
  - a bar of a fractional number of beats;
  - a barline between beamable notes;
  - a rest and an unset column inside a beat;
  - a counted triplet, a counted group of five, and a plain group, each beamed within its edges;
  - a group next to a barline;
  - a plain group containing a repeated column, in both densities;
  - a counted group containing a repeated column;
  - a group still being built;
  - a bar after one that cannot be timed;
  - the same span counting each group's number once.
- **FR-037**: The existing tests that pin the rhythm row's letter marks MUST be updated to pin the notation, not deleted, and each MUST be named in `docs/DECISIONS.md`. Tests that pin a part with no durations MUST pass unedited.

### Key Entities

- **Rhythm symbol**: what one column shows under the tab, which is a note shape, a rest shape, or nothing. It is derived from the column's duration and kind, and never stored.
- **Beam run**: consecutive beamable columns joined by beams, with how many beams each note carries. It is derived from durations, beats, barlines, rests and group edges, and never stored.
- **Beat position**: which beat of its bar a column starts in, or unknown. It is derived from the tick arithmetic the notation reader already uses, and never stored.
- **Group bracket placement**: above the staff or under it, per staff. It is derived from whether the staff draws a rhythm row, and never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A part with no durations draws identical staff markup, before and after, on every surface. The existing no-duration and baseline markup tests pass unedited.
- **SC-002**: At actual size in both themes, at 375×667 and 1280×800, and in a greyscale capture, each of the six note symbols and six rest symbols is told apart from the other eleven and from "no duration", at 4.5:1 contrast or better. Each finding is recorded in `docs/DECISIONS.md`.
- **SC-003**: At 375×667 on touch, with six strings, a chord row, a counted group and durations, 100% of the strings, the chord row and the rhythm row (bracket and number included) are in view. The band is at least 189px tall, and the page scroll is 0.
- **SC-004**: Across frets, note names and intervals, in compact and expanded density, and with a chord-widened column, every stem's centre is within 1px of its note's centre, and every beam's ends are within 1px of the stems they join.
- **SC-005**: Over the FR-036 corpus, no beam crosses a barline, a rest, an unset column, a group edge or a line break: 0 violations. Every counted group shows its number exactly once on every surface.
- **SC-006**: The diff of the text export, the parser, the storage and sync paths, and the event schema is empty. Spec 004's tests pass unedited.
- **SC-007**: The six duration buttons fit one line at 375px, each at 54×44 or larger on touch, and each is announced in words. A sighted user can name the eighth-note button from its symbol alone.
- **SC-008**: A cold open with no network draws the rhythm notation. The change adds no font, image or cross-origin request.
- **SC-009**: Every surface that draws a staff has been checked in a browser at 375×667 and 1280×800, in both themes and in greyscale, after a clean dev start. The findings are recorded.

### Owed to a real phone

A desktop browser cannot prove these. Each goes in `tasks.md` as a human item and stays open until done.

- Two-pixel beams and three stacked flags read as three, not as a smudge, on a real phone at arm's length, and on a music stand in the play view.
- The rhythm row in capture does not crowd the neck under a resting thumb.

## Decisions made for this spec

Made without waiting, as agreed, so they can be overturned at review. **Worth your eye** marks the ones I am least sure about.

- **On a staff with rhythm, the brackets move under the tab. On a staff without it, they stay above (worth your eye).**
  - *Why under:* this is where tab books put tuplet brackets, next to the notes they qualify, and it puts the number with its beams instead of a staff's height away.
  - *Why the height forces it:* at 375×667 with six strings, the strings plus a chord row and a bracket row take about 184px of the band's 189px. Adding a separate rhythm row would push a string out of view, so capture could not draw rhythm at all.
  - *Why not the alternatives:* keeping both rows costs a full row. Moving only the groups that have durations would leave both rows on a staff with mixed groups, and the height problem with them.
  - *Why per staff, not per group:* every group on a staff sits in the same place, so a number cannot appear twice and spec 003's "one row for both kinds" still holds.
  - *The cost:* in capture, setting the first duration shifts the strings up once (see Edge Cases), and the screen's bracket position no longer matches the export's for parts with durations. The export is a text format and keeps its brackets above.
- **Capture draws rhythm, amending spec 005 FR-016.** The brief lists capture first among the surfaces, and FR-016 only said no because capture lacked height. The bracket move pays for it.
- **Half is a half-length stem, whole is an open oval (worth your eye).** Tab programs commonly draw a half note as a short stem and a whole note with no stem at all. With no stem, a whole note looks the same as "no duration", so the whole note gets the small open oval that standard notation uses. Circling the fret number, the other common convention, was rejected: it would compete with the cell's own decorations and change with the view control.
- **The buttons show standard notes with noteheads, and the staff shows tab stems.** A lone stem on a button is cryptic. A note with its head is the symbol people know. Under the tab, the fret number is the notehead, so stems alone are conventional there.
- **The status line keeps its words.** It is the one place the duration is spelled out. Now that capture draws the symbol under the cursor's column, and the inspector shows it on the lit button, a third symbol would add nothing. The words also suit a newcomer, and the status row's tested layout stays as it is.
- **A compact repeat is a single flagged stem, never beamed.** A beam implies neighbours that share a beat, but a `7x8` column holds eight hits that span several beats, so beaming it would mislead.
- **A counted group beams as one unit.** This is conventional. It means a triplet that starts off the beat is not split at the beat.
- **Rests break beams, inside groups too.** This follows the brief, though engravers sometimes beam over a rest inside a tuplet.
- **Beat positions are read bar by bar.** One unset column must not strip the beams from the rest of the song. This extends the reader's walk, which stops at the first untimed bar, but uses the same arithmetic.
- **Drawn inline, with no font.** This follows the brief's recommendation. There is no new dependency, it works offline with no service-worker change, and it takes its colour from the theme.
- **This is one entry.** It covers one surface (rhythm under the staff) and its one control. The duration buttons could be split out, but they are small and should land in the same visual language as the staff.

## Out of Scope

- Dotted notes, ties, and new duration values, and any new event field or migration. The model holds six plain durations, and this entry draws them.
- A standard-notation staff.
- Full-width or multi-part layout of the song page and play view (entry `wide-reading-layout`).
- Sound or a playhead (entry `tab-playback`).
- Voice memos (entry `voice-memos`).
- Rhythm in the plain-text export, or reading rhythm from pasted text (spec 005 FR-017 stands).
- A time signature, or beaming by bar arithmetic.
- Bar numbers on wrapped capture lines. That idea is logged by spec 008, and it is now sizeable against FR-018's measured height.

## Assumptions

- 375×667 stands for a small phone and 1280×800 for a laptop. Touch and fine-pointer floors are spec 007's.
- Tab-with-rhythm convention means stems hanging down from just below the lowest string, with beams at the stems' lower ends, as in common tab books and tab software.
- A beat is a quarter note, because the model's ticks are per quarter (`TICKS_PER_BEAT`) and the click already counts that way.
- The paste importer will keep setting no durations. If a later entry teaches it to, the preview draws rhythm under FR-024 with no further change.

### Dependencies

- These tests pin the rhythm row's marks, the capture height or the bracket row, and are expected to be re-read and, where FR-037 allows, updated:
  - `src/components/tab/__tests__/tab-staff-rhythm.test.tsx` and `TabStaff.test.tsx`;
  - `e2e/rhythm-marks.spec.ts`, `e2e/rhythm-capture-height.spec.ts` and `e2e/usability-height-budget.spec.ts`;
  - `e2e/usability-staves.spec.ts`, `e2e/grouping-band.spec.ts` and `e2e/grouping-surfaces.spec.ts`;
  - the `baseline.json` markup entries.
- `check:usability-amendments` and `check:polish-amendments` must keep passing after the in-place amendments.
- The `npm run dev:clean` start before any browser check. Stale builds have shown old staves before.
- The sync suite's known flake (spec 006, FU19) and `durations.spec.ts:7` under full-suite load are not this entry's.
