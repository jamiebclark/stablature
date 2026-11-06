# Contract: sizes, tokens and screens

**Normative** for `src/app/globals.css`, `src/app/layout.tsx`, `src/components/ui/index.tsx` and every screen. Sizes come from
the spec's floors table, and are not restated except where a value is decided here.

## 1. Density tokens

Defaults in `:root` are touch. One `@media (pointer: fine)` block overrides them. `pointer: coarse` is not written anywhere.

| Token | Touch | Fine | Used by |
|---|---|---|---|
| `--control` | 2.75rem | 2rem | Every button, link button, input, select, segmented control, toolbar control |
| `--toolbar-row` | 46px | 34px | Stable, contextual, selection and reserved rows, with their border |
| `--title-row` | 45px | 36px | Capture's merged row |
| `--status-row` | 26px | 26px | Status row and selection status |
| `--fret` | 2.25rem | 2rem | Fret cell, and its label column |
| `--dead-note` | 1.75rem | 1.5rem | Dead-note cell height |
| `--latch` | 31px | 26px | Latch chip |
| `--field-text` | 1rem | 0.875rem | `input`, `select`, `textarea` |
| `--staff-text` | 1rem | 0.875rem | `.tab-staff` |
| `--col-pad` | 0.6rem | 0.5rem | A staff column's padding |
| `--string-height` | 1.55rem | 1.3rem | Already exists |
| `--staff-row` | 1.1rem | 0.95rem | Bar, chord, bracket and rhythm rows |
| `--chord-ch` | 0.4375rem | 0.4375rem | One chord character: 7px, since Linux Chrome rounds 0.7rem × 0.6 (6.72px) up to whole pixels |
| `--chord-gap` | 0.25rem | 0.25rem | Clear space after a chord |

A Tailwind variant, `@custom-variant fine (@media (pointer: fine))`, is for what tokens cannot say: which of two
elements shows. No size in this list may be set by a width breakpoint.

## 2. Colour tokens

As in [research R11](../research.md). Also:

- `.tab-column-selected .tab-bracket-label` and `.tab-bracket` use `--text`.
- `.tab-rhythm` is `--text-dim`, which clears 4.5 on the base and raised surfaces. Rhythm is not drawn on capture, so never on the
  selection band.
- A disabled control keeps `opacity`, and is the only text allowed under 4.5.
- The comment above `ROLE_STYLES` in `Fretboard.tsx` is updated to the new measurements.

## 3. Type

- `.tab-staff { font-family: var(--font-mono-face), ui-monospace, monospace; font-size: var(--staff-text); }`
- `.tab-staff`, and a new `.tab-text`, set `font-variant-ligatures: none`. `.tab-text` goes on the paste box and on the `code` of
  refused and ignored lines.
- `input, select, textarea { font-size: var(--field-text); }` in `@layer base`. `text-sm` leaves `Input` and every raw select.

## 4. Viewport and safe areas

```ts
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#0b0b0d" };
```

`maximumScale` goes, and the comment above it is rewritten.

`--safe-top`, `--safe-right`, `--safe-bottom` and `--safe-left` wrap `env(safe-area-inset-*, 0px)`. They are applied once per
edge-touching surface:

| Surface | Edges |
|---|---|
| `TopBar` | Top, left, right |
| Capture's root | All four |
| `ClickBar` and the song page's bar | Bottom, left, right |
| `Sheet` | Bottom |
| `Footer` | Bottom |

Capture's root is `.capture-surface`. In `@layer base`:

```css
:where(.capture-surface, .capture-surface *) { touch-action: manipulation; }
```

So the tap pad's `touch-none`, a utility, still wins.

## 5. Primitives

**`Button`, `ButtonLink`.** `min-h-(--control)`, and `min-w-(--control)` for an icon-only button. The primitive changes, so no screen
needs a size class, and any `py-1` or `h-9` that fights it is removed.

**`Input`.** No `text-sm`. `min-h-(--control)`.

**`Sheet`.** `style={{ marginBottom: "var(--kb-inset, 0px)", maxHeight: "calc(100dvh - var(--kb-inset, 0px))" }}`, with `useKeyboardInset()`
active only while open. It sets `--kb-inset` on `document.documentElement` from `innerHeight - visualViewport.height -
visualViewport.offsetTop`, and clears it on close.

**`PageHeader`.** One row: the back link at the floor, then the title, then actions. The subtitle sits beneath. The title has
`line-clamp-2` rather than `truncate`. `actions` take an optional `touchBar` flag, covered in §7.

**`Panel`.** New.

```ts
function Panel(props: { id: PanelId; label: string; className?: string; children: ReactNode }): ReactNode;
```

A button with `aria-expanded` and `aria-controls`, and a body with the `hidden` attribute while closed. The body stays mounted.
`data-testid` is `panel-<id>` for the button and `panel-<id>-body` for the body. `no-print`.

## 6. Capture

From the top, with heights at 375×667:

