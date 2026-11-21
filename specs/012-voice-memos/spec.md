# Feature Specification: Voice memos on a part, recorded offline and synced to the band

**Feature Branch**: `012-voice-memos`

**Created**: 2026-11-16

**Status**: Draft

**Input**: User description: "Let someone at practice record a short audio clip on a part with the phone's microphone, keep it on the device with no network, play it back beside the tab, and sync it to the rest of the band through the server." (full roadmap entry, with file references for planning: `.specify/roadmaps/best-in-class.json`, entry `voice-memos`)

## Summary

Tab says which frets and roughly when. It does not capture the feel of a riff: the swing, the ghost notes, what the drummer was doing, the way the singer wants the chorus to land. At practice the quickest way to keep that is to hold up a phone and record twenty seconds. Today that recording lands in the phone's voice-memo app, separate from the tab, and nobody else in the band gets it.

This entry puts the recording on the part:

1. **Record on a part.** A part's card gets **Record memo**. The phone records from its microphone, with a visible countdown to a fixed limit, and the clip is saved on the device at once. No network is needed.
2. **Play it beside the tab.** The part's memos are listed under its staff on the song page, each with play, pause and a position bar.
3. **The band gets it.** When the device is online and signed in, the memo is uploaded to the band's server. Every bandmate's device fetches it, so it is there at the next practice even with no signal.
4. **Delete means erased.** Deleting a memo removes its audio from the server and from every device once they sync. Unlike every other delete in the app, the audio is not kept.

This is the only entry in the roadmap that changes sync and storage. It adds one synced table for the memo's details, and moves the audio itself by a separate path, so a long clip never holds up the sync of the tab.

### Where the brief and the code differ

| The brief says | The code says | What this spec does |
|---|---|---|
| "Recording or playing a memo stops tab playback and the click through the shared engine's stop path" | There is no shared engine. Each play view makes its own engine (`useClick`), and the click and the notes exist only in the play view. Leaving the play view already stops them (stop reason `left`). | Memos live on the song page only, not in the play view or on the capture screen. The two sound sources are never on the same screen, so they cannot overlap. FR-040 to FR-042 state the rule and keep it true if they ever share a screen. |
| "Who recorded it" is a field on the row | Devices hold no list of band members or their names. A signed-out device has no user at all. | The memo carries the recorder's account and the name to show for it. The server sets both from the signed-in account when the memo first arrives, and does not accept a device's claim to be someone else (FR-006, FR-007). The structural-field merge rule (structural fields are set once at insert) has to let the server's stamp reach the device that recorded it. That is a planning problem, and is flagged in Assumptions. |
| "Use the overflow for record if the card face has no room" | The card's header row already holds the label, the name, the heading line and the overflow, and wraps on a phone. A record button there would add a line on many phones, and would cost entry `wide-reading-layout`'s fit target (its SC-002). | **Record memo** goes in the card's overflow menu, beside Play and Edit (FR-010). A part with no memos adds nothing to the card face. |
| "Deletes are tombstones" and the privacy page says deleting does not erase | A voice is personal data, and a band member who deletes a recording of their own voice expects it gone. | The memo's row is tombstoned like every other row. Its **audio** is erased: on the server when the tombstone arrives, and on each device when it pulls the tombstone (FR-060 to FR-064). The privacy page says so (FR-090). |
| "Deleting" (of a memo) | Deleting a part is one tap with no confirmation (spec 008, FR-014). A part's memos would be hidden with it, and their audio kept on the server with no way to delete it. | Deleting a part that has memos asks first, names how many memos go with it, and deletes those memos too, erasing their audio (FR-065). Deleting a part with no memos is unchanged. |

### Decisions this spec makes (the brief asked for each)

| Question | Decision |
|---|---|
| Where the audio is kept on the server | In Postgres, in its own table of audio bytes (`bytea`) keyed by the memo's id, outside the synced tables and outside pull. Not Postgres large objects: they are not deleted with their row, which would defeat FR-061. No new service: self-hosting stays `docker-compose.yml` and `.env`. |
| Longest clip | **3 minutes.** Recording stops itself at 3:00. |
| Largest clip | **8 MB** (8 × 1024 × 1024 bytes). Recording also stops itself before it reaches this. |
| Formats accepted | `audio/mp4`, `audio/webm` and `audio/ogg`, each with or without a `codecs` parameter naming AAC (`mp4a.*`) or Opus. Nothing else. |
| Per-band total | **Yes: 500 MB** of live (not deleted) memo audio per band on the server. An upload that would pass it is refused with a readable message. The audio stays on the recording device. |
| When the server drops bytes | When the memo's tombstone arrives in a push, in the same transaction. |
| When other devices drop bytes | When they pull the tombstone. |
| Memos on the capture screen | **No.** Capture's height budget (spec 007 FR-064, and its height test) is untouched. |
| Memos in the play view | **No.** See the first row of the table above. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a memo on a part and play it back, with no network (Priority: P1)

