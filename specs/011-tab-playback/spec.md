# Feature Specification: Tab playback, a part or the whole song as sound

**Feature Branch**: `011-tab-playback`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "Play a part, or the whole arrangement, back as sound. Today the only audio is the metronome click from spec 005." (full roadmap entry, with file references for planning: `.specify/roadmaps/best-in-class.json`, entry `tab-playback`)

## Summary

Today the app can show a riff but cannot play it. The only sound is spec 005's click. A bassist who captured a part last week, or who is learning a part a bandmate captured, has no way to hear how it goes. This entry adds that, in one place, on the click's own clock:

1. **Hear a part.** A part's card on the song page gets **Play**. It opens the play view showing only that part, ready to play it and loop it.
2. **Hear the whole song.** In the play view, the notes can be switched on beside the click. Start then counts in and plays every pass in the order the screen draws it: variants substituted, bars sliced, passes drawn once by entry `wide-reading-layout` still played every time.
3. **Practise it.** A speed control slows the song down for this session without touching its stored tempo. The click can be on or off under the notes, and a part or the whole song can loop.
4. **Follow it.** The column being played is highlighted on the staff and kept in view, the way the click's highlight is today.

The sound is a synthesised plucked string, made on the device. No samples or fetched files are used, and nothing needs the network. Its pitch comes from the part's tuning and frets. Its timing comes from the column durations, played the way the click reads them. Its articulation comes from the techniques where that can be done honestly (the table in **How techniques sound**).

Most captured parts have no durations, because spec 005 made them advisory. Playback plays those parts anyway, by a stated rule (**When a note has no length**). It says on screen that it is doing so, and it writes nothing.

Rhythm and tempo stay what spec 005 made them. Nothing about a song changes: no field, migration, sync message, export or import.

### Where the brief and the code differ

| The brief says | The code says | What this spec does |
|---|---|---|
| "Play a single part. Its card on the song page uses the overflow or card area" | The song page has no transport. The click bar, its cluster, the reading highlight and the play keys exist only in the play view. A second transport on the song page would cost the fit target of entry `wide-reading-layout` (its SC-002). | The card's menu gains **Play**. It opens the play view showing only that part (**part playback**), with the cluster, highlight, keys and stop rules the play view already has (FR-001 to FR-006). |
| "The column highlight that follows the click comes from useReadingPosition" | It does, but it is fed from the timed columns only, and only while the click follows the notation. It goes dark at the first column with no duration. | With the notes on, the highlight follows the note being played through every column, using the lengths in **When a note has no length** (FR-040). With the notes off it behaves exactly as today. |
| The scheduler has stop reasons `tap`, `left`, `hidden`, `audio-lost`, `fell-behind` | The click never ends, so the scheduler reads a stream that runs dry as a failure to keep time (`fell-behind`). | Playback has an end. Reaching it MUST NOT read as falling behind, and the screen MUST NOT say the run could not keep time (FR-033). |
| "eleven `Technique` values", "a percussive thud for dead notes (`x`)" | `dead_note` is one of the eleven, but nothing in the app writes it. A dead note is the fret value `x` (spec 002). | Both sound the same: the fret `x`, and a note carrying `dead_note` if one ever arrives from elsewhere (**How techniques sound**). |
| "Counted groups play in their ratio, using the same arithmetic the click uses" (`fitFor`) | That arithmetic is private to the notation reader, and a group that does not read (its number disagrees with its columns, or one is repeated) makes the click's bar untimed. | Playback uses the same arithmetic. A group that does not read plays its hits at their own lengths, with no ratio, because playback has to go on where the click turns plain (FR-016). |
| "If an AudioWorklet module is used, it is a same-origin static file that public/sw.js caches" | Spec 005 FR-041 requires that the service worker need not change for sound. | The voice is built from the browser's built-in audio building blocks, with no worklet file. `public/sw.js` and its `VERSION` are unchanged (FR-052). |
| "Synthesise a bass voice" | The tunings go down to F0 (about 22 Hz, Drop F on five strings). A phone's own speaker produces almost nothing below about 200 Hz. | The voice MUST carry enough overtones for its pitch to be heard on a speaker with no low end (FR-025). A pure low tone would be silent on the device the brief is worried about. |
| Guitar tunings | `TUNING_PRESETS` includes 6- and 7-string guitar tunings. | Those parts play at their own pitches in the same plucked voice. There are no separate instruments (Out of Scope). |

### When a note has no length

A **set** length is a column's stored duration that spec 005's table recognises. Anything else is **unset**, including a stored value that table does not know.

1. **A set length is used as written,** with spec 005's arithmetic: each hit lasts its duration, a repeated column lasts its repeat count times its duration, and a counted group that reads shortens its hits by spec 005's fraction.
2. **An unset column takes the last set length before it in the same pass.** This counts any playable column, notes and spaces alike, and it carries across barlines.
3. **An unset column with no set length before it in its pass lasts one beat** (a quarter note, since a beat is a quarter note in spec 005).
4. **The carried length resets at the start of every pass,** and at the start of every loop round. A part therefore sounds the same every time it is played, whatever came before it.
5. **A counted group that reads keeps its ratio** whether its lengths are set or carried. A group that does not read has no ratio.

The rule applies only while playing. It writes nothing. The inspector, the rhythm row and the export still show an unset column as unset.

