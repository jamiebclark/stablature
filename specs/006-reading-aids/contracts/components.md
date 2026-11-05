# Contract: screens, words and test hooks

## `TabStaff`

One new optional prop. Capture and the paste preview pass nothing and take today's path exactly.

```ts
export interface StaffReading {
  view: StaffView;
  /** Every event of the part, for the chord in force. */
  partEvents: readonly EventRow[];
  marks?: StaffMarks | null;
}
// TabStaffProps
reading?: StaffReading;
```

| Prop state | Layout | Extra rows | Caption |
|---|---|---|---|
| `reading` absent | `layoutPart` | None | None |
| `view: "frets"`, no marks | `layoutPart` | None | None |
| `view` not frets | `layoutReading` | A chord row if `carriedChord` needs one | Yes |
| `marks.any` | Either | Mark row, under the rhythm row | As the view says |

With `reading` absent, or frets with no marks, the static markup equals `main`'s for every fixture.

The file's header comment changes: what is exported is what you see **in fret numbers**. `text.ts`'s
header changes to match. Those comments are that file's whole diff.

## The control

`src/components/reading/ViewControl.tsx`, no props beyond `className`.

| Item | Value |
|---|---|
| Wrapper | `role="group"`, `aria-label="Staff shows"`, `no-print`, `data-testid="staff-view"` |
| Buttons | `frets`, `notes`, `intervals`, text as written, `data-testid="staff-view-<value>"`, `aria-pressed` |
| Sizing | As the density control: `px-2.5 py-1.5 text-xs`, one border, `overflow-hidden rounded-md` |
| Chosen | `bg-accent text-accent-text font-semibold underline` |
| Not chosen | `text-text-dim` |

The underline and the weight are what hold FR-001's "not from colour alone".

Placement:

| Screen | Where | Shown when |
|---|---|---|
| Song page | Control row, after density | `tuning` exists |
| Play view | Its own `no-print` row between the header and the list | `tuning` exists and `steps.length > 0` |

## The caption

In `TabStaff`, `<p data-testid="staff-caption">`, `absolute` in the card's bottom padding, right-aligned,
`text-[0.65rem] leading-3 text-text-dim`, no wrap, not `no-print`. The card must be `relative`.

| View | `chordCover` | Text |
|---|---|---|
| notes | any | `Note names` |
| intervals | `all` | `Intervals from the chord in force` |
| intervals | `some` | `Intervals, and note names where no chord` |
| intervals | `none` | `Note names: no chords to read against` |
| intervals | `nothing` | `Intervals` |

Longest is 40 characters, against 311 px inside the narrower card at 375 px.

## The export note

In `SongView`'s control row, directly after `ExportSong`, shown while the view is not frets, `no-print`:

`Exports use fret numbers`

`text-xs text-text-dim`, `data-testid="export-note"`. `ExportSong` takes no view prop and has zero diff.

## Variant line

`src/components/reading/VariantLine.tsx`, prop `text`. A `<p data-testid="variant-line">`,
`mt-1 text-xs text-text-dim`, under the staff in the same card. Not `no-print`. Plain text: no link, no
button, no handler.

## Marks

| Hook | Where | Text |
|---|---|---|
| `data-diff="changed"` or `"added"` | On the `tab-column` | |
| `data-testid="tab-diff"` | The mark row's cell, on every column while the row is drawn | `*`, `+`, or empty |
| `data-testid="tab-removal"` | The gap, `role="img"` with its label | `−2`, using U+2212 |

CSS, in `globals.css`, after the `.tab-column-selected` rules:

| Rule | Does |
|---|---|
| `--diff-tint`, `--diff-ink` | Named per theme, and in the print block (research R15) |
| `.tab-diff-cells` | On the cells wrapper of a marked column: `background: var(--diff-tint)` |
| `.tab-staff .tab-diff-cells .tab-cell > span` | `background: var(--diff-tint); font-weight: 700` |
| `.tab-diff-mark` | `color: var(--diff-ink); font-weight: 700`, `0.75rem`, centred, `1.1rem` high |

## Screens

**`SongView`** (CRLF, keep it):

- `useSongContent` replaces `useParts`, `useSongEvents` and `useSongAnnotations`.
- `useStaffView()`, and `useMemo` of `compareVariants(content, tuning)`, above the early returns.
- `PartCard` takes `view`, `comparison`, and draws `TabStaff` with `reading`, then `VariantLine`.
- `Card` gets `className="relative"`.

**`PlayView`** (LF, keep it):

- The same three.
- Each pass: `partEvents` is `eventsByPart[step.partId]`, and `marks` comes from
  `comparisons.get(step.partId)` with `pass.events` and the step's bars.
- While `content` is undefined and the view is not frets, the list shows `<Loading />`. In frets it
  draws as today.
- The card `div` gains `relative`.
- `ClickBar` is unchanged and still receives `passes`.

**Untouched**: `CaptureScreen.tsx`, `PasteTab.tsx`, `ExportSong.tsx`.

## Test hooks summary

`staff-view`, `staff-view-frets`, `staff-view-notes`, `staff-view-intervals`, `staff-caption`,
`export-note`, `variant-line`, `tab-diff`, `tab-removal`, and `data-diff` on the existing `tab-column`.
Existing: `tab-staff`, `tab-column`, `tab-rhythm`, `tab-bracket`, `tab-connector`, `tab-caret`.

Seeding: drive IndexedDB as `e2e/click-helpers.ts`'s `seedPlayable` does. A new `e2e/reading-helpers.ts`
builds the part sets the invariants name.