At practice, in a basement with no signal, the guitarist plays the new chorus riff. The bassist opens the song, opens part B's menu, taps **Record memo**, and holds the phone up. A panel on the card shows the time recorded, the time left and a level indicator that moves with the sound. They tap **Stop**. The memo appears under part B's staff, and they play it back straight away.

**Why this priority**: This is the feature. Without it nothing else in the entry has anything to sync or show. On its own it is already useful: a recording kept beside the tab it belongs to, which works offline and signed out.

**Independent Test**: With the network off and the user signed out, record a clip on a part with a fake microphone, stop it, reload the page, and play the clip from the part's card. It plays and its length is shown.

**Acceptance Scenarios**:

1. **Given** a song page on a device with a microphone, served over a secure address, **When** the user opens a part's menu, **Then** it offers **Record memo**, and the item's accessible name names the part.
2. **Given** the user chooses **Record memo** for the first time on this device, **When** the browser asks for the microphone and the user allows it, **Then** recording starts. The card shows the time recorded, the time left counting down from 3:00, a level indicator, **Stop** and **Discard**.
3. **Given** recording is running, **When** the user taps **Stop**, **Then** the clip is saved on the device and appears in the part's memo list. It shows its length, its recorder (or "You" when signed out) and when it was recorded, and it can be played at once.
4. **Given** recording is running, **When** the user taps **Discard**, **Then** after one confirming tap nothing is saved, and the card says the recording was discarded.
5. **Given** recording reaches 3:00, **When** the limit is hit, **Then** recording stops itself, the clip is saved, and the card says it stopped at the 3-minute limit.
6. **Given** a saved memo, **When** the user taps its play button, **Then** it plays from the start, the position bar moves, and the elapsed time counts. Pause holds the position, and tapping or dragging the bar seeks.
7. **Given** the device is offline and signed out, **When** the user records, reloads and plays, **Then** everything works and no request is made to the server.

---

### User Story 2 - The memo reaches the rest of the band (Priority: P1)

After practice the bassist's phone gets a signal. The memo uploads with no action from them. That evening the drummer opens the song on a laptop, sees the memo under part B, and plays it. At the next practice, with no signal, the drummer's phone already has it.

**Why this priority**: The roadmap entry's point is a recording the whole band shares. Without this, the entry is a voice recorder that happens to sit beside the tab.

**Independent Test**: Two signed-in browser contexts in the same band. Context A records a memo. Within a stated time, context B shows it under the same part, downloads its audio and plays it.

**Acceptance Scenarios**:

1. **Given** two signed-in members of a band, both online, **When** A records a memo on a part, **Then** within 10 seconds B's song page lists it under the same part, and it plays on B once its audio has arrived.
2. **Given** A is offline, **When** A records a memo, **Then** A's memo shows that it will upload when the device is online. **When** A comes back online, **Then** it uploads with no action from the user, and B receives it as in scenario 1.
3. **Given** B has the memo's details but not yet its audio, **When** B looks at the memo, **Then** it says it is downloading, or that it is waiting for the recording device to upload it. It shows no play control that would fail.
4. **Given** B has downloaded a memo's audio, **When** B goes offline and reloads, **Then** the memo still plays.
5. **Given** a signed-out user who recorded memos, **When** they sign in, **Then** their memos and the audio upload along with the rest of their work.
6. **Given** a member with read-only access to a band, **When** they record a memo on one of its parts, **Then** it stays on their device, and the memo says the server refused it because their access is read-only, in the same words the app uses for other refused writes.

---

### User Story 3 - A recording is never silently lost (Priority: P1)

The phone rings in the middle of a recording. Or the bassist switches to another app to check a message. Or the browser was never given the microphone. In each case the app either keeps what was recorded and says so, or says plainly that nothing was kept and why.

**Why this priority**: A recording lost without a word, at the one moment the riff was played, is the failure that would stop a band trusting the feature. It is P1 because it is part of recording, not an extra.

**Independent Test**: With a fake microphone, start recording and then, in turn: end the microphone track, hide the page, and fill the device's storage. Each case ends with either a saved memo and a notice, or a notice that nothing was kept.