Worked example, for the tests. A pass of seven columns, with no barline: `5` unset, `7` set to `8`, `7` unset, a triplet group of three columns (`5`, `7`, `9`) all unset, and a space unset.

| Column | `5` | `7` (8) | `7` | `5` ⁽³⁾ | `7` ⁽³⁾ | `9` ⁽³⁾ | space |
|---|---|---|---|---|---|---|---|
| Starts at beat | 0 | 1 | 1½ | 2 | 2⅓ | 2⅔ | 3 |
| Lasts (beats) | 1 (rule 3) | ½ | ½ (rule 2) | ⅓ (rules 2, 5) | ⅓ | ⅓ | ½ (rule 2) |

The pass lasts 3½ beats. Looped, its second round starts at beat 3½, and the first `5` lasts one beat again (rule 4).

### How techniques sound

Every one of the eleven stored `Technique` values is listed here, plus the dead-note fret `x`. A string holds one note at a time: a new note on a string ends the one before it on that string, unless the table says otherwise. When a string has more than one transition stored, playback uses the one the staff draws (spec 002's priority order).

| Technique | Drawn as | What playback does |
|---|---|---|
| `hammer_on` | `h` | **Legato.** If the string's previous note is still sounding, the pitch moves to this note with no new attack. If nothing is sounding on that string, the note plays with a softer attack than a picked note. |
| `pull_off` | `p` | The same as `hammer_on`. |
| `slide_up` | `/` | **Glide.** The pitch slides from the string's previous note to this one, arriving at this note's start, with no new attack. If nothing is sounding on that string, it slides in from three semitones below. |
| `slide_down` | `\` | The same glide. If nothing is sounding on that string, it slides in from three semitones above. |
| `vibrato` | `~` | **Wobble.** The pitch moves about a quarter of a semitone either side, about five or six times a second, for the note's length. |
| `palm_mute` | `m` | **Short and dark.** The note sounds for at most half its length, with its upper overtones cut, so it reads as a muted thump with a pitch. |
| `let_ring` | `( )` | **Long sustain.** The note keeps sounding past its length, decaying naturally, until the same string plays again or the run ends. A new note on another string does not end it. |
| `harmonic` | `< >` | **Harmonic pitch.** At a natural-harmonic fret it sounds at the harmonic's pitch over the open string: fret 12 is +12 semitones, 7 and 19 are +19, 5 and 24 are +24, and 4, 9 and 16 are +28. At any other fret it sounds at the fretted pitch. Either way it has a bell-like tone with a long, pure sustain. |
| `bend` | `b` | **Ignored. It plays the fretted pitch.** The model stores no target (it draws `b`, not `7b9`), and a guessed target would teach the wrong note. Bend targets are a notation change, outside this entry. |
| `tap` | `t` | **Ignored. It plays as a picked note.** A tapped note is a fretted note sounded by the other hand, and the difference in sound is too slight to be worth faking. A pull-off after it is still legato. |
| `dead_note` | (never written by the app) | Sounds as a dead note, the same as fret `x`. |
| Fret `x` | `x` | **Thud.** It is very short and percussive, with no clear pitch, and lower on lower strings. Of the techniques on a dead note, only `palm_mute` changes it (shorter still). All the others are ignored. |

Several notes in one column sound together, each on its own string and each following its own techniques.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Hear how a part goes (Priority: P1)

The bassist is learning the B part a bandmate captured last week. None of its columns has a duration. On the song page they open the card's menu and tap **Play**. The play view opens showing only part B, with the notes on and looping on. They tap **Play** in the bar, hear four count-in clicks, then hear the riff at the song's tempo, round and round, each note in its own pitch, with the column being played outlined on the staff. A line says each note plays one beat because none has a length. They tap Stop and it is silent at once.

**Why this priority**: Hearing a captured part is the gap this entry exists to close. It needs nothing else from this entry, and it works on the parts the app actually has, which have no durations.

**Independent Test**: Seed a song at 120 bpm with a part of eight unset columns on known frets. Open its card menu, choose Play, tap Play. The scheduled notes have the pitches `fretToMidi` gives, each one beat (0.5 s) long, starting one beat after the fourth count-in click. The ninth note is the first again, with no gap. Stop silences everything.

**Acceptance Scenarios**:

1. **Given** a part card on the song page, **When** its menu is opened, **Then** it offers **Play**, and choosing it opens the play view showing only that part, with the notes on and looping on, and with nothing sounding yet.
2. **Given** part playback at 120 bpm, **When** the reader taps Play, **Then** four count-in clicks sound half a second apart, and the part's first column sounds half a second after the fourth.
3. **Given** a part with no durations, **When** it is ready to play, **Then** the bar says `No note has a length, so each plays one beat.`, and each column plays for one beat.
4. **Given** a part where only some columns have durations, **When** it is ready to play, **Then** the bar says `Notes with no length take the last length, or one beat.`, and the lengths follow **When a note has no length**.
5. **Given** looping on, **When** the part's last column ends, **Then** its first column sounds at once, with no count-in and no gap, and the highlight goes back to the first column.
6. **Given** looping off, **When** the part's last column ends, **Then** the run stops by itself, the bar returns to rest without saying the run could not keep time, and Play can be tapped again.
7. **Given** part playback, **When** the reader goes back, **Then** they return to the song page, and the sound has stopped.
8. **Given** a song with no tempo, **When** part playback opens, **Then** Play is unavailable, the bar says a tempo is needed, and the tempo control is beside it, as spec 005 does for the click.

---

### User Story 2 - Play the whole song in the play view (Priority: P1)

The guitarist wants to hear the song's form before practice. In the play view they open the cluster (More) and switch **Notes** on, and the bar's Start becomes **Play**. They tap it. After the count-in, the arrangement plays pass by pass: `A ×4` plays A three times and then its variant `A′`, `C bars 1–2` plays only those bars, and the click keeps time under it. They switch **Click** off halfway through, and from the next beat only the notes sound.

**Why this priority**: The play view is where a whole song is read while playing, and it is the brief's second headline. It shares every piece of Story 1 and adds only the pass order.

**Independent Test**: Seed the playback song (Success Criteria). Turn Notes on and play it. The notes scheduled are exactly the columns of `drawnPasses` for that song, pass by pass, at the times **When a note has no length** gives. Wherever a note and a click share a moment, they are scheduled for the same instant on the audio clock.

**Acceptance Scenarios**:

1. **Given** the play view with Notes off, **When** the reader uses the click, **Then** everything behaves exactly as before this entry: the same labels, words, clicks, count-in and highlight.
2. **Given** Notes on, **When** the reader taps Play, **Then** after the count-in the passes play in the order the screen draws them, with variants substituted and bars sliced. A drawn-once card plays every pass it stands for.
3. **Given** Notes on and Click on, **When** a note and a click fall on the same moment, **Then** they sound together, scheduled for the same instant on the audio clock.
4. **Given** a run in progress, **When** the reader switches Click off, **Then** no click sounds after those already queued, the notes carry on, and no restart or count-in happens. Switching it on again brings the click back the same way.
5. **Given** Notes on and Click off, **When** the reader taps Play, **Then** the four count-in clicks still sound.
6. **Given** an arrangement whose notation is fully timed, **When** it plays with Click on and following the notation, **Then** every note starts exactly on the moment the click's notation reading gives that column.
7. **Given** an arrangement with an untimed bar part way through, **When** it plays, **Then** the click turns to a plain beat at that bar, as spec 005 says, and the notes carry on by the length rule from the same moment.
8. **Given** looping off, **When** the last pass ends, **Then** the run stops by itself, with the click as well.
9. **Given** looping on, **When** the last pass ends, **Then** the arrangement starts again from its first pass with no count-in, and each round sounds the same as the first, notes and click.
10. **Given** the keys, **When** the reader presses Space with Notes on, **Then** playback starts or stops, and `r` starts again from the top with the count-in. With Notes off, both keys do what they do today.

---

### User Story 3 - Slow it down (Priority: P2)

The riff in part C is fast. The bassist opens the cluster, steps the speed down to 70%, and plays it on a loop. The count-in, the notes and the click all run at 70% of the song's tempo. The bar shows that the speed is reduced even with the cluster closed. The song's stored tempo is still 160, on this device and everyone else's.

**Why this priority**: Slowing down is how a part is learnt, but playback is useful at full speed without it.

**Independent Test**: Seed a song at 160 bpm. Set speed to 50% and play: count-in clicks are 0.75 s apart. Change speed to 100% while running: the next unqueued note is at the new spacing, with no restart. Then reload the app. The song's `bpm` is still 160, no write was queued for sync, and the speed has gone back to 100%.

**Acceptance Scenarios**:

1. **Given** a song at 120 bpm and speed at 50%, **When** playback runs, **Then** the count-in, the notes and the click all run at 60 beats a minute.
2. **Given** a running playback, **When** the speed is changed, **Then** it applies from the next note or click not yet queued, with no restart, no count-in and no jump in the highlight.
3. **Given** any speed change, **When** the song is read on this device or another, **Then** its stored tempo is unchanged and nothing was written or synced.
4. **Given** speed below 100%, **When** the cluster is closed, **Then** the bar still shows that the speed is reduced, and the bar's height and the positions of Start, Stop and More are unchanged.
5. **Given** a song slowed to 70%, **When** the reader opens another song, **Then** that song plays at 100%. **When** they come back to the first song in the same session, **Then** it is still at 70%.
6. **Given** the stored tempo is changed by tap tempo or on another device mid-run, **When** the next note is queued, **Then** it plays at the new tempo times the current speed.
7. **Given** speed in use with Notes off, **When** the click runs alone, **Then** it runs at the reduced speed too. One clock serves both.

---

### User Story 4 - See where the music is (Priority: P2)

On a laptop on a music stand, the play view plays the whole song. The outlined column moves with the notes, through the side-by-side cards of entry `wide-reading-layout`, down to the next row, and into view when it leaves the screen. Inside a drawn-once `×3` card, the head row reads `pass 2 of 4` while the second pass plays. On a phone the same happens down a single column of cards.

**Why this priority**: The playhead is what ties the sound to the tab, so it is how a reader learns which notes they are hearing. Playback is still useful by ear without it.

**Independent Test**: Seed the playback song with no durations at all. Play it with Notes on at 1280×800 and 375×667, in both themes. Record the outlined column each time it changes. The sequence is every column of every pass, in order, and the outline changes no later than 50 ms after its note is scheduled to sound. Compare a screenshot of the outline with a capture selection: the two are told apart without colour.

**Acceptance Scenarios**:

1. **Given** Notes on, **When** a column sounds, **Then** that column is outlined within 50 ms, whether its length was set or came from the rule. Space columns are outlined too, and each hit of a repeated column is outlined in turn.
2. **Given** the outlined column moves onto a card that is partly off screen, **When** following is allowed (spec 007's scroll rule), **Then** the page scrolls just enough to show it, honouring reduced motion.
3. **Given** a drawn-once card, **When** its second pass plays, **Then** the outline is on that card's column and the head row says `pass 2 of 4`, as entry `wide-reading-layout` FR-017 does for the click.
4. **Given** either theme, **When** the outline is drawn, **Then** it is the existing reading-position outline. It is not a filled band, so it cannot be mistaken for a selection, and it meets 3:1 contrast against the card.
5. **Given** a keyed reading position from the arrow keys, **When** playback starts, **Then** the keyed position is cleared, and playback starts from the top, as the click does.
6. **Given** playback stops for any reason, **When** the bar returns to rest, **Then** no column is outlined.

---

### User Story 5 - The techniques sound like the tab (Priority: P3)

The bassist plays a part with `5h7`, a slide `7/9`, a palm-muted run, dead notes and a let-ring chord. The hammer-on is not re-picked, the slide glides, the muted run is short and dark, the `x`s thud, and the chord rings on under the next notes.

**Why this priority**: Notes in time at the right pitch is most of the value. Techniques make playback match what is drawn, but a part without them is still worth hearing.

**Independent Test**: Seed a part using every row of **How techniques sound**. Play it with a fake sound port, and compare what is queued for each note (pitch, start, length, glide, attack, wobble, tone, sustain) with the table. Then play it in a browser and listen at actual size.

**Acceptance Scenarios**:

1. **Given** `5h7` on one string, **When** it plays, **Then** the second note is queued as a change of pitch on the sounding note, not as a new attack.
2. **Given** `7/9`, **When** it plays, **Then** the pitch glides from 7 to 9, arriving at the 9's start.
3. **Given** a palm-muted note one beat long, **When** it plays, **Then** it sounds for at most half a beat and darker than an unmuted note.
4. **Given** `x` on the lowest string, **When** it plays, **Then** a short thud with no clear pitch sounds.
5. **Given** a let-ring chord followed by a single note on another string, **When** they play, **Then** the chord keeps sounding under that note.
6. **Given** `<12>` on the open-E string, **When** it plays, **Then** it sounds at E one octave above the open string. **Given** `<7>`, **Then** it sounds an octave and a fifth above.
7. **Given** a note marked `b` or `t`, **When** it plays, **Then** it sounds at its fretted pitch as a picked note, exactly as if the technique were not stored.

---

### Edge Cases

- **A song with no arrangement.** The play view's empty state is unchanged. Notes on has nothing to play: Play is unavailable and the bar says so (`There are no notes to play here.`). The click still works with Notes off. Part playback still works, because it does not use the arrangement.
- **A part with no columns, or only barlines.** Part playback opens, and Play is unavailable with the same words.
- **A song with no tuning.** The staff says to add a tuning, as today. With Notes on, Play is unavailable and the bar says `Add a tuning to hear the notes.` The click still works with Notes off.
- **A note on a string the tuning does not have** (the tuning was changed to fewer strings). It is silent. It never raises an error, and the rest of the column sounds.
- **A very high or very low note.** Any fret on any tuning plays at its pitch, from F0 up. Nothing is transposed to suit the speaker.
- **A tempo at the limits.** At 1 bpm a note can last a minute, and at 999 bpm a thirty-second note is about 8 ms. Both play as written, and Stop always works.
- **A pass of only spaces.** It is silent for its length, and the outline moves through it.
- **A trailing barline, two barlines in a row, or a part with no barlines.** Barlines take no time, so none of these changes when anything sounds.
- **A column repeated eight times.** Eight notes, each re-picked, with the outline stepping through all eight hits.
- **A hammer-on, pull-off or slide that starts a pass.** It connects to the string's previous note if that note is still sounding, across the pass boundary and across the loop seam. Otherwise it follows its table row's "nothing is sounding" case.
- **Two transitions stored on one string.** Playback uses the one the staff draws.
- **A dead note with a slide or hammer-on into it.** It thuds, with no glide and no legato.
- **A six-note chord with let ring under further notes.** Nothing distorts or clips, and the click stays audible.
- **A group that does not read** (its number disagrees with its columns, or a column in it is repeated). Its hits play at their own lengths with no ratio. The click turns plain at that bar, as spec 005 says.
- **A group cut by a bar slice.** The same: it no longer reads, so it has no ratio.
- **Notation edited on another device mid-run.** The run plays what it started with. The edit applies at the next start, as spec 005 FR-051 says.
- **A part deleted, or the arrangement emptied, mid-run.** The run plays what it started with, and stops at its end or when the reader leaves.
- **Start tapped twice quickly.** One run starts (INV-024).
- **Stop during the count-in.** No note ever sounds, and the next start counts in from one.
- **Notes or Loop switched while running.** Notes can only be switched at rest; the control is unavailable while running. Loop and Click apply while running: Loop is read at the run's end, and Click from the next click not yet queued.
- **The page is hidden, the phone locks, a call arrives, or the device takes the audio.** The run stops cleanly through the existing stop reasons, ringing notes included, and says so on return. Start needs a tap again.
- **The run falls behind** (a long stall). It stops and says it could not keep time. It never plays late notes in a bunch.
- **A device with no audio.** The visual beat and the outline still run, and the bar says there is no sound, as spec 005 does for the click.
- **A muted phone or the silent switch.** The app does not get around it. The existing help line says to check the silent switch and volume.
- **Opening part playback for a variant.** It plays the variant's own columns, whole.
- **Printing the play view in part playback.** The one card prints like any other play-view card. The bar does not print.
- **A screen reader.** State changes are announced (starting, playing, stopped and why). Individual notes are not.

## Requirements *(mandatory)*

### Functional Requirements

**Part playback**

- **FR-001**: Every part card on the song page MUST offer **Play** in its menu, the overflow menu set up by entry `usability-polish`, on every part, including variants. It MUST NOT add a row or a permanent control to the card, and MUST NOT change the card's height or the song page's layout.
- **FR-002**: Choosing **Play** MUST open the play view showing only that part (**part playback**), drawn whole (no bar slice) as one card, with its bar numbers from 1. It MUST NOT start any sound, because sound starts only on the tap described in FR-028.
- **FR-003**: Part playback MUST start with **Notes** on and **Loop** on, whatever was chosen before. Click and speed keep their current values. Part playback MUST NOT change the Notes choice remembered for the whole song's play view (FR-023).
- **FR-004**: Part playback MUST say which part it is playing in its heading, and MUST offer a way to the whole song's play view. Going back MUST return to the song page.
- **FR-005**: Part playback MUST work for a song with no arrangement.
- **FR-006**: Capture MUST NOT gain a play control. The reasons are recorded under Decisions. Capture's layout, height and every capture test MUST be unchanged.

**What plays**

- **FR-007**: With Notes on in the play view, playback MUST play the passes exactly as the play view draws them (`drawnPasses`), in order: variants substituted, bars sliced, section repeats expanded, and every pass of a drawn-once card played. It MUST NOT keep a second account of the arrangement.
- **FR-008**: In part playback, playback MUST play the part's own columns, whole, as one pass.
- **FR-009**: Each note's pitch MUST be the pitch of its string and fret in the song's tuning (`fretToMidi`), with string 0 the highest string, adjusted only by the `harmonic` row of **How techniques sound**.
- **FR-010**: Every note in a column MUST start at the same moment, so a column with several notes sounds as a chord.
- **FR-011**: A string MUST hold one note at a time. A new note on a string ends the previous note on that string, except as **How techniques sound** says for transitions.
- **FR-012**: A column repeated *N* times MUST play *N* times, each hit picked again.
- **FR-013**: A space column MUST be silent for its length. A barline MUST take no time.
- **FR-014**: Lengths MUST follow **When a note has no length**, and MUST be computed with the same arithmetic the click uses (spec 005's table and group fractions). Wherever every column up to a point is set and every group reads, each note MUST start at exactly the tick the click's notation reading gives that column.
- **FR-015**: The length rule MUST apply only while playing. It MUST NOT write, store, sync or display a length on any column, and the inspector, rhythm row and export MUST be unchanged by it.
- **FR-016**: A counted group that reads MUST play in its ratio, whether its lengths are set or carried. A group that does not read MUST play its hits at their own lengths, with no ratio.
- **FR-017**: Techniques MUST sound as **How techniques sound** says, for every one of the eleven stored values and for fret `x`. The ignored rows (`bend`, `tap`) MUST sound exactly as the same note without the technique.
- **FR-018**: A note on a string the tuning does not have MUST be silent and MUST NOT cause an error.

**Ends and loops**

- **FR-019**: With Notes on and Loop off, the run MUST stop by itself when the last column's length ends, click included. A note still ringing then MUST fade out rather than cut off with a click.
- **FR-020**: With Loop on, the run MUST start again from its first column the moment its last column's length ends, with no count-in and no gap. The length rule's carried length resets (rule 4). Each round MUST sound the same as the first, notes and click. The click in each round is the click of the first round, cut at the round's end.
- **FR-021**: With Notes off, the click MUST behave exactly as spec 005 says, including carrying on as a plain beat after the arrangement until stopped. Loop MUST NOT be offered with Notes off.

**The controls**

- **FR-022**: The new controls MUST live in spec 007's collapsible cluster (More), not in new permanent rows. These are **Notes** (on or off), **Click** (on or off, shown only with Notes on), **Loop** (on or off, shown only with Notes on) and **Speed**. Each switch MUST report whether it is on, to sight and to assistive technology, without relying on colour. Each MUST be at least spec 007's touch floor for the pointer in use.
- **FR-023**: Notes MUST be switchable only at rest. Its choice MUST be remembered on this device for the play view, as the panels and the view control are, and is never synced. It starts off, so the click and its tests are unchanged until someone switches it on.
- **FR-024**: The bar's start control MUST read **Start click** with Notes off (unchanged) and **Play** with Notes on, in the same box, at the same size and in the same place. Stop, the beat box, the tempo control and More MUST NOT move.

**The voice**

- **FR-025**: The voice MUST be synthesised on the device as a plucked string. It MUST carry enough overtones that its pitch can be heard on a speaker that produces nothing below 200 Hz, down to the lowest string of every preset tuning.
- **FR-026**: Notes MUST start and end without an audible click or pop, apart from the intended thud of a dead note. A column of up to seven notes, with let-ring notes still sounding beneath, MUST NOT clip or distort. The click MUST stay audible over the notes.
- **FR-027**: Every part MUST play in this one voice, whatever its tuning, including guitar tunings.

**One clock**

- **FR-028**: Playback MUST start inside the tap on Play, before anything asynchronous, as spec 005 FR-028 requires of the click. Nothing MUST try to start audio before that tap, including opening part playback.
- **FR-029**: Notes and clicks MUST be scheduled ahead on one audio clock by spec 005's existing scheduler, so that they can never drift apart. There MUST NOT be a second timing loop. The sound port MUST be able to queue a pitched note with its length and articulation as well as a click.
- **FR-030**: Every start MUST begin with spec 005's count-in of four clicks, at the effective tempo (FR-036), whether Click is on or off. The first column MUST sound one beat after the fourth count-in click.
- **FR-031**: Stop (the button, Space, leaving, hiding, losing the audio, or falling behind) MUST silence every note within 50 ms, including let-ring notes and notes already queued, and MUST leave the bar ready to start again.
- **FR-032**: Playback MUST use the existing stop reasons and their words. Hiding the page, a lock or a call MUST stop it (`hidden`), the device taking the audio MUST stop it (`audio-lost`), and failing to keep time MUST stop it (`fell-behind`) rather than play notes late.
- **FR-033**: Reaching the end with Loop off MUST NOT be read as `fell-behind`, and MUST NOT leave a stopped line on screen. Afterwards the start control MUST have focus if Stop had it.
- **FR-034**: The click's own behaviour, sounds, words and stream with Notes off MUST be unchanged. Every existing scheduler, stream, click-bar and click e2e test MUST pass unedited. Any test that has to change MUST be listed in `docs/DECISIONS.md` with what changed and why.

**Speed**

- **FR-035**: Speed MUST scale the song's tempo from 50% to 100%, in steps of 5%, starting at 100%. It MUST show both the percentage and the resulting tempo in beats a minute (rounded for display only).
- **FR-036**: The **effective tempo** is the stored tempo times the speed. The count-in, the notes and the click MUST all use it, with Notes on or off.
- **FR-037**: Speed MUST NOT write the song's tempo or anything else, MUST NOT sync, and MUST NOT appear on any other device. It MUST be held per song for as long as the app stays open, and MUST reset to 100% when the app is next opened.
- **FR-038**: Changing speed, or the stored tempo changing, while running MUST apply from the next note or click not yet queued, with no restart and no count-in, as spec 005 FR-032 says for tempo.
- **FR-039**: Below 100%, the bar MUST show that the speed is reduced while the cluster is closed, without changing the bar's height or moving any control in it.

**The playhead**

- **FR-040**: With Notes on, the reading-position outline MUST follow the column being played, through every column of every pass, set or unset, spaces and each hit of a repeated column included. It MUST change within 50 ms of its column's moment on the audio clock. With Notes off it MUST behave exactly as today.
- **FR-041**: The outline MUST scroll into view under spec 007's existing rule and honour reduced motion. It MUST work through the side-by-side cards and drawn-once cards of entry `wide-reading-layout`, including the live `pass k of n` words.
- **FR-042**: The outline MUST stay the existing reading-position style, a box in the text colour. It MUST NOT be a fill, so it is told apart from a selection without colour. It MUST meet 3:1 contrast against the card in both themes, and it MUST NOT print.
- **FR-043**: Starting MUST clear a keyed reading position, and playback MUST always start from the top, as the click does. Stopping MUST clear the outline.

**Words, and the bar's height**

- **FR-044**: With Notes on and at rest, the bar MUST say which length rule applies, as the click says `Click is a plain beat.`:
  - every playable column is set: `Notes play the lengths written.`
  - some are set: `Notes with no length take the last length, or one beat.`
  - none is set: `No note has a length, so each plays one beat.`
  - nothing to play: `There are no notes to play here.`
  - no tuning: `Add a tuning to hear the notes.`
  - no tempo: `Set a tempo to play the notes.`

  While running it MUST say `Counting in.`, then `Playing.`. The silent-switch help line MUST show while running, as today.
- **FR-045**: Every new message MUST join the bar's held-height set, so the bar is the same height at rest and running in every state (entry `wide-reading-layout` FR-028). Start, Stop, the beat box, the tempo control and More MUST move by no more than 0.5 px when a run starts or stops, or when the cluster opens or closes.
- **FR-046**: State changes MUST be announced to screen readers. Individual notes MUST NOT be.

**Keys and taps**

- **FR-047**: Space MUST start or stop playback with Notes on, and the click with Notes off. `r` MUST start again from the top with the count-in, in both. No other key is added. The help overlay's words for the two keys MUST describe both cases.
- **FR-048**: A quick double tap on Start or Play MUST start one run (INV-024). `click-double-tap.spec.ts` and `click-bar-fit.spec.ts` MUST pass unedited.

**Phones and the screen**

- **FR-049**: While a run plays, the screen MUST stay awake where the device allows, as spec 005 FR-038 says.
- **FR-050**: Leaving the play view MUST stop playback and release the audio. Fifty cycles of starting, stopping, leaving and returning MUST each start, with no audio resources running out.
- **FR-051**: Playback MUST NOT write anything. Its state, the Notes, Click and Loop switches, and the speed MUST NOT be stored on the song or synced.

**Offline**

- **FR-052**: Playback MUST need no network: no samples, no fetched files, no hosted library, and no worklet file. `public/sw.js` and its `VERSION` MUST be unchanged.
- **FR-053**: The code behind playback MUST arrive with the play view. It MUST NOT load on demand at the Play tap, as spec 005 FR-042 says.

**Tests and records**

- **FR-054**: Unit tests MUST cover the note stream with the fake clock pattern the scheduler tests already use:
  - pitches from several tunings, including a five-string, a drop tuning and a guitar tuning, and a string the tuning lacks
  - lengths from durations, repeats and every counted group size from 2 to 16
  - the worked example and every rule of **When a note has no length**
  - every row of **How techniques sound**
  - the loop seam
  - the end of the run
  - agreement with the click's tick for every timed fixture in the existing rhythm corpus
- **FR-055**: A browser check at actual size, in both themes, at 375×667, 412×915 and 1280×800, MUST cover the controls in the cluster, the start control's two labels, the speed shown with the cluster closed, and the outline moving through cards. Screenshots MUST be logged as earlier entries logged theirs.
- **FR-056**: `docs/DECISIONS.md` MUST record that this entry adds pitched playback, which spec 005 put out of scope, and the Decisions below. The Out of Scope line `Pitched playback of the notes.` in `specs/005-rhythm-and-tempo/spec.md` MUST be amended in place to say this entry adds it, in the form earlier amendments use. FR-033 of spec 005 stays true: the click itself is not pitched.

### Key Entities

No stored data changes. Everything below is derived each time a run starts and is never stored or synced.

- **Playback run**: one run from Play to its end or a stop. It has a scope (part playback or the whole arrangement), the Notes, Click and Loop switches, and the effective tempo. It extends spec 005's click run rather than sitting beside it.
- **Note**: one string sounding in one hit of one column. It has a pitch, a start and a length on the run's timeline, an articulation (picked, legato, glide from a pitch, vibrato, muted, dead, ringing, harmonic tone), and the column it belongs to, for the outline.
- **Note stream**: the notes of a run in time order, read from the passes by the length rule and the technique table. It is pure, so it can be tested without sound.
- **Length rule**: **When a note has no length**. It holds the last set length while reading one pass, and nothing else.
- **Speed**: a percentage from 50 to 100, held per song in memory for as long as the app stays open.

## Success Criteria *(mandatory)*

### Measurable Outcomes

**The playback song** is the fixture for SC-002 and SC-005. It is the fit song of entry `wide-reading-layout`, on a 4-string bass in standard tuning at 120 bpm, with every duration cleared, plus one part **T** that uses every row of **How techniques sound**. Its arrangement is that entry's ten passes, then **T**.

- **SC-001**: From the song page, a person can be hearing a part within three taps: menu, Play, Play.
- **SC-002**: On the playback song, the notes scheduled match `drawnPasses` column for column across all eleven passes. Each pitch is equal to `fretToMidi` (or the harmonic table), and each start and length is exactly what **When a note has no length** gives, in the unit suite.
- **SC-003**: For every timed fixture in the existing rhythm corpus, every note starts on exactly the tick the click's notation reading gives its column, and every note that shares a moment with a click is scheduled for the same audio-clock time.
- **SC-004**: Over a ten-minute run at each of 40, 120 and 240 bpm (effective), every note and click is within 1 ms of its ideal time on the audio clock, and the error does not grow, on the fake clock. A loop of the worked example run for ten minutes has no gap or overlap at any seam.
- **SC-005**: Playing the playback song with Notes on at 1280×800 and 375×667, the outline visits every column of every pass in order, and changes within 50 ms of each column's moment.
- **SC-006**: The first count-in click sounds within 200 ms of the tap on Play, on a song of up to 2,000 hits.
- **SC-007**: In 100 stops at random moments, including mid-let-ring, nothing sounds later than 50 ms after the stop.
- **SC-008**: After any number of speed changes and runs, the song's stored tempo is unchanged on every device, and no write was queued for sync.
- **SC-009**: With the network off and a production build, part playback and arrangement playback complete with zero network requests made by playback, and `public/sw.js` is byte-identical to `main`.
- **SC-010**: Every scheduler, stream and click-bar unit test, and every `click-*`, `wide-click-*` and `reading-*` e2e test, passes unedited, except any listed in `docs/DECISIONS.md` with its reason. Every capture test passes unedited.
- **SC-011**: At 375×667, 412×915 and 1280×800 in both themes, the bar's top edge, Start or Play, Stop, the beat box and More move by no more than 0.5 px when a run starts or stops, or the cluster opens. The page never scrolls sideways.
- **SC-012**: Rendered without a speaker, a note on the lowest string of Drop F (F0) has at least half its energy above 200 Hz.
- **SC-013**: In the browser check, a listener can name, for each row of **How techniques sound** that changes the sound, which technique is being played from the sound alone, on a laptop's own speakers.

### Owed to a real phone

A desktop browser cannot prove these. They stay open until someone has done them on a phone, and are not ticked to get past a gate.

- Played from the phone's own speaker at full volume, a part on the B string of a five-string is heard, and its notes are told apart, in a quiet room.
- With the silent switch on, the app stays silent, the outline still moves, and the help line is there.
- With airplane mode on and the app opened from the home screen, part playback and arrangement playback both work on a song opened before, reached by tapping through the app.
- Locking the phone and an incoming call both stop playback cleanly, ringing notes included, and Play works afterwards.
- The screen stays on through a five-minute looped part.
- The cluster's new controls are each hit first time with a thumb at 375 wide.

## Decisions made for this spec

Each is cheap to overturn, and each is recorded in `docs/DECISIONS.md` (FR-056).

1. **Part playback goes through the play view.** The cluster, highlight, keys, stop words and held-height bar all live there, and the brief asks for the controls to fit into that cluster. A second transport on the song page would duplicate them and cost entry `wide-reading-layout`'s fit target. The price is one more tap, because opening part playback cannot itself start the sound (FR-028).
2. **Capture gets no play control.** Its one header row is already full at 375 wide (back, part chips, `+ part`, tempo, help, sync word) and has no menu, and its height budget is fixed. Playing also needs the bar and the outline, which capture cannot host. Back then the card's Play is two taps away.
3. **An unset length takes the last set length in its pass, or one beat.** Most parts are wholly unset, and every reasonable rule gives them one beat a note. For partly notated parts, carrying the length forward is what a person who marked the first note of a run of eighths meant. Resetting at each pass makes a part sound the same wherever it is played. Spec 005 kept "carrying one forward" out of the data, and this does not change that: the rule is applied only while playing and writes nothing.
4. **A bend plays at its fretted pitch.** No target is stored, and a guessed one teaches the wrong note, which is spec 005's rule that a wrong accent is worse than none.
5. **`tap` is ignored.** It sounds as a picked note. A pull-off after it is still legato, which carries most of what tapping sounds like.
6. **Notes start off in the play view, and on in part playback.** The play view is where a band plays along with the click. Starting the notes there by surprise would be the wrong default, and keeping them off leaves every click test true. Opening part playback is asking to hear a part.
7. **Speed runs from 50% to 100% in 5% steps.** The brief asks to slow down. Faster than written is a different practice tool, and can be added later.
8. **Speed is held per song for as long as the app is open.** Slowing one song must not slow the next. Reopening the app restores the written tempo, so nobody plays a gig at 70% by accident.
9. **The count-in always sounds**, even with Click off, because it is how the player knows when the first note comes.
10. **One voice, built from the browser's own audio building blocks, with no worklet.** This needs no static file, so the service worker and its cache strategy are untouched (spec 005 FR-041).
11. **Natural harmonics are 12, 7, 19, 5, 24, 4, 9 and 16.** These are the nodes a fret number can name. Fret 3's harmonic sits at about 3.2, which the model cannot store.

## Out of Scope

- **Recording, the microphone, or audio attachments.** Entry `voice-memos`.
- **Audio or MIDI export.**
- **Sampled instruments, drums, or a different instrument per part.**
- **Per-part tempo, a time signature, or tempo changes within a song.** Spec 005's rules stand.
- **Pitch detection.**
- **Any change to how notation, rhythm or cards are drawn.** Entries `rhythm-notation` and `wide-reading-layout`.
- **Bend targets.** A notation change.
- **Starting from a chosen pass, bar or column, or looping a range of bars.** Playback starts from the top, as the click does. Part playback with Loop is this entry's practice loop.
- **Speeds above 100%, volume, a mix between notes and click, swing, or a choice of voice.**
- **A play control in capture.** Decision 2.
- **Playback on the song page itself.** Decision 1.

## Assumptions

- Spec 005's reading of time holds: a beat is a quarter note, and its group fractions are right. Playback inherits both, including what spec 005 accepts about compound time.
- One plucked voice is enough to recognise a part. The aim is to hear the notes and their timing, not a convincing bass tone.
- A phone's speaker cannot reproduce a bass's fundamental. Overtones carry the pitch there, and headphones or a PA give the whole sound.
- The bar's held-height approach (entry `wide-reading-layout` FR-028) can hold the new words at 375 wide without the bar growing. If a message needs a second line, its words are shortened rather than the bar made taller.
- The cluster may wrap onto more rows when Notes is on. It opens upward over the staves (entry `wide-reading-layout` FR-029), so this costs no permanent height.
- Spec 007's touch floors and the rule against opacity over a surface token apply to every new control, and the `npm run dev:clean` trap applies to the browser check.
- The fake clock in the scheduler tests can stand in for the sound port's new note queue, so timing is proven without audio.
- Viewers are not gated: playback writes nothing.

### Dependencies

All of these are merged on `main`:

- Spec 002: techniques, their drawn priority, and dead notes as `x`.
- Spec 003: group kinds and numbers.
- Spec 005: the click, the scheduler, the sound port, the count-in, the stop reasons, tap tempo, the duration table and group fractions, FR-028, FR-032, FR-041, FR-042 and INV-024.
- Spec 006: variants.
- Spec 007: the cluster, touch floors, the reading position and its scroll rule.
- Entry `usability-polish`: the part card menu.
- Entry `rhythm-notation`: the rhythm row, unchanged here.
- Entry `wide-reading-layout`: side-by-side cards, drawn-once cards with live pass words, and the held-height click bar.
