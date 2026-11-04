# Contract: components and test hooks

Extends `specs/001-capture-control-surface/contracts/components.md`.

`TabStaff.tsx` and `ui/index.tsx` are CRLF files. Keep their endings.

---

## `TabStaff` (`src/components/tab/TabStaff.tsx`)

Props do not change. `describe()` is removed in favour of `column.description`.

### `Gap` (new, internal)

Rendered immediately before a `Column` when `column.connectors.some(Boolean)`.

```tsx
<Gap
  connectors={column.connectors}
  showChordRow={hasChords}
  showTupletRow={hasTuplets}
  bracket={/* index-1 and index share a span */}
  selected={/* the arriving column is selected */}
  active={/* the arriving column is active AND the column before it is the same event */}
/>
```

| Hook | Value |
|---|---|
| Root | `data-testid="tab-connector"`, `aria-hidden`, class `tab-connector` |
| Width | `1ch`, `shrink-0` |
| Rows | Chord spacer when `showChordRow`; tuplet row when `showTupletRow`; one `.tab-cell` per string |
| Glyph | `<span>` inside `.tab-cell` when non-null, nothing otherwise |

It is never a `button`, takes no handlers, is not focusable, and does not carry the
`tab-column` test id, so `columns(page)` counts are unaffected.

DOM order around a connector: `Column i`, `Caret` if it is after `i`, `Gap`, `Column i+1`.

### `Column`

- Takes `label: string`, replacing `describe(cells, barline)`.
- The read-only `div` branch gains `role="img"` and `aria-label={label}`.

### `InspectableColumn`

- Gains `onKeyDown`: `ContextMenu`, or `Shift+F10`, prevents the default and calls
  `onInspect`.
- Gains `aria-keyshortcuts="Shift+F10"` and `aria-haspopup="dialog"`.
- Long press and tap behave as before.

### `followTail`

The effect also depends on the drawn width (column widths plus gaps), so a widened tail
stays in view.

---

## `globals.css`

```css
.tab-connector { /* width comes from the component */ }
.tab-connector .tab-cell > span {
  padding-inline: 0;
  font-weight: 600;
}
```

No new colour token is planned. FR-040 applies if the browser pass adds one: named per
theme, never opacity over a surface.

---

## `LatchStrip` (`src/components/capture/LatchStrip.tsx`)

Props do not change. The grid does not change.

A latch with `transition` renders its label in `font-mono text-sm leading-[1.05rem]`, inside
the same button. The line box stays 16.8 px, so the strip stays 38.8 px tall.

It still never reads `latch.id` for anything but `key` and `onToggle`.

---

## `ColumnInspector` (`src/components/capture/ColumnInspector.tsx`)

Props do not change.

- The header row becomes `sticky top-0 z-10 bg-bg`, so `close` is always in view.
- Every `data-property-row` gains `flex-wrap`, so the rows' `className` stays identical
  across control kinds.
- `Control` gains `case "toggles"`, rendering a `ToggleGrid` at `w-full`.

### `ToggleGrid` (new, internal)

```tsx
<div data-testid="decoration-group" data-string={group.stringIndex}>
  <span>{group.label}</span>
  {/* six equal cells */}
  <button
    type="button"
    aria-pressed={toggle.on}
    aria-label={toggle.ariaLabel}
    onClick={() => void property.commit(ctx, toggle.value)}
  >
    {toggle.label}
  </button>
</div>
```

| Rule | Detail |
|---|---|
| Keys | Stable: string index and decoration. A key that includes `on` would remount the button and lose focus. |
| State | Read from `ctx`, the live row. No local copy. |
| On | `border border-accent bg-accent text-accent-text`, the armed chip's treatment. |
| Off | `border border-border-subtle bg-bg-raised text-text`. |
| After a tap | The sheet stays open (FR-027). |

---

## `Sheet` (`src/components/ui/index.tsx`)

Props do not change.

- Class gains `max-h-dvh overflow-y-auto overscroll-contain`.
- `pressBeganOnBackdrop` is joined by a record of whether a press began **inside** the
  dialog at all.
- `onClickCapture`: a click with `detail !== 0` and no such press is stopped
  (`preventDefault`, `stopPropagation`). The record then clears.
- A click with `detail === 0`, from a keyboard or assistive technology, always passes.

---

## `CaptureScreen` (`src/components/capture/CaptureScreen.tsx`)

| Area | Change |
|---|---|
| Prune | `deliveredId` state. `setArmed(prunedArmed(armed, lit, pending))` when it differs. |
| `toggleLatch` | Calls `armLatch`. |
| `press` | Calls `nextNote(lit, target)`, removes `consumed` from `armed` **synchronously**, then awaits `stackNote` or `insertNote` with `{ techniques }`. No `lit.has("stack")`. |
| Status line | `statusFor(lit)`, in place of `litLatch.statusText`. |
| Row 2 | Adds the `inspect` button: icon-only, `aria-label="Open column details"`, 44 px, calling `setInspecting(editable.id)`. |
| Contexts | `propCtx`, the toolbar delete and `InspectorSheet` all pass `tuning`. |

No other disarm is added: tap a column, switch part, space and barline already clear `armed`
wholesale, which is FR-022.

---

## e2e helpers (`e2e/capture-surface-helpers.ts`)

| Helper | Change |
|---|---|
| `status` | The regex gains the transition and combined texts. |
| `chip(page, name)` | New: a strip button by accessible name. |
| `toggle(page, technique, note)` | New: an inspector toggle by accessible name. |
| `connectors(page)` | New: `getByTestId("tab-connector")`. |
| `staffRows(page)` | New: reads each string's drawn tokens from the DOM, in order, for INV-005. |