**Acceptance Scenarios**:

1. **Given** the user denies the microphone, **When** recording was asked for, **Then** no recording starts, and the card says the microphone was refused and how to allow it in the browser's settings.
2. **Given** recording is running, **When** the microphone is taken away (a phone call, another app, the permission withdrawn, the device unplugged), **Then** what was recorded up to that point is saved as a memo, and the card says the recording was cut short and how long the kept part is.
3. **Given** recording is running, **When** the page is hidden (the user switches app or locks the phone), **Then** recording stops, what was recorded is saved, and on return the card says the recording stopped when the app was left.
4. **Given** recording stops for any reason after less than 1 second, **When** it ends, **Then** nothing is saved, and the card says the clip was too short to keep.
5. **Given** the device has no room left, **When** a clip is being saved, **Then** the card says the device is out of room and offers **Try again** and **Download the clip**, and keeps the clip in memory until one of them succeeds or the user discards it.
6. **Given** the app is closed or crashes during recording, **When** it is opened again, **Then** the clip up to the last moment that was saved is recovered as a memo with a notice, or, if it cannot be played, a one-time notice says a recording was cut off and could not be recovered.

---

### User Story 4 - Recording where the microphone does not exist (Priority: P2)

A band self-hosts on a box in the rehearsal room and reaches it at `http://192.168.1.20:3000`, as the README's `APP_URL` advice leads them to. Browsers give no microphone to a page on a plain-http address that is not `localhost`. Instead of a button that does nothing, the menu item says why recording is unavailable and what fixes it.

**Why this priority**: Self-hosting on a LAN address is the README's own recipe, so many installations will hit this on day one. It is P2 because playback, sync and every other story still work there; only recording does not.

**Independent Test**: Serve the app at a non-secure origin (a LAN IP over http). The part menu shows **Record memo** as unavailable, with an explanation that names the reason and the fix. Memos synced from elsewhere still play.

**Acceptance Scenarios**:

1. **Given** the app is open at a plain-http address that is not `localhost`, **When** the user opens a part's menu, **Then** **Record memo** is shown as unavailable, and choosing it explains that this browser only allows the microphone on a secure (https) address, that the person who runs the server can fix it, and that memos recorded elsewhere still play here.
2. **Given** a browser with no microphone or no recording support at a secure address, **When** the user opens the menu, **Then** **Record memo** is unavailable with a message that says so, and not the secure-address message.
3. **Given** the README, **When** a self-hoster reads the setup section, **Then** a note says recording needs https (or `localhost`), and points to ways to put https in front of the app without changing `docker-compose.yml`.

---

### User Story 5 - Label, keep a copy of, and delete a memo (Priority: P2)

The memo list fills up over a few practices. The bassist names one "Chorus feel, slower", downloads one to send to a friend, and deletes an old one where the guitarist was still working out the riff.

**Why this priority**: Without labels, the list is a column of dates. Without delete, nobody can take back a recording of their own voice. It is P2 because a band can use the feature for a while without either.

**Independent Test**: Label a memo, check the label syncs to a second context. Delete a memo, check it vanishes from both contexts and its audio is gone from the server and from both devices.

**Acceptance Scenarios**:

1. **Given** a memo, **When** the user opens its menu, **Then** it offers **Rename**, **Download** and **Delete**, each with an accessible name that names the memo.
2. **Given** the user renames a memo, **When** they save, **Then** the label shows in place of the default title, and syncs to the band like any other edit, including when two people rename it offline.
3. **Given** the user chooses **Delete**, **When** they confirm, **Then** the memo disappears from the list on this device at once, and from every bandmate's device once they sync. Its audio is erased from the server and from each device.
4. **Given** a part with two memos, **When** the user deletes the part, **Then** a confirmation says the part's 2 memos will be deleted with it. Confirming deletes the part and the memos. Cancelling deletes nothing.
5. **Given** a memo the device cannot play, **When** the user chooses **Download**, **Then** the file saves with an extension that matches its format.

---

### User Story 6 - A clip recorded on one phone plays on the others, or says why not (Priority: P3)

The bassist records on an iPhone, and the guitarist plays it back on an Android phone. Mostly that works. Where a browser cannot play a format, the memo says so and offers the file to download, rather than a play button that does nothing.

**Why this priority**: The recorder prefers a format every current browser plays (FR-012), so this is the fallback for older browsers. It is P3 because it is rare, but when it happens it must not look like a broken feature.

**Independent Test**: Give a context a memo whose format the browser reports it cannot play. The memo shows the message and **Download**, and no play control.