| Row | `data-testid` | Touch height | Holds |
|---|---|---|---|
| Merged row | `capture-title-row` | 45 | Back, chips, `+ part`, tempo, sync word |
| Band | `tab-band` | The rest | The staff |
| Status | `status-row` | 26 | Status, chord, duration, jump buttons |
| Chord form | | As now | Only while open |
| Stable | `toolbar-stable` | 46 | As now |
| Contextual, selection or reserved | as now | 46 | As now |
| Neck | | Unchanged | |

**Merged row.** Left to right: back, chips, `+ part`, tempo, sync word.

- Back is `← <title>`, `min-w-(--control)`, `min-h-(--control)`, and is the first thing to give way, down to its arrow.
- The chips scroll sideways in their own scroller, each at least 36×44, and the open chip is kept in view with
  `scrollIntoView({ inline: "nearest", block: "nearest" })`.
- The sync word is `N unsynced`, shown only when `pending > 0`. `all synced` goes.
- On a fine pointer the help control sits at the end of this row.

**Band.** `flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-3 pt-1`. `stringCount` is no longer imported for this.

**Status row.** `h-(--status-row)`, one line.

| Part | Flex | Gives way |
|---|---|---|
| Status words | `shrink-0` | Never |
| Jump buttons | `shrink-0`, at least 44×24 | Never |
| Chord symbol | `shrink-0`, up to 10 characters | Only during a triplet refusal, or past 10 characters |
| Duration | `min-w-0 truncate` | Second |
| Chord tones | `min-w-0 truncate` | First |

`tap a column to insert after it`, the width-only hint, goes. It cannot fit with the row's new content, and its `sm:` is the row's only
width rule.

**Neck.** Fret-number header `text-[0.6875rem]` (11px), `text-text-dim` throughout. An inlay fret is `font-semibold`. The keyboard
string, once used, has `data-keyboard-string`, and its label reads `▸E`.

**Selection row.** Padding 4px. Bracket controls `min-w-9`. `delete` has `mx-1`.

**Reveal.** See [staff.md](./staff.md) §6.

## 7. Song page

Top to bottom:

1. `PageHeader`, with Play view and Capture in `actions` shown on a fine pointer only.
2. One row: `Panel song-tools`, `Panel song-arrange`.
3. Arrangement heading and `Roadmap`.
4. Parts.
5. `song-actions`: a sticky bar at the end of `main`, hidden on a fine pointer, `no-print`, with Play view and Capture.

`song-tools` holds tuning, BPM, export with `export-note` beside it, density, and `ViewControl`. `song-arrange` holds everything
`ArrangementEditor` shows for adding. With no entries, the add controls are shown directly and there is no `song-arrange`. The
selected entry's controls show outside any panel, under the roadmap.

**Roadmap.** A `text` node is a `button` when `onSelectEntry` is given, and stays a `span` when not. Same for the section label,
which is already a button.

**Part card.** `tempo · beats` in the head row, from `partHeading`. Destructive `Delete` has `ml-2`.

## 8. Play view

`main` is `max-w-screen-2xl`, not `max-w-3xl`. `pt-2`.

Heading: one row of back and title, then `stringLabels — N bpm`.

Each pass's head row, in order: part label, `Verse, 2nd time`, `pass 2 of 4`, `bars 3–4 of this part`, part name, and at a part's
first pass `120 bpm · 4 beats a bar`. The `bars` text must say it counts the part's own bars (FR-050).

No section heading sits above the card any more. Each entry stays `print-keep`.

**The cluster** is `ClickBar`, in [click.md](./click.md).

## 9. Paste panel

In order: `role="status"` line, then the box, then refusals or preview. The box is `max-h-[30dvh]` on touch and `rows={8}` as now on a
fine pointer. `scroll-mt` on the box is the status line's height, so a browser scrolling the box into view keeps the status.

## 10. Inspector

`TextControl` scrolls its form into view on focus, one frame after the inset lands. The stepper's halves and `close` take the floor.

## 11. Other screens

No layout change beyond the primitives. Named here because they use raw controls:

- `TopBar`: logo link and `Sign in` at the floor. The help control on a fine pointer.
- `Footer`: links at the floor.
- `TuningsView`: family tabs at the floor. `Delete` has `ml-2`.
- `AuthForm`: inline links in a sentence are exempt, and listed in `e2e/usability-helpers.ts` as `SENTENCE_LINKS`.
- `BandView`: long titles use `line-clamp-2`.
- `ViewControl` and the density control: `min-h-(--control)`.

## 12. What a sentence link is

A link whose parent is a `p` holding text of its own on both sides, or a `p` where it follows text. Named, not inferred, so a new
small link cannot exempt itself.

## 13. Test hooks

`capture-title-row`, `tab-band`, `status-row`, `song-actions`, `panel-song-tools`, `panel-song-arrange`, `panel-play-cluster`,
`help-open`, `help-overlay`, `digit-waiting`, `tab-bar-number`, `tab-section`, `part-heading`. Existing hooks stay.
