# Feature Specification: Durations, tap tempo and a click

**Feature Branch**: `005-rhythm-and-tempo`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Give the app a sense of time. Today `durationHint` is dead schema and `bpm` is decoration." (full roadmap entry, with file references for planning: `.specify/roadmaps/capture-expression.json`, entry `rhythm-and-tempo`)

## Summary

The app stores positions, not time. A column can hold a duration, but nothing sets it and nothing reads it. A song can hold a tempo, but nothing plays it. This entry makes both real, in three pieces that build on each other:

1. **A click.** The play view gets a metronome with a four-click count-in, so that screen becomes something to play along with.
2. **Tap tempo.** Tap a few times, read the number, keep it if you want it. This answers "what tempo was that?" from the capture screen without leaving it.
3. **Durations.** A six-position row in the column inspector sets a column's duration. Reading views show it, and the click follows it where it can.

Rhythm stays optional throughout. The positional column model stays primary, a part with no durations draws and exports exactly as it does today, and a plain beat is a correct and useful result, not a degraded one.

A click that accents the wrong beat is worse than a plain one, because someone is playing to it. Every rule in **How the click reads the notation** follows from that sentence.

### Where the brief and the code differ

The roadmap entry was written earlier and some of its details have moved. This spec follows the code.

| The brief says | The code says | What this spec does |
|---|---|---|
| `bpm` is rendered in PlayView's subtitle and nowhere else | It is also shown in the song list on the band page, editable on the song page, and written in the text export's heading | Treats the song page field as an existing way to set tempo. Tap tempo adds a second one, and a tempo set by tapping appears everywhere a typed one does. |
| Durations are written as `null` by three insert paths | True, and the import path also writes null, while making a variant and copy and paste already carry the value | No change to any of them. See FR-001 and FR-006. |
| Line references: `protocol.ts:101`, `editing.ts` ~290, ~359, ~452 | They are now `protocol.ts:109` and `editing.ts:299`, `:379`, `:527` | Planning should use the current lines. |

### The six durations

| Position | Words | Length in beats |
|---|---|---|
| `w` | whole note | 4 |
| `h` | half note | 2 |
| `q` | quarter note | 1 |
| `8` | eighth note | ½ |
| `16` | sixteenth note | ¼ |
| `32` | thirty-second note | ⅛ |

There is no dotted value, because the stored field has none. A dotted rhythm can be written with a space column, or left unset.

### How the click reads the notation

**A beat is a quarter note.** The app has no time signature, so nothing can say otherwise. A song in 6/8 tapped at the dotted quarter still gets the right plain beat, but following its notation would give each eighth half a beat, which is too long. The reader can choose the plain beat there (FR-050). See Assumptions.

**A hit lasts its duration.** A column repeated eight times is eight hits, so `7x8` marked `8` lasts four beats.

**A counted tuplet shortens its hits.** Each hit lasts its duration times the fraction below. A plain group changes no length.