**Acceptance Scenarios**:

1. **Given** a memo in a format this browser cannot play, **When** it is drawn, **Then** it says this browser cannot play its format (naming it plainly, e.g. "WebM audio"), offers **Download**, and shows no play control.
2. **Given** a memo whose audio fails to decode when played, **When** playback fails, **Then** the memo says it could not be played, and offers **Download**.

---

### Edge Cases

- **A memo arrives on a device before its part.** It is held, as any child row is, and drawn when the part arrives.
- **The audio arrives before the row**, or the row is still waiting to be pushed. An upload needs the row on the server first, so upload waits until the row has been accepted.
- **The recorder's device never comes back online.** Other devices show the memo as waiting for the recording device to upload it, indefinitely. No error, no player.
- **The memo is deleted on one device while another is still uploading it.** The server refuses the upload, because the memo is deleted, and the uploading device drops its queued upload and its local copy.
- **The memo is deleted on the recording device before it ever uploads.** The queued upload is dropped with the local audio. The tombstone still syncs.
- **Two devices rename the same memo offline.** Last write wins by its clock, as for every field. The convergence test covers it.
- **Someone undeletes a memo with no audio left anywhere.** No undo for memo delete is offered. If a live memo row ever has no audio on the server and the server says its audio was erased, the memo says its audio was deleted.
- **Upload is refused** for size, format, the band total or read-only access. The memo keeps its audio on the recording device, plays there, and shows the server's message. A refused upload is not retried until something changes (the user signs in as someone else, deletes other memos, or the band total frees up), and the user can retry by hand.
- **An upload is cut off mid-transfer.** Nothing partial is kept on the server. It is retried whole.
- **A hostile client** sends more than 8 MB with a false length header, a disallowed format, bytes that do not match the declared format, a second different file for a memo that already has audio, or audio for a memo in a band they are not in. Each is refused. None stores anything.
- **A second recording while one is running.** Only one recording runs at a time on a device. **Record memo** is unavailable on other parts while one runs, and says why.
- **A memo is playing when recording starts.** It stops first. Only one memo plays at a time.
- **The user leaves the song page during recording** by an in-app link or the back button. Recording stops and keeps what it has, with a notice the next time the song page is shown.
- **Storage is not persisted.** The browser refused persistent storage, or never answered. Nothing blocks. The memo area of the first memo recorded on the device says once that the browser may clear memos if the device runs short of space, and suggests adding the app to the home screen.
- **Downloads fill the device.** Fetching bandmates' memos stops, the memo that did not fit says the device is out of room, and fetching resumes when room is made.
- **The iOS silent switch is on.** A memo is media, so it plays with the silent switch on, as a video does. This is one of the real-phone checks owed (SC-010).
- **Printing.** Memo lists and controls do not print, as the card's other controls do not.
- **Plain-text export.** Memos are not in it, and it does not change.

## Requirements *(mandatory)*

### Functional Requirements

#### The memo and its storage

- **FR-001**: A memo MUST belong to exactly one part, and through it to that part's band. Memos MUST NOT be attached to songs, bands or columns.
- **FR-002**: A memo's details MUST be an ordinary synced row with a client-minted id, kept in the device's local store, read by screens only from that store, and written only through the app's local write path, so it syncs as every other row does.
- **FR-003**: A memo's details MUST include: its part and band, its recorder (FR-006), its length in milliseconds, its format, its size in bytes, when it was recorded, an optional label, and the deletion marker every synced row has.
- **FR-004**: Only the label and the deletion marker MAY change after a memo is created. Each MUST carry its own clock and merge the way every other mergeable field does, so the memo row's merge stays commutative and idempotent. Everything else is set once when the memo is recorded.
- **FR-005**: The memo's details MUST be added everywhere the app's synced tables are declared, so the existing schema drift guard covers it and `npm run typecheck` fails if the server and device descriptions of a memo drift apart. The server side MUST come with a generated migration.
- **FR-006**: The memo MUST record who recorded it: the account, and the name to show for it. The server MUST set both from the signed-in account that first pushes the memo, and MUST NOT store a device's claim that a memo was recorded by a different account. The device that recorded it MUST show the server's values once they sync back.
- **FR-007**: Before a memo has synced, the device that recorded it MUST show the recorder as "You".
- **FR-008**: A memo's audio MUST NOT travel in the row sync. It MUST be stored on the device under the memo's id, and uploaded and downloaded by its own path, so a pull of rows never carries audio.
- **FR-009**: On the server, audio MUST be stored in the app's existing Postgres database, in its own table keyed by memo id. Self-hosting MUST still need only `docker-compose.yml` and `.env`. No new environment variable is required.

