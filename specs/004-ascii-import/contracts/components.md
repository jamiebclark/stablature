# Contract: the paste target

**Normative** for `src/components/app/PasteTab.tsx` and the edits to `SongView.tsx`.

## `SongView`

- A **Paste tab** `Button` sits beside `+ part`, in the same flex row, with `no-print`. It toggles
  the panel.
- In the empty state, a second **Paste tab** `Button` sits beside **Start capturing**.
- The panel renders under the Parts heading and above the list or empty state, in normal page flow.
  It is **not** a `Sheet` (research R12), so the density toggle stays reachable and the preview
  follows it.
- Each part's `<li>` gains `id={`part-${part.id}`}`. After an import, once `parts` holds the new
  id, the page scrolls it into view with `block: "nearest"`, and the panel has already closed.

The song screen already has `song`, `tuning`, `tunings`, `parts`, `eventsByPart` and `density`, so
the panel needs no new query. Nothing in `PartCard`, `ExportSong` or `ArrangementEditor` changes.

## `PasteTab`

```ts
export function PasteTab(props: {
  song: SongRow;
  tuning: TuningRow | undefined;
  tunings: readonly TuningRow[];
  parts: readonly PartRow[];
  eventsByPart: Record<string, EventRow[]>;
  density: Density;
  onClose: () => void;
  onImported: (partId: string) => void;
}): ReactNode;
```

### Reading

```text
text  ->  useDeferredValue  ->  useMemo(readTab)  ->  useMemo(draftPart)  ->  memo(preview)
```

There is no read button (FR-028), and no debounce timer to test around. `readTab`'s context is
memoised, so a keystroke re-reads, and a sync write re-reads with the new notes.

### Layout, top to bottom

| Element | Detail |
|---|---|
| Text box | `<textarea>`, `aria-label="Tab text"`, `w-full`, `font-mono text-base`, `wrap="off"`, `overflow-x-auto`, 8 rows, `autoCorrect="off"`, `autoCapitalize="off"`, `spellCheck={false}`, focused on open |
| Status | `role="status"`, `aria-live="polite"`. One sentence, see below |
| Refusals | When `refused`: a list, each item `line N`, the line in a `<code>` that scrolls on its own, then the reason |
| Preview | When `ready`: `TabStaff`, with `events`, `annotations`, `tuning` from the reading, `density` from the prop, `surface="raised"` |
| Summary | When `ready`: "Part C: 4 bars, 16 columns" |
| Notes | When `ready`: the reading's notes, then a "Tuning" line for an offer |
| Ignored | When `ready` with ignored lines: a list, each with its line number |
| Buttons | Primary import, then Cancel, on one wrapping row |

`TabStaff` is the same component as every other part, with no new props (FR-029). It scrolls its own
overflow, so a wide preview cannot widen the page.

### Words

| State | Status line | Primary button |
|---|---|---|
| `idle` | "Paste tab here." | Absent |
| `refused`, one | "Line 4 could not be read. Nothing will be imported." | Absent |
| `refused`, several | "3 lines could not be read. Nothing will be imported." | Absent |
| `refused`, no line | The reason itself | Absent |
| `ready`, `fits` | "Ready to import as part C." | "Import as part C" |
| `ready`, `offer` | "Ready to import as part C in B Standard." | "Switch to B Standard and import" |
| `importing` | Unchanged | Disabled |

Absent rather than disabled: there is nothing to do, and spec 003 set this rule (INV-012 there).

An offer's name is the band tuning's `name` or the preset's `name`. The status region changes only
when the sentence changes, so typing inside a refused paste does not repeat itself to a screen
reader.

### Failure messages

Shown in the status region. The text stays in the box in both cases.

| Case | Message |
|---|---|
| The write rejected | "Could not save this part. Nothing was changed." |
| `changed` | "The song changed while this was open. Check the preview again." |

### Importing once

A `busy` ref is checked and set synchronously at the top of the handler, and cleared in `finally`.
State drives the disabled look. Only the ref stops a second tap in the same frame (FR-037).

### Styling

- No new colour token and no opacity tier (FR-033). Refusals use `text-danger` for the heading and
  `text-text` for the words, `<code>` on `bg-bg-sunken`, and notes use `text-text-dim`.
  `text-text-faint` is not used, because it is below 4.5:1 on a raised surface in the light theme.
- Long text never widens the page: `<code>` is `block overflow-x-auto whitespace-pre`, list items
  are `min-w-0`, and the panel is `min-w-0`.
- The panel is `no-print`.

### Test hooks

| Hook | On |
|---|---|
| `data-testid="paste-tab"` | The panel |
| `data-testid="paste-refusals"` | The refusal list |
| `data-testid="paste-ignored"` | The ignored list |
| `data-testid="paste-notes"` | The notes list |
| `data-line="4"` | Each refusal and ignored item |

Locators by role and name work for the rest: `button "Paste tab"`, `textbox "Tab text"`,
`button /Import as part/`, `button "Cancel"`, `role=status`.

A song with no parts shows **two** Paste tab buttons, the one beside `+ part` and the one in the
empty state, as FR-027 asks. Both stay visible, so tests on an empty song scope the locator to the
empty state or use `.first()`.

## Nothing else on screen changes

No clipboard API is used, so no permission is ever asked (FR-027). The box is a text box, and the
person's own paste gesture fills it. `public/sw.js` needs no change, because the panel ships in the
song page's existing chunks.