| Group's number | Fits in the time of | Fraction |
|---|---|---|
| 2, 4, 8, 16 | The same number | 1 (no change) |
| 3 | 2 | ⅔ |
| 5, 6, 7 | 4 | 4/*n* |
| 9 to 15 | 8 | 8/*n* |

So a triplet of `8` lasts one beat, and a quintuplet of `16` lasts one beat.

**A bar is timed when its length is known for certain.** A bar runs from one barline to the next, or to the edge of a pass. It is timed when both of these hold:

- every playable column in it, notes and spaces alike, has a duration, and
- every counted group in it has a number equal to its stored columns in that pass, with none of those columns repeated.

The second condition exists because specs/003 lets the two disagree: the number counts stored columns, a repeat adds hits, and later edits do not re-count. A group whose number does not describe its hits has no knowable length.

**A timed bar sounds like this.** Three levels of click, and where two land together only the strongest sounds:

| Level | Where |
|---|---|
| **Accent** | The first moment of the bar |
| **Beat** | Every beat counted from the start of the bar |
| **Soft** | Every hit of a counted tuplet, and the first hit of a plain group |

The next bar starts exactly where this one ends, whatever length that is. A bar of five eighths has clicks at 0, 1 and 2 beats, and the next accent lands at 2½. That is what 5/8 sounds like, and nothing had to know it was 5/8.

Worked example, for the tests. Bar 1 is four `q`. Bar 2 is a triplet of `8`, then `q`, then `h`.

| Beat | 0 | 1 | 2 | 3 | 4 | 4⅓ | 4⅔ | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Sound | Accent | Beat | Beat | Beat | Accent | Soft | Soft | Beat | Beat | Beat | Next bar |

**One gap ends the following.** A column with no duration has no length, so the first bar that is not timed loses the position in the song for good. There is no way to know when a later bar begins, and guessing would put accents in plausible, wrong places. From that bar on the click is a plain beat, carrying on from where the last timed bar ended. It does not pick the notation up again, even if a later part is fully notated.

**The plain beat** is one level, Beat, at the tempo, with no accent. An accent means "this is the start of a bar", and a plain beat does not know that. It is what a song with no durations gets from the first click, and it is what follows the end of the arrangement.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Play along with a click (Priority: P1)

The band has a song with a tempo. The guitarist opens the play view on their phone in a rehearsal room with no signal, taps start, hears four clicks, and comes in on the beat that follows. The click holds steady until they tap stop. No note in the song has a duration.

**Why this priority**: This is the change that turns the play view from a page you read into something you can play along with, and it needs nothing else from this entry. A plain beat over an unnotated song is the case the app is most likely to have.

**Independent Test**: Give a song a tempo on the song page, with no durations anywhere. Turn off the network, open the play view, tap start. Four count-in clicks are followed by a steady beat, and stop silences it at once.

**Acceptance Scenarios**:

1. **Given** a song at 120 bpm, **When** the reader taps start, **Then** four clicks sound half a second apart, numbered 1 to 4 on screen, and the beat carries on half a second after the fourth with no gap or change of speed.
2. **Given** the click is running, **When** the reader taps stop, **Then** nothing sounds after that, including clicks that had already been queued.
3. **Given** a song with no tempo, **When** the reader opens the play view, **Then** start is unavailable, the screen says a tempo is needed, and the tempo control is beside it.
4. **Given** a song with a tempo and no arrangement, **When** the reader taps start, **Then** the click runs.
5. **Given** no network at all, **When** the reader starts the click, **Then** it behaves exactly as it does online, and nothing is requested from the network.
6. **Given** a phone on silent, **When** the reader taps start, **Then** the app does not get around the silent setting, the beat is still visible on screen, and help nearby says what to check.
7. **Given** the click is running and the reader scrolls to the last pass, **When** they reach for stop, **Then** it is still in reach without scrolling back.
8. **Given** the click is running, **When** the reader leaves the play view, **Then** the click stops.
9. **Given** the click is running on a phone, **When** the reader goes on reading without touching the screen, **Then** the screen stays on where the device allows it.
10. **Given** the click is running, **When** the page is hidden or the device takes the audio away, **Then** the click stops instead of limping, and on return the screen says it stopped and start works again.

---

### User Story 2 - What tempo was that? (Priority: P1)

The drummer plays a groove and somebody asks how fast it is. The capturer is on the capture screen with a riff half entered. They tap the tempo control in the header, tap along with the drummer, read 118, and tap to keep it. They are back where they were, with the cursor where they left it.

**Why this priority**: It is the question everyone asks at practice, it is small, and it gives the click something to run on. Without it a tempo has to be known in advance and typed on another page.

**Independent Test**: On the capture screen with a latch armed and the cursor mid-part, open the tempo sheet, tap steadily, set the value, and close. The song's tempo has changed everywhere it is shown, and the cursor and the latch have not.

**Acceptance Scenarios**:

1. **Given** the capture screen, **When** the capturer opens the tempo control, **Then** a sheet opens over the screen, with no navigation, showing the song's stored tempo or saying it has none.
2. **Given** the sheet is open, **When** the capturer has tapped twice, **Then** no reading is shown yet, and **When** they tap a third time, **Then** a reading appears.
3. **Given** taps exactly 500 ms apart, **When** the reading appears, **Then** it says 120.
4. **Given** a reading of 118, **When** the capturer taps to set it, **Then** the song's tempo is 118 on every surface, on this device and on others after sync.
5. **Given** a reading of 118 on a song at 96, **When** the capturer closes the sheet without setting it, **Then** the song is still at 96 and nothing was written.
6. **Given** a run of taps, **When** the capturer pauses for more than three seconds and taps again, **Then** the reading starts over from that tap.
7. **Given** a steady run of taps, **When** one tap lands at less than half or more than double the running average, **Then** the reading starts over from that tap.
8. **Given** taps faster than 400 bpm or slower than 20 bpm, **When** a reading would appear, **Then** the sheet says the tempo is out of range and offers nothing to set.
9. **Given** the play view with the click running, **When** the reader sets a new tempo from the same sheet, **Then** the click changes speed from its next unqueued click, without restarting or counting in.

---

### User Story 3 - Say how long a note is (Priority: P2)

The riff is captured and the capturer has stopped playing. They long-press a column, and the inspector shows a row of six positions. They tap `8`, and the position lights. On the song page, that column has a small `8` under it. Tapping the lit position clears it.

**Why this priority**: It makes the dead field real, and it is what the click follows in Story 4. It comes after the click and tap tempo because nothing about those two needs it, and because this app's parts are usually unnotated.

**Independent Test**: Set durations on some columns of a part, and see them lit in the inspector and marked in the reading views. Copy them, make a variant, and confirm they travel. Clear them all, and confirm the part draws exactly as a part that never had any.

**Acceptance Scenarios**:

1. **Given** a playable column, **When** the capturer opens the inspector, **Then** a row of six positions reads `w h q 8 16 32`, in that order, on one line.
2. **Given** a column with no duration, **When** the capturer taps `8`, **Then** `8` lights and the sheet stays open.
3. **Given** a column at `8`, **When** the capturer taps `16`, **Then** `16` lights and `8` does not.
4. **Given** a column at `8`, **When** the capturer taps `8`, **Then** nothing is lit and the column has no duration.
5. **Given** a barline, **When** the capturer opens the inspector, **Then** the row is absent.
6. **Given** a space column, **When** the capturer opens the inspector, **Then** the row is there, because a rest has a length.
7. **Given** a column with a duration, **When** the cursor is on it, **Then** the capture screen shows which duration it is, and the staff's height has not changed.
8. **Given** a part where some columns have durations, **When** it is drawn on the song page or in the play view, **Then** a row of marks sits under the staff with one under each of those columns, and nothing under the others.
9. **Given** a part with no durations, **When** it is drawn or exported, **Then** the result is identical to what the app produced before this entry.
10. **Given** a part with durations, **When** it is exported as text, **Then** the text is identical to the same part without them.
11. **Given** columns with durations, **When** they are copied and pasted, cut and pasted, or made into a variant, **Then** the durations come with them.

---

### User Story 4 - A click that knows the rhythm (Priority: P3)

The bassist has notated a riff in an odd bar: five eighths, then three quarters, with a triplet in it. They start the click, and the accents land on the bar lines they drew, with the triplet audible against the beat. They never told the app a time signature, because there isn't one.

**Why this priority**: It is the most sophisticated piece, and the most rarely reached, because it needs notation this app usually does not have. Stories 1 and 3 are both useful without it.

**Independent Test**: Build a notated arrangement matching the worked example, start the click, and compare what sounds against that table. Then clear one duration in bar 2 and confirm the click turns plain from that bar.

**Acceptance Scenarios**:

1. **Given** an arrangement whose first bar is timed, **When** the reader starts the click, **Then** after the count-in the accent lands on the first moment of the first bar, and the screen says the click is following the notation.
2. **Given** the worked example, **When** it plays, **Then** the clicks match the table exactly.
3. **Given** a bar of five `8` followed by a bar of three `q`, **When** it plays, **Then** accents fall at beats 0 and 2½ and the next bar at 5½, and nothing warns that the bars differ.
4. **Given** three timed bars and then a column with no duration, **When** that fourth bar is reached, **Then** the click becomes a plain beat with no break in time, the screen says so, and it stays plain to the end.
5. **Given** a fully notated part following an unnotated one in the arrangement, **When** the click runs, **Then** it stays plain through both.
6. **Given** an arrangement with a variant on the last pass, or a pass limited to some bars, **When** the click runs, **Then** it follows what the screen draws for that pass.
7. **Given** a counted group whose number disagrees with its stored columns, or which holds a repeated column, **When** the walk reaches it, **Then** that bar is not timed.
8. **Given** a timed arrangement, **When** it ends, **Then** the click carries on as a plain beat until stopped.
9. **Given** a timed arrangement, **When** the reader wants to start somewhere other than the top, **Then** they can choose a plain beat before starting.
10. **Given** a song with no durations, **When** the reader opens the play view, **Then** there is no choice to make and the click is a plain beat.

### Edge Cases

- **A stored tempo the song page let through.** The song page field writes on every keystroke and only hints at a range, so a stored tempo can be any number. The click accepts a whole number from 1 to 999, which is what sync accepts, and treats anything else as no tempo.
- **Very slow or very fast stored tempos.** Inside that range the click does what the tempo says. A count-in at 10 bpm takes 24 seconds, and stop always works.
- **A tempo changed on another device mid-click.** It applies the same way as one set here, at the next unqueued click.
- **Notation changed on another device mid-click.** The running click keeps the notation it started with, and the change applies at the next start. Only the tempo is live.
- **A trailing barline, or two barlines in a row.** The empty bar has no length, makes no sound, and is not a gap.
- **A part with no barlines.** The whole pass is one bar, with one accent at its start.
- **A part with no columns in the arrangement.** It has no length and is skipped. It is not a gap.
- **A bar shorter than a beat.** A pickup of one `8` gets its accent, and the next bar's accent follows half a beat later.
- **A group split across a barline, from before grouping refused that.** Its number is compared with its columns across the whole pass, so it stays timed if that adds up.
- **A group cut by a pass limited to some bars.** Its number no longer matches what is walked, so that bar is not timed.
- **A column holding a stored duration this version does not know.** It reads as unset: no position lights, no mark is drawn, and the bar is not timed. It is left alone until the person picks a position.
- **Two fast taps on inspector positions.** The stored value is whatever the last tap asked for, and the lit position always shows the stored value.
- **Stop during the count-in.** It cancels the rest of the count-in, and the next start counts in from one.
- **Start tapped twice quickly.** It starts one click, not two.
- **A held key on the tap pad.** Key repeat does not count as taps.
- **The sound cannot start.** A device with no audio support, or audio that refuses to start, gets the visual beat and a line saying there is no sound. The app never shows a running click and leaves the reader to guess why it is silent.
- **Printing the play view.** The click controls do not print. The rhythm row prints with its staff.
- **A screen reader during the click.** State changes are announced, individual clicks are not.
- **Pasted tab with a rhythm line.** It stays commentary, as specs/004 already reads it.

## Requirements *(mandatory)*

### Functional Requirements

**Durations stay optional**

- **FR-001**: Nothing MUST require a duration. Every path that creates a column MUST keep creating it with none, unless it is copying one that has one.
- **FR-002**: A duration MUST NOT move, resize, reorder, number or create anything on the staff. Columns stay positional, column widths and bar numbers MUST NOT depend on durations, and barlines stay explicit events.
- **FR-003**: A part with no durations MUST draw the same on every surface and export byte for byte as it does before this entry.
- **FR-004**: A duration MUST be available on any playable column, which includes a space. A barline MUST NOT offer or hold one.
- **FR-005**: A column's duration MUST mean the length of each hit, so a repeated column lasts its repeat count times its duration. Changing the repeat MUST NOT change the duration.
- **FR-006**: A duration MUST keep travelling with its column through copy, cut, paste and making a variant, as it does today. It MUST merge as its own field, so one person setting a duration and another changing the repeat on the same column offline both survive. This entry MUST NOT change the stored shape, the wire format or the database.
- **FR-007**: A stored value outside the six MUST read as unset, MUST NOT cause an error on any surface, and MUST NOT be rewritten until the person picks a position.

**Setting a duration**

- **FR-008**: The column inspector MUST offer a row of exactly six positions, in the order `w h q 8 16 32`. The positions MUST NOT move, collapse, scroll, or depend on the column. All six MUST fit on one line at a 375px width, each at least 44px high.
- **FR-009**: Tapping an unlit position MUST set that duration, replacing any other. Tapping the lit position MUST clear it. There MUST NOT be a seventh position for "none".
- **FR-010**: A change MUST be stored immediately and the sheet MUST stay open. The lit position MUST always show the stored value, including when it changes on another device. Each position MUST have an accessible name in words and report whether it is on.
- **FR-011**: The row MUST live only in the inspector. Nothing MUST be added to the toolbars, the selection row or the latch strip for durations. **Stamping the next note's duration from the latch strip was considered and not done**, for the reasons in Assumptions.
- **FR-012**: The capture screen MUST show the duration of the column at the cursor when it has one, without adding height, without widening any toolbar control, and without changing anything when it has none.

**Showing durations**

- **FR-013**: The song page and the play view MUST draw a rhythm row under any staff whose columns include a duration, and no row under one that does not. Each drawn column with a duration MUST have its mark beneath it, so an expanded repeat shows a mark under each hit and a compact one shows one mark.
- **FR-014**: A mark MUST fit under the narrowest column without widening it. The form of the mark is a planning decision, within FR-015.
- **FR-015**: All six marks MUST be told apart at actual size in both themes, without relying on colour, at no less than 4.5:1 contrast. A column's screen reader description MUST name its duration in words when it has one and be unchanged when it does not.
- **FR-016**: The capture staff MUST NOT draw the rhythm row. It has no height to give (specs/003 FR-020), and FR-012 covers what the capturer needs.
- **FR-017**: The text export MUST NOT write durations, for any part. Pasted text MUST keep importing with no durations. This keeps specs/004's account of the export and its two round-trip properties true. **Reading durations from text, which specs/004 deferred to this entry, is therefore not built**, because the app writes no such text and hand-typed tab has no common form for it.

**Tap tempo**

- **FR-018**: A tempo control MUST be on the capture screen and the play view, showing the stored tempo or saying there is none. On the capture screen it MUST sit in the existing header, and the height given to the staff MUST NOT change.
- **FR-019**: The control MUST open one shared tempo sheet over the current screen. Opening and closing it MUST NOT navigate, and MUST NOT disturb the cursor, armed latches, a selection, the open part or a running click.
- **FR-020**: The sheet MUST have a tap pad at least 96px high. A tap MUST be timed from the moment the finger lands, not from release. Quick taps MUST NOT zoom the page or be lost, and a keyboard press MUST count once however long it is held.
- **FR-021**: The reading MUST appear on the third tap. It MUST be the average of up to the last eight intervals, as beats per minute, rounded to the nearest whole number.
- **FR-022**: A gap of more than three seconds, or an interval under half or over double the running average, MUST start the reading over, with that tap as the first.
- **FR-023**: A reading below 20 or above 400 MUST say the tempo is out of range and MUST NOT be settable.
- **FR-024**: Tapping MUST NOT write anything. The tempo MUST be stored only by tapping set, as one write to the song's tempo, and setting the value already stored MUST write nothing. Closing the sheet MUST leave the song unchanged. The stored tempo MUST stay visible beside the reading.
- **FR-025**: A tempo set by tapping MUST behave exactly as one typed on the song page, on every surface and through sync. Tempo stays per song.

**The click**

- **FR-026**: The play view MUST offer the click whenever the song exists, with or without an arrangement. Its controls MUST stay in reach at any scroll position, MUST NOT permanently cover the last staff, MUST be at least 44px high, and MUST NOT print.
- **FR-027**: With no usable tempo, start MUST be unavailable, the screen MUST say why, and the tempo control MUST be beside it. The click MUST NOT assume a default tempo.
- **FR-028**: The audio MUST be started inside the tap on start, before anything asynchronous, so that the tap counts as the user gesture a device requires. Nothing MUST try to start audio before that tap.
- **FR-029**: Every start MUST begin with a count-in of exactly four clicks, one beat apart at the tempo, numbered on screen. It is four clicks, not a bar. The click MUST continue one beat after the fourth.
- **FR-030**: Clicks MUST be scheduled ahead of time against the audio clock. A timer MAY top up the queue but MUST NOT decide when any click sounds, and the queue MUST run far enough ahead that re-rendering, sync traffic or a brief stall does not move or drop a click.
- **FR-031**: Stop MUST take effect immediately, MUST cancel queued clicks, and MUST leave the screen ready to start again.
- **FR-032**: When the stored tempo changes while the click runs, the click MUST change from its next unqueued click, with no restart, no count-in and no change to what it is following.
- **FR-033**: The click MUST be synthesised on the device. It MUST have the three levels in **How the click reads the notation**, told apart by ear, and audible on a phone's own speaker. It MUST NOT be a pitched rendering of any note in the song.
- **FR-034**: Each click MUST also show on screen within 50 ms of its moment on the audio clock, with accents visibly different from beats. The indicator MUST be small, MUST NOT flash the screen, MUST honour reduced motion, and MUST NOT rely on colour alone.
- **FR-035**: The app MUST NOT try to get around a silent or muted device. It cannot detect one, so while the click runs, help within reach MUST say to check the silent switch and volume.
- **FR-036**: If sound is unavailable or fails to start, the click MUST say so and keep the visual beat.
- **FR-037**: If the click cannot keep time because the page was hidden or the device took the audio, it MUST stop, not limp, and MUST say so when the reader returns. Starting again MUST need a tap.
- **FR-038**: While the click runs, the screen MUST stay awake where the device allows it, and MUST stop being held awake when the click stops. Where it cannot, nothing MUST fail.
- **FR-039**: Leaving the play view MUST stop the click and release the audio. Returning and starting again MUST work, repeatedly, without running out of audio resources.
- **FR-040**: The click MUST NOT write anything. Its state MUST NOT be synced or stored on the song.

**Offline**

- **FR-041**: The click MUST need no network: no audio files, no fetched samples, no hosted library. Nothing MUST be added that the service worker has to cache specially, and the service worker MUST NOT need to change.
- **FR-042**: The code behind the click and the tempo sheet MUST arrive with the screens that use them. It MUST NOT load on demand at the start tap, because a chunk first requested with no network does not exist, and waiting for one would also lose the user gesture.

**Following the notation**

- **FR-043**: The click MUST walk the same passes the play view draws, in the same order, from the top: variants substituted, bars sliced, sections repeated. It MUST NOT keep a second account of the arrangement.
- **FR-044**: Lengths MUST follow the tables in **How the click reads the notation**, and a bar MUST be timed only by the rule given there. Group lengths MUST be derived while reading. They MUST NOT change what a column stores.
- **FR-045**: A timed bar MUST sound as described there, with accent, beat and soft levels, strongest winning when they coincide, and the next bar starting where it ends. Bars with no length MUST be skipped silently.
- **FR-046**: At the first bar that is not timed, the click MUST become a plain beat with no break in time, and MUST stay plain. It MUST NOT resume following.
- **FR-047**: At the end of the arrangement the click MUST continue as a plain beat until stopped. It MUST NOT stop itself.
- **FR-048**: The click MUST NOT assume a time signature. It MUST NOT hold an expected bar length, compare bars with each other, or warn about a bar's length. The only fixed number of beats anywhere is the count-in's four.
- **FR-049**: The screen MUST say which the click is doing, following the notation or a plain beat, and MUST update when one becomes the other.
- **FR-050**: When the first bar of the walk is timed, the reader MUST be able to choose a plain beat before starting, because the click always starts from the top and a band may be starting elsewhere. Following is the default, and the choice lasts only while the screen is open. When there is nothing to follow, the choice MUST NOT appear.
- **FR-051**: The notation MUST be read at start. Edits arriving while the click runs MUST NOT disturb it.

### Key Entities

- **Duration**: an optional length on one playable column, one of six values, meaning the length of each hit. Already stored and synced. Null is valid and common.
- **Tempo**: the song's beats per minute, a whole number or nothing. Already stored and synced. One per song.
- **Tap run**: the taps since the reading last started over, held only while the tempo sheet is open. Never stored.
- **Click**: what the play view is doing while running: the count-in, then following the notation or a plain beat. Never stored or synced.
- **Timed bar**: a bar whose length is known for certain, by the rule in the Summary. Derived on each start, never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person on the capture screen can go from opening the tempo control to a stored tempo in under 15 seconds, with as few as three taps on the pad, and with the cursor, latches and part unchanged.
- **SC-002**: Taps exactly 500 ms apart read 120. Eight taps at 120 bpm with up to 15 ms of error on each tap read within 2 bpm of 120.
- **SC-003**: Across a ten-minute run at each of 40, 120 and 240 bpm, every click is within 1 ms of its ideal position on the audio clock, and the error does not grow with time.
- **SC-004**: With the page stalled for 200 ms and with a sync delivering rows during the run, no click is dropped or moved.
- **SC-005**: The first count-in click sounds within 200 ms of the tap on start.
- **SC-006**: After stop, no click sounds later than 50 ms after the tap, in every one of 100 stops at random moments.
- **SC-007**: With the network off and a production build, the whole of Story 1 and Story 2 completes with zero network requests made by the click or the tempo sheet, and the service worker file is unchanged.
- **SC-008**: Every existing fixture with no durations draws the same staff and exports byte-identical text, and every fixture gains durations with no change to its exported text.
- **SC-009**: The worked example, the five-eighths bar, a bar of each counted group size from 2 to 16, and the fall to a plain beat each produce exactly the clicks this spec gives them.
- **SC-010**: On a 375×667 viewport in both themes, the staff's height on the capture screen is the same to the pixel with and without this entry, the six positions fit one line, the page does not scroll, and the click's controls are all reachable at any scroll position.
- **SC-011**: Every rhythm mark is told apart from the other five at actual size in both themes in a greyscale capture, at 4.5:1 contrast or better.
- **SC-012**: In 50 cycles of starting, stopping, leaving and returning, the click starts every time.

### Owed to a real phone

A desktop browser cannot prove these. They stay open until someone has done them on a phone, and are not ticked to get past a gate.

- The click is audible over a played bass from the phone's own speaker at full volume.
- With the silent switch on, the app stays silent, the beat shows, and the help is there.
- With airplane mode on and the app opened from the home screen, the click and the tempo sheet work on a song opened before, reached by tapping through the app.
- The screen stays on for a five-minute run, on a phone that would otherwise sleep.
- Locking the phone and an incoming call both stop the click cleanly, and start works afterwards.
- Tapping quickly on the tap pad neither zooms the page nor drops taps.

## Out of Scope

- **Pitched playback of the notes.** This is a click, not a synthesiser.
- **A time signature field.** Bars are barline events.
- **Per-part tempo.** Tempo stays per song.
- **A scrolling playhead, or highlighting where the click has got to.** It is a reading feature, and this entry is already large.
- **Starting the click from a chosen pass or bar.** It always starts from the top, which is why FR-050 exists.
- **Tempo changes within a song, volume, swing, or a choice of click sound.**
- **Dotted values and ties.** The stored field has neither.
- **Durations in the text export or text import.** See FR-017.
- **Setting durations across a selection, or stepping between columns in the inspector.** See Assumptions.
- **Filling in durations from anything else**, including carrying one forward from the previous column. Null means not known.
- **Tightening the song page's tempo field.** See Assumptions.
- **Moving capture controls to recover height.** Entry `usability-pass`.

## Assumptions

Decisions taken where the entry left room, so that planning does not have to stop and ask. They follow the standing instruction to decide and move on, and the first seven are the ones worth a second look.

- **The latch-strip stamp is not done.** The strip already holds five chips above the neck. Six more positions do not fit on that line, a second line has to come out of staff height that specs/003 FR-020 says is gone, and one chip that cycles through the values is the thing that has to be read, which the brief rejects. It also leaves every insert path writing null, which is the docstring's promise.
- **Notating a run is one column at a time.** A bar of eight separate columns takes four taps each. The selection row cannot host it, because FR-020 of specs/003 is written around its seven controls, and the inspector does not open during a selection. A repeated column needs only one setting, which covers much of this music. If it proves tiresome, next and previous buttons in the inspector are the cheapest fix, and that is a later call. It is left out because this entry is already three features.
- **One gap ends the following, for good.** This means a fully notated chorus after an unnotated verse is never followed. The alternatives all need a guess about how long the unnotated part took. The honest way to do better is a way to cue the click to a pass, which belongs with the playhead.
- **Durations are drawn in reading views but not on the capture staff.** A row under the capture staff would cost height the five-string layout does not have. The capturer sees the value for the column at the cursor.
- **The export never writes durations.** The entry only asks that a part with no durations export as today, so writing them was allowed. It would add a new kind of line to a parser whose line classification took at least nine review rounds to close, in exchange for a line that no other tab reader understands.
- **Tap tempo needs a tap to store.** The brief says write it to the song, but the question asked at practice is often only "what was that?", and a stray three taps should not overwrite a tempo the band agreed. It also makes one write rather than one per tap.
- **A count-in happens on every start, and is not optional.** The brief asks for one and gives no reason to turn it off. Four clicks cost a couple of seconds.
- **A beat is a quarter note**, because a time signature is what would otherwise say. Compound time is the case this gets wrong, and only for the following: the plain beat is right at any tapped pulse, and a reader can pick it (FR-050).
- **Tuplets fit the nearest power of two below their number**, which is the usual reading in simple time. Numbers that are already a power of two change nothing, so a bracketed 4 over four notes is phrasing.
- **Tempo bounds are 20 to 400**, taken from the song page field. The reset gap of three seconds is the interval at 20 bpm.
- **Stopping when the page is hidden is deliberate.** Browsers slow background pages, so a click left running would limp, and one that keeps wrong time while you play to it is worse than one that stops.
- **The song page's tempo field is left as it is.** It writes on every keystroke, so it passes through interim values on the way to 120, and it can store values that sync refuses, such as `120.5`. Tightening it needs a draft-and-commit field, which is outside this entry. The click reads such values as no tempo. This is an existing defect, and now worth fixing because the tempo does something.
- **Play pages are available offline only where they already were.** A song's play page has to have been opened on this device while online, as with every other route. The click adds no new way to fail, and changing that is not this entry's work. One known risk sits next to this: specs/004 review FU25 saw the song screen lose its controls after in-app navigation while offline, undiagnosed. If that reaches the play view, it is the rehearsal-room failure by another route, so the offline check here must arrive by in-app links as well as by a direct open.
- **The brief's platform constraints are kept as stated**: the Web Audio API, scheduling ahead rather than on a repeating timer, and no CDN or fetched audio. This spec words them as outcomes so that they can be tested.
- **Viewers are not gated.** Setting a duration or a tempo follows the same rule as every other write, and the server's existing rule applies.

### Dependencies

- The column inspector from `capture-control-surface`, and its property list.
- Group kinds and numbers from `generalised-grouping`.
- The arrangement expansion and bar slicing the play view already uses.
- specs/004's Out of Scope line "Reading durations from text. Entry `rhythm-and-tempo`." is answered by FR-017, and should be amended in place to say so when this entry lands.