#### Recording

- **FR-010**: Each part card on the song page MUST offer **Record memo** in its overflow menu. Choosing it starts recording on that part.
- **FR-011**: The first recording on a device MUST ask the browser for the microphone at the moment the user chooses **Record memo**, not before. The app MUST NOT ask for the microphone on page load.
- **FR-012**: The recorder MUST choose, from the formats the browser can record and the allow-list in FR-031, the one most widely playable on other browsers. The order is MP4 audio (AAC), then WebM (Opus), then Ogg (Opus). The chosen format MUST be stored with the memo.
- **FR-013**: While recording, the card MUST show: the time recorded, the time left before the 3-minute limit, a level indicator that moves with the input, **Stop** and **Discard**. The time left MUST be readable at a glance, and MUST change style to stand out in the last 15 seconds. It MUST be announced to screen readers at 1 minute, 30 seconds and 10 seconds left, and not every second.
- **FR-014**: Recording MUST stop itself at 3 minutes, and also before the clip would pass 8 MB, whichever comes first. It MUST keep the clip, and say which limit was reached.
- **FR-015**: **Stop** MUST save the clip and add it to the part's memo list. **Discard** MUST ask once to confirm, and then save nothing and say so.
- **FR-016**: Recording MUST save the clip to the device as it goes, at least once a second, so a crash or closed app loses at most the last second (US-3 scenario 6).
- **FR-017**: A clip shorter than 1 second MUST NOT be saved, and the card MUST say it was too short to keep.
- **FR-018**: Only one recording MAY run at a time on a device. While one runs, **Record memo** on every other part MUST be unavailable and say a recording is already running.
- **FR-019**: Recording MUST NOT change the part, its columns, its rhythm or anything else about the song.

#### When recording is interrupted

