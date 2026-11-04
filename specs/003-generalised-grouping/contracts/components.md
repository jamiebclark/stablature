# Contract: components and test hooks

## `BracketGlyph`: `src/components/icons/index.tsx`

Replaces `TripletGlyph`, whose only importer is `CaptureScreen`.

```ts
export function BracketGlyph({ numeral, className }: GlyphProps & { numeral?: number }): JSX.Element;
```

Same 16-unit box, size, stroke and `aria-hidden` as today. Each rail is its own `<path
data-rail>`, except with no numeral, where one closed `<path>` is drawn.

| `numeral` | Left rail | Right rail | Text |
|---|---|---|---|
| 3 | `M1.5 12V8.5h3.6` | `M10.9 8.5h3.6V12` | Today's attributes, exactly |
| Other single digit | `M1.5 12V8.5h2.1` | `M12.4 8.5h2.1V12` | Today's attributes |
| Two digits | `M1.5 12V8.5h.6` | `M13.9 8.5h.6V12` | `fontSize="8"`, `textLength="9.2"`, `lengthAdjust="spacingAndGlyphs"` |
| Undefined | `M1.5 12V8.5h13V12`, one path | | None |

Callers: the triplet button passes `3`, the tuplet control passes `offer.tuplet.length`, the
group control passes nothing.

## Selection toolbar: `CaptureScreen`

While a selection is up:

- **The status row** shows `{n} selected · tap another column to extend`, with its existing
  text, count and class. `n` still includes barlines.
- **The row-2 slot** holds the toolbar, in place of the `aria-hidden` placeholder. It keeps
  `h-14` and `border-t`, is `data-testid="toolbar-selection"`, and does not nest
  `toolbar-contextual`, which stays absent.

```text
copy   cut   delete   [tuplet]   [group]   [ungroup]   cancel
```

Absent, never disabled, when `offer` says so. `cancel` keeps `ml-auto`, ghost styling and no
write. All seven share one sizing constant, `h-9! px-1! text-xs! gap-1!`. The row is `flex
flex-nowrap items-center gap-1 px-2`.

| Control | Present when | Accessible name | Title | Content | On tap |
|---|---|---|---|---|---|
| Tuplet | `offer.tuplet` | `Make a tuplet of {n}` | `Bracket these {n} columns with their number` | `BracketGlyph numeral={n}` | `groupSelection(…, "tuplet")`, then `endSelection()` |
| Group | `offer.plain.length > 0` | `Group with no number` | `Bracket these columns with no number` | `BracketGlyph` | `groupSelection(…, "plain")`, then `endSelection()` |
| Ungroup | `offer.ungroup` | `Ungroup` | `Take these groups apart` | The word `ungroup` | `ungroupTuplet(selectedEvents)`, then `endSelection()` |

`endSelection()` is called with no argument, so the cursor stays. `offer` is
`groupOffer(selectedEvents)`, computed each render, so presence follows extension and sync.

These names must stay free of `select`, `copy`, `cut`, `delete`, `cancel`, `paste`, `chord` and
`triplet`. Existing locators match them as substrings, and FR-021 forbids the last.

## Triplet button: `CaptureScreen`

Same place, name, title and presence rule. `TOOLBAR_CONTROLS` does not change.

```ts
const made = await groupRunEndingAt(part.id, atEnd ? null : editable.id, 3);
if (!made) setRefusedAt({ afterId, length: columns.length });
```

```ts
/** Derived, so any route that moves the cursor or changes the part clears it. */
const refused = refusedAt?.afterId === afterId && refusedAt?.length === columns.length;
```

The status line shows `TRIPLET_REFUSAL` first when `refused`. The literals
`const status = statusFor(lit)` and `{status ||` must survive, because
`no-id-branch.test.tsx` slices on them.

## Column sheet: `properties.ts` and `ColumnInspector`

```ts
export type ColumnPropertyId = "repeat" | "chord" | "decorations" | "group" | "delete";

export interface ColumnProperty {
  // ...
  /** Replaces `label` in the row's left cell. Absent means `label`. */
  heading?(ctx: PropertyContext): string;
}
```

The new entry goes before `delete`:

| Field | Value |
|---|---|
| `id` | `"group"` |
| `label` | `"ungroup"` (the button) |
| `ariaLabel` | `"ungroup"` |
| `scope`, `control`, `destructive` | `"column-property"`, `"action"`, `false` |
| `read` | `() => null` |
| `appliesToColumn` | `event.tupletId !== null` |
| `heading` | `groupNumber(ctx.event)` is null ? `"plain group"` : `` `tuplet of ${n}` `` |
| `commit` | `ungroupTuplet([ctx.event])` |

`ColumnInspector` changes one expression: `{property.heading?.(ctx) ?? property.label}`. It
gains no id, and the action path already closes the sheet.

## Staff: `TabStaff`

CRLF file, and its line endings stay.

- `Column`'s `tuplet.count` becomes `number | null`, and the label renders only when it is not
  null.
- The bracket line in `Column` and `Gap` gains `tab-bracket`, loses `border-text-faint`, and
  keeps `absolute` and `border-t`. `Column` loses its inline `border*Color` values, and keeps
  the inline widths and styles.
- `Column`'s bracket line gains `data-testid="tab-bracket"`, plus `data-start` on a span's
  first column. Each column draws its own segment, so `[data-start]` is what counts brackets.
  `Gap` segments carry neither.
- The numeral gains `tab-bracket-label`.

## CSS: `src/app/globals.css`

```css
.tab-bracket { border-color: var(--text-faint); }
.tab-bracket-label { color: var(--text-faint); }

/* --text-faint measures 2.16 and 2.75 on the selection band. */
.tab-column-selected .tab-bracket { border-color: var(--text-dim); }
.tab-column-selected .tab-bracket-label { color: var(--text-dim); }
```

No new token and no opacity. If the person-level pass finds the bracket too quiet, the fix is
a colour named per theme (FR-034).

## e2e helpers: `e2e/grouping-helpers.ts` (new)

`capture-surface-helpers.ts` stays as it is. The new file adds:

```ts
export const selectionBar = (page: Page) => page.getByTestId("toolbar-selection");
export const tupletControl = (page: Page) =>
  selectionBar(page).getByRole("button", { name: /^Make a tuplet of \d+$/ });
export const groupControl = (page: Page) =>
  selectionBar(page).getByRole("button", { name: "Group with no number", exact: true });
export const ungroupControl = (page: Page) =>
  selectionBar(page).getByRole("button", { name: "Ungroup", exact: true });
/** One per drawn bracket, not one per column segment. */
export const brackets = (page: Page) => page.locator('[data-testid="tab-bracket"][data-start]');
export async function selectColumns(page: Page, from: number, to: number): Promise<void>;
```

Use `exact: true` for `Group` and `Ungroup`: as a substring, "group" matches both.
