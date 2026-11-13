# Data model: Usability polish

**Nothing is stored.** This entry adds no field, table, index, migration, outbox entry, sync message or `localStorage` key (FR-037). Every
entity below is derived on each render and dropped afterwards. `src/lib/model.ts`, `src/db/`, `drizzle/` and `src/lib/sync/` have zero
diff (INV-023).

## Band geometry (derived, capture only)

Read from the DOM by `useCaptureBand` ([contracts/capture-band.md](./contracts/capture-band.md)) and decided by the pure functions in
`src/lib/capture/band.ts`.

| Field | Type | Source | Rule |
|---|---|---|---|
| `band` | px | the band's `clientHeight` less its padding | Depends on the viewport and the fixed rows only, never on the staff (R2). |
| `line` | px | the height of the first drawn `[data-testid="tab-column"]` | 0 when the part has no columns. |
| `gap` | px | `getComputedStyle(band).rowGap`, which resolves `--line-gap` | One token for the wrapped staff and the band. |
| `lines` | integer | `bandLines(band, line, gap)` = `line > 0 ? floor((band + gap) / (line + gap)) : 0` | |
| `wrapped` | boolean | `lines ≥ 2` | FR-002. One line or none means today's single scrolling line. |

**Transitions**: `wrapped` is recomputed on every band resize and after every render that changes the content. It goes from false to true
when the band grows, or when the line shrinks, for example when the last chord is deleted. It goes from true to false when the band
shrinks (the chord form, the keyboard, a rotation) or when the line grows (the first chord, the first bracket). Each change is an anchor
trigger (R4).

## Wrapped line (derived)

A **line** is the set of `.tab-bar-run` elements that share one flex line in `.tab-lines`. A run is one bar from `barRuns(layout.columns)`:
a run of whole columns ending at a barline, and the last run may have none. A line is never an element and never stored.

| Property | Rule |
|---|---|
| Membership | Decided by CSS flex-wrap from each run's width and the band's width. Never by JS. |
| Stability | A function of (content, width) only. The caret takes no inline space in wrapped mode, and selection, active and reading marks are paint only (INV-005). |
| A group | Never crosses a line, because groups never cross a barline and lines break only at barlines. |
| A bar wider than the band | Takes a line of its own, and that run scrolls sideways (`overflow-x: auto`, scrollbar hidden), as on the play view. |
| The cursor's line | The line holding `[data-testid="tab-caret"]`. While a selection hides the caret, the line holding `[aria-current="true"]`. |

## Anchor (derived, transient)

| Field | Type | Rule |
|---|---|---|
| `anchorRequest` | counter in `CaptureScreen` state | Bumped by each trigger in R4 and by nothing else. |
| `runway` | px | `anchorFor()`: `max(0, band − (cursorLineBottom − contentTop))` when the content overflows the band, else 0. It is applied as `padding-top` on the band's child in wrapped mode only. |
| scroll move | px | `cursorLineBottom − bandBottom`, applied with `scrollBy`. |

**Lifecycle**: a request is *outstanding* from its bump until the first render after the requested write is delivered. A request with no
write (a key, a jump, a resize) is spent on the next render. A `columns` change with no request outstanding never anchors.

## Sign-in knowledge (derived)

`signInKnowledge(session, syncState)` in `src/lib/saving.ts`. Its table is in [research.md R8](./research.md#r8-knowing-whether-the-user-is-signed-in).

| Value | Meaning |
|---|---|
| `signed-in` | A session is present, and the server has not refused sync. |
| `signed-out` | The session check settled with no session, or answered 401, or sync was refused with a 401. |
| `unknown` | The check is still pending, or it failed without an answer (no signal). |

## Pending words (derived)

`pendingWords(knowledge, pending)`:

| `pending` | Knowledge | Result | Top bar draws | Capture header draws |
|---|---|---|---|---|
| 0 or undefined | any | `null` | today's `offline` / `syncing…` / nothing | nothing |
| > 0 | `signed-out` | `"saved-here"` | `Saved on this device`, beside Sign in | link `saved · sign in` to `/sign-in` |
| > 0 | `signed-in` or `unknown` | `{ count }` | `{count} unsynced` | `{count} unsynced` |

A sync error message is checked before this, in the top bar only, as today (FR-027).

## Song count (derived)

`songCountsByBand()` in `src/lib/local/queries.ts` returns `Record<bandId, number>` of live songs, with tombstones excluded by `isLive`, as
`listSongs` does. `songCountWords(n)` in `src/lib/words.ts` returns `No songs yet` for 0, `1 song` for 1 and `${n} songs` otherwise. It
covers this device's rows only, and makes no request (FR-022).

## Part card actions (derived)

| Action | Present when | Does | Owner |
|---|---|---|---|
| Label link | always | navigates to `partCaptureHref(songId, part.id)` | `SongView.tsx` `PartCard` |
| Rename / invitation | always | `setRenaming(true)`, then `patchRow("parts", id, { name: name.trim() \|\| null })`, as today | same |
| Menu: Edit | always | navigates to `partCaptureHref(songId, part.id)` | same |
| Menu: `+ variant` | `part.variantOfPartId === null` | `createVariant(part)`, as today | same |
| Menu: Delete | always | `deleteRow("parts", part.id)`, as today. No confirmation and no undo, before or after (FR-014). | same |

## Status row segments (derived)

The order is fixed. A segment with nothing to say is absent, along with its separator.

| # | Segment | Content (words unchanged, FR-032) | Gives way |
|---|---|---|---|
| 1 | Position / latches / refusal | `TRIPLET_REFUSAL`, or `statusFor(lit)`, or the position words. While a digit waits: `statusShortFor(lit)` or the short position words, as today. | never |
| 2 | Chord | symbol (semibold) and tones, or symbol and `— not a chord I know` | the tones first, then nothing. In a refusal the symbol is cut (Deviation 3). |
| 3 | Duration / digit | `cursorDuration.words`, or `fret N…` | second, after the tones. The digit never gives way. |
| 4 | Jumps | `⇤ start`, `end ⇥` | never |