- **FR-020**: If the microphone is refused, the card MUST say so and say how to allow it in the browser's settings. No memo is created.
- **FR-021**: If the microphone is taken away during recording (track ended or muted by the system, a call, the device unplugged, the permission withdrawn), recording MUST stop, keep what was recorded, and say the recording was cut short and how long the kept part is.
- **FR-022**: If the page is hidden during recording, recording MUST stop and keep what was recorded. When the page is shown again, the card MUST say the recording stopped when the app was left.
- **FR-023**: If the user leaves the song page during recording, recording MUST stop and keep what was recorded, and say so the next time the song page is shown.
- **FR-024**: If the device has no room to save a clip, the card MUST say the device is out of room, keep the clip in memory, and offer **Try again** and **Download the clip** until one succeeds or the user discards it. A full device MUST NOT lose a clip without a word.
- **FR-025**: When the app opens after a recording was cut off by a crash or close, it MUST either recover the saved part of the clip as a memo, with a notice, or, if it cannot be played, show a one-time notice that a recording was cut off and could not be recovered, and drop it.
- **FR-026**: Every ending in FR-014 and FR-020 to FR-025 MUST leave either a saved memo with a notice, or a notice that nothing was kept. No ending is silent. The microphone MUST be released (the browser's recording indicator goes off) at every ending.

#### Where recording is not possible

- **FR-027**: When the page is not in a secure context (for example plain http on a LAN address), **Record memo** MUST be shown as unavailable. Choosing it MUST explain that the browser only allows the microphone on a secure (https) address or on `localhost`, that the person who runs the server can set this up, and that memos recorded elsewhere still play here.
- **FR-028**: When the page is secure but the browser has no microphone access or no recording support, **Record memo** MUST be unavailable with a message that says that, and not the secure-address message.
- **FR-029**: The README MUST gain a note in its self-hosting section: recording memos needs https or `localhost`; a plain-http LAN address will not record; and https can be put in front of the app (a reverse proxy, or a tunnel the band already uses) without changing `docker-compose.yml`.

#### Upload and download

- **FR-030**: A memo's audio MUST be uploaded and downloaded through two new routes. Both MUST require a signed-in account. The upload route MUST require write access (owner or editor) to the memo's band. The download route MUST require membership of the memo's band. A request for a memo the account cannot see MUST get the same answer as a memo that does not exist.
- **FR-030a**: The download route MUST tell three answers apart for a memo the account can see: the audio (with its stored format and `nosniff`), "not uploaded yet", and "erased because the memo was deleted". The last MUST stay true even if the memo's row later comes back live.
- **FR-031**: The upload route MUST accept only the formats in the allow-list (`audio/mp4`, `audio/webm`, `audio/ogg`, each optionally with a `codecs` parameter naming AAC or Opus). It MUST check that the bytes begin as the declared container does, and refuse a mismatch.
- **FR-032**: The upload route MUST enforce the 8 MB limit on the bytes it actually reads, stopping as soon as the limit is passed, whatever length the request claims. It MUST store nothing from a refused or incomplete upload.
- **FR-033**: The upload route MUST refuse audio whose size does not match the memo's stated size, audio for a memo that is deleted or whose audio was erased, and a second, different file for a memo that already has audio. Uploading the same file again MUST succeed with no change, so a retry is safe.
- **FR-034**: The upload route MUST refuse an upload that would take the band's live memo audio past 500 MB. Deleted memos' audio does not count, because it is erased (FR-061).
- **FR-035**: Every refusal MUST carry a message a bandmate can read, and the recording device MUST show it on the memo. The messages MUST say what happened and what to do: for example "This memo is larger than 8 MB, the most the server accepts", "This band's memos have used all 500 MB of room on the server. Delete some old memos to sync this one.", "You have read-only access to this band."
- **FR-036**: Uploads MUST be queued on the device, and the queue MUST survive a reload. The queue MUST be worked whenever the device is online and signed in, and only after the memo's row has been accepted by the server. A failure from the network or the server MUST be retried with growing waits. A refusal (FR-031 to FR-034, or read-only access) MUST NOT be retried until the user chooses **Try again** or the account changes.
- **FR-037**: A signed-in device MUST fetch the audio of every live memo it has the row for, with no action from the user, so memos are there at the next offline practice. Fetches MUST run one at a time, newest memo first. A device MUST NOT fetch audio while signed out.
- **FR-038**: When a memo's audio finishes uploading, other online devices in the band MUST be told, and MUST fetch it within 10 seconds, with no reload.
- **FR-039**: A memo with no audio on this device MUST show its state instead of a player: **Downloading**; **Waiting for the recording device to upload it**; **Couldn't download** with **Try again**; or **Out of room on this device**. A memo whose audio was erased MUST say its audio was deleted. A memo that is only on this device MUST say where it stands: **Saved on this device** when signed out (consistent with entry `usability-polish`), **Will upload when online** when offline, or the server's refusal message (FR-035).

#### One sound at a time

- **FR-040**: At most one memo MAY play at a time. Starting one stops any other. Starting a recording stops any memo that is playing.
- **FR-041**: Memos MUST appear only on the song page. They MUST NOT appear on the capture screen (so spec 007's capture height budget, FR-064, and its height test are untouched) or in the play view (where the click and the notes of entry `tab-playback` play).
- **FR-042**: Leaving the play view already stops the click and the notes through the engine's own stop (reason `left`). That MUST stay true, and an end-to-end test MUST check that after leaving a running play view for the song page, nothing from the play view is sounding when a memo starts. If a later entry puts memos and the engine on one screen, starting a memo or a recording MUST stop the engine through that same stop, and starting the engine MUST stop any memo.

#### Showing memos

- **FR-043**: A part's memos MUST be listed under its staff, inside its card, in the order they were recorded, oldest first. A part with no memos MUST add nothing to its card. With the fit song of entry `wide-reading-layout` (which has no memos), that entry's SC-001 and SC-002 tests MUST pass unchanged.
- **FR-044**: The list MUST use the card's full width, on phones and in the wide layout of entry `wide-reading-layout`. When a part has more than 3 memos, the list MUST show the newest 3 and a control that shows the rest. Whether the rest are shown is remembered on the device.
- **FR-045**: Each memo MUST show: its label, or "Memo" and its number in the part when unlabelled; its recorder; the date it was recorded; its length (m:ss); and either a player or its state (FR-039). The player MUST have play and pause, a position bar the user can tap or drag to seek, and the elapsed time.
- **FR-046**: Each memo MUST have its own menu with **Rename**, **Download** and **Delete**. The menu MUST behave like the part card's overflow menu (spec 008, FR-016): keyboard, Escape, outside tap, focus return, accessible names that name the memo.
- **FR-047**: Every control in this entry MUST meet spec 007's target sizes for each pointer type, and MUST read correctly in both themes at actual size.
- **FR-048**: A memo the browser cannot play MUST say so, naming the format in words ("WebM audio", "MP4 audio", "Ogg audio"), and offer **Download** instead of a player. A memo that fails to decode when played MUST say it could not be played and offer **Download**.
- **FR-049**: **Download** MUST save the memo's audio with a file name built from the song, part and label or date, and an extension matching its format.

#### Deleting

- **FR-060**: Deleting a memo MUST ask once to confirm, saying it deletes the memo for everyone in the band. It MUST then tombstone the memo's row through the local write path, as every delete does.
- **FR-061**: When a memo's tombstone reaches the server, the server MUST erase the memo's audio in the same transaction.
- **FR-062**: When a device applies a memo's tombstone, local or pulled, it MUST erase the memo's audio from the device and drop any queued upload or download for it.
- **FR-063**: No undo of a memo delete is offered. A live memo row whose audio the server reports as erased MUST show that its audio was deleted (FR-039), and not a player.
- **FR-064**: The tombstoned row MAY keep the memo's details (part, recorder, length, format, size, date, label), as every tombstone keeps its row. The privacy page MUST say so.
- **FR-065**: Deleting a part that has live memos MUST first ask to confirm, saying how many memos will be deleted with it. Confirming MUST delete the part and tombstone each of its memos in one write. Deleting a part with no memos MUST behave as it does today (spec 008, FR-014).

#### Storage on the device

- **FR-070**: The first time a memo is recorded or fetched on a device, the app MUST ask the browser to keep its storage persistent. A refusal MUST NOT block anything. If storage is not persistent, the memo area MUST say once, on that device, that the browser may clear memos if the device runs short of space, and suggest adding the app to the home screen.
- **FR-071**: A full device while fetching MUST stop further fetches, mark the memo that did not fit as **Out of room on this device**, and resume when the user chooses **Try again** or the next sync cycle runs.

#### Signed out

- **FR-080**: A signed-out user MUST be able to record, play, rename, download and delete memos. Their memos and audio MUST stay on the device and make no request to the server.
- **FR-081**: When a signed-out user signs in, their memos MUST sync and their audio MUST upload along with the rest of their local work, with no further action.

#### Privacy

- **FR-090**: Before this ships, `src/app/privacy/page.tsx` MUST be updated: voice recordings are listed under what is stored; they are stored on the device and in the operator's database; every member of the band can play and download them; deleting a memo erases its audio from the server and from devices as they sync, unlike other deletes, while the small record of the memo stays; a signed-out recording never leaves the device; and the microphone is used only while the user is recording. Its date MUST change.
- **FR-091**: Every other place that lists what is stored MUST be updated to include voice recordings: at least the sign-up form's sentence about what syncs (`AuthForm`) and the terms page's sentence about what remains yours.

#### Tests and checks

- **FR-100**: Unit tests MUST show that the memo row merges to one outcome over all 24 orderings of four concurrent edits (label changes and a delete from different devices), and that merging is idempotent, as the existing convergence test does for other rows.
- **FR-101**: Server tests MUST cover both routes for: no session; a non-member; a read-only member uploading; a member downloading; a declared length under 8 MB with a body over it; a body over 8 MB with no declared length; a disallowed format; bytes that do not match the declared format; a size that does not match the row; a deleted memo; a second, different file; a repeated identical upload; the band total; and the erase on tombstone.
- **FR-102**: An end-to-end test with the browser's fake microphone MUST record a memo, play it, and see it reach a second signed-in context and play there. A second end-to-end test MUST record while offline, reconnect, and see the upload reach the second context. A third MUST cover the interruption endings FR-020 to FR-022 that a fake device can produce.
- **FR-103**: A browser check at actual size, in both themes, at 375 and 1280 wide, MUST cover: a card recording, a card with memos in each state of FR-039, a memo that cannot play, and the unavailable **Record memo** on an insecure address. It is recorded the way earlier entries recorded theirs.
- **FR-104**: The real-phone checks listed in SC-010 MUST be recorded as owed in `docs/DECISIONS.md`, with what each should show.
- **FR-105**: Decisions this spec makes (the two tables at the top) MUST be recorded in `docs/DECISIONS.md`.

### Key Entities

- **Memo**: a short audio recording attached to one part. Its details: id, band, part, recorder (account and display name), length in milliseconds, format, size in bytes, recorded-at time, optional label, deletion marker, and the clocks every synced row carries. Label and deletion marker are the only fields that change.
- **Memo audio**: the recorded bytes of one memo, keyed by the memo's id. Kept on each device that has it and once on the server. Never part of the row sync. Erased when the memo is deleted.
- **Upload queue entry**: a memo whose audio this device holds and the server does not yet. It records the attempts made and the last refusal, if any, and survives a reload.
- **Memo audio state** (per device, derived, not synced): on this device; uploading; waiting to upload; refused (with message); downloading; waiting for the recording device; could not download; out of room; deleted; unplayable format.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a song page, a user can start recording on a part in 2 taps on a device that has already allowed the microphone (open the part's menu, choose **Record memo**), and the memo is playable within 1 second of tapping **Stop**.
- **SC-002**: With the device offline and signed out, a memo recorded, reloaded and played back succeeds in 100% of runs of the end-to-end test, and the app makes no network request for it.
- **SC-003**: With two members online, a memo recorded on one device is listed and playable on the other within 10 seconds of **Stop**, for a 30-second clip.
- **SC-004**: A memo recorded offline is listed and playable on a bandmate's online device within 10 seconds of the recording device reconnecting.
- **SC-005**: In every interruption ending the tests can produce (refused microphone, microphone taken away, page hidden, leaving the page, too short, device full, limit reached), the user sees either a saved memo with a notice or a notice that nothing was kept. 0 silent losses.
- **SC-006**: The server stores nothing, and returns a readable refusal, for 100% of the hostile uploads in FR-101, including a body over 8 MB sent with a smaller declared length.
- **SC-007**: After a memo is deleted, its audio is gone from the server at once, and from every bandmate's device within one sync cycle of it coming online.
- **SC-008**: The memo row converges to one outcome over all 24 orderings of four concurrent edits.
- **SC-009**: The capture height test (spec 007) and entry `wide-reading-layout`'s fit tests (its SC-001 and SC-002) pass unchanged. No part with no memos is any taller than before.
- **SC-010**: Owed on real phones, and recorded in `docs/DECISIONS.md` when done: recording on an iPhone (Safari) and on an Android phone (Chrome); a clip recorded on each plays on the other; recording in airplane mode, then syncing when back online; a memo plays with the iPhone's silent switch on; a call arriving during recording keeps the clip up to the call.

## Assumptions

- **The structural-field rule needs a small exception for the recorder.** Today a structural field is set once at insert and never changed by a merge. FR-006 has the server set the recorder at insert, which the recording device must then see. The plan chooses how: for example, pulled rows replace structural fields that are still empty on the device. Whatever it chooses must keep the merge commutative and idempotent, and the convergence test must still pass.
- **Limits.** 3 minutes covers a riff, a verse-chorus run-through or a spoken explanation, and keeps a clip well under 8 MB in every allowed format at typical phone bitrates. 8 MB leaves room for a browser that records at a high bitrate. The recorder asks for a modest bitrate (speech-and-instrument quality, around 64–128 kbps) where the browser allows it; the plan picks the value.
- **500 MB per band** is about 500 three-minute clips at typical bitrates. It protects the operator's disk from one band without getting in the way of normal use. It is a constant, not a setting; an operator who needs another value changes the code.
- **Eager fetching** (FR-037) is chosen because the app's premise is that nothing waits on the network at practice. A band near its 500 MB total puts that much on each member's device. That is accepted for now and recorded as a decision.
- **Format support.** Current Safari and Chrome both play MP4 audio (AAC). Recent Chrome can record it, so preferring it (FR-012) should make most clips play everywhere. Where a browser can only record WebM or Ogg, an older Safari may not play the result, which is what US-6 handles. The plan confirms which browsers record which formats.
- **Viewers** (read-only members) can play and download memos, and their own recordings stay on their device with the read-only message. This is the existing rule for every write.
- **The level indicator** is drawn from the microphone input during recording only. It is not a waveform of saved memos.
- **Persistent storage** cannot be forced. Browsers decide, and some grant it only to installed apps, hence the home-screen suggestion.
- **Accounts already carry a display name**, set at sign-up, which is what the recorder name shows.

## Out of Scope

- Pitch detection, transcription, or turning audio into tab (out of scope for the whole roadmap).
- Trimming, splitting, joining or otherwise editing audio. A memo's audio never changes after it is recorded.
- Memos on songs, bands or individual columns. Only on parts.
- Streaming or live audio, and playing a memo before its audio is fully on the device.
- Any change to tab playback, the click or the engine (entry `tab-playback`), beyond FR-042's guard.
- Any change to the plain-text export.
- Memos on the capture screen or in the play view (FR-041).
- Slowing down or looping memo playback. Recorded as an idea in `docs/DECISIONS.md`.
- An undo for memo delete.
- A server-side purge of other tombstoned rows. Only memo audio is erased.
- Deleting songs or bands: the app offers no control for either today, so nothing about them changes here.
