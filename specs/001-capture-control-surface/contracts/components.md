# Contract: component props and test hooks

The UI contract of this feature. Three existing components change their prop surface and
three new ones appear. The `data-testid` list at the end is part of the contract because
the invariants measure geometry and computed style rather than roles — `docs/DECISIONS.md`
is explicit that asserting roles and aria-labels is what let the chord-colour defect
through.

---

## `TabStaff` — one new optional prop, and nothing else

```ts
export interface TabStaffProps {
  // ... every existing prop unchanged ...

  /**
   * Opens the per-column inspector. Supplied ONLY by the capture screen, and
   * only while no selection is active.
   *
   * When undefined, NO press handlers are attached at all: no long-press timer,
   * no pointer listeners, no contextmenu suppression. That is what makes the
   * gesture structurally absent on a read-only staff rather than present and
   * suppressed (FR-021, INV-005).
   */
  onInspectColumn?: (eventId: string) => void;
}
```

### Guarantees

1. **Read-only staffs are untouched.** `PlayView.tsx` and `SongView.tsx` pass no
   `onInspectColumn`, so a long press there produces nothing — no sheet, no hint, no
   handler (INV-005). Neither file changes in this feature.
2. **The tap keeps its meaning and its timing.** `onSelectColumn` still fires on `click`.
   When the long press has already fired, `onClick` reads a synchronous ref and returns;
   it awaits nothing (FR-019, INV-006).
3. **A moved press is neither gesture.** Past the movement threshold both the pending long
   press and the subsequent click are cancelled (FR-020, INV-007).
4. `onInspectColumn` receives the **event id**, not a layout column — a repeated column
   renders as several columns from one event, and the inspector is scoped to the event.

### Also on the column button, when `onInspectColumn` is supplied

| Attribute | Value | Why |
|-----------|-------|-----|
| `onContextMenu` | `e => e.preventDefault()` | a sustained press must not raise the platform menu over the sheet |
| `className` | adds `select-none` | and `-webkit-touch-callout: none` via `globals.css`, so the press does not start a text selection |

`touch-action` is **not** set. The staff's horizontal scroll must keep winning; movement
cancellation is what resolves the ambiguity (research §6).

---

## `useLongPress` — `src/components/capture/useLongPress.ts`

```ts
export interface LongPressOptions {
  /** Fires after `delayMs` of a press that has not moved. */
  onLongPress: () => void;
  /** Default 500. */
  delayMs?: number;
  /** Movement past this many CSS pixels cancels. Default 10. */
  moveThresholdPx?: number;
}

export interface LongPressHandlers {
  onPointerDown: PointerEventHandler;
  onPointerMove: PointerEventHandler;
  onPointerUp: PointerEventHandler;
  onPointerCancel: PointerEventHandler;
  onContextMenu: MouseEventHandler;
  /**
   * True exactly once after a long press fired, then false. The click handler
   * calls this synchronously and returns early if it is true.
   */
  consumeSuppressedClick: () => boolean;
}

export function useLongPress(options: LongPressOptions): LongPressHandlers;
```

### Guarantees

| # | Guarantee | Probed by |
|---|-----------|-----------|
| 1 | Any `pointerType` works — `"mouse"`, `"touch"`, `"pen"`. | INV-006 (both Playwright projects) |
| 2 | Only the primary button/contact starts a press (`event.isPrimary`, and for mouse `button === 0`). | unit test |
| 3 | The timer is cleared on `pointerup`, `pointercancel`, movement past the threshold, and unmount. No timer outlives the component. | unit test |
| 4 | `onLongPress` fires **at most once** per press. | unit test |
| 5 | `consumeSuppressedClick()` is synchronous and self-clearing: the second call in one press returns `false`. | unit test, and INV-006 |
| 6 | A press that fired a long press does **not** also cancel a later, separate tap. | INV-006, INV-007 |

The hook is a hook rather than a component so the handlers land on the existing column
`<button>` and no wrapper element is introduced into the staff's flex row — a wrapper
would change the column geometry that the ASCII serialiser shares (INV-013).

---

## `LatchStrip` — `src/components/capture/LatchStrip.tsx`

```ts
export interface LatchStripProps {
  /** Ordered. Rendered as given; the component never sorts, filters or branches on id. */
  latches: readonly Latch[];
  /** The lit set, already intersected with applicability by `litLatches`. */
  lit: ReadonlySet<LatchId>;
  target: CursorTarget;
  onToggle: (id: LatchId) => void;
  /** Dims and blocks the strip with the rest of the neck. */
  disabled?: boolean;
}
```

### Guarantees

1. **One cell per latch, in order.** `latches.length` chips, always, in declaration order.
   An inapplicable latch renders `disabled` **in place** — it never disappears and never
   moves (FR-009).
2. **No id branching.** Every chip is produced by one `map` body. The container's class
   list is a constant, independent of `latches.length` (INV-015), using
   `grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr)` so N latches share the
   width evenly at any N.
3. **Armed state is announced as state.** Each chip is
   `<button aria-pressed={lit.has(id)} aria-label={latch.ariaLabel} title={latch.title}>`.
   `aria-pressed` rather than a label change, so arming reads as a state change and not as
   an action with no result (FR-006, story 1 scenario 4).
4. **Armed emphasis is today's emphasis**: `bg-accent text-accent-text`, the same as the
   current `variant="primary"` stack button. Unarmed is `bg-bg-raised` +
   `border border-border-subtle`. Named tokens only — never opacity over a surface token
   (FR-030, and `docs/DECISIONS.md`).
5. The strip emits exactly one `bg-*` and one `text-*` utility per chip, for the
   Lightning-CSS source-order reason recorded in `docs/DECISIONS.md`.

---

## `Fretboard` — hosts the strip

```ts
export interface FretboardProps {
  // ... every existing prop unchanged ...

  /** Rendered above the fret grid, inside the neck's own surface and its disabled wrapper. */
  latchStrip?: ReactNode;
}
```

### Guarantees

1. The strip sits **above** the `overflow-x-auto` fret-grid scroller, so it does not
   scroll away with the 25-fret grid, and **inside** the outer wrapper, so
   `disabled ? "pointer-events-none opacity-40"` covers it (FR-010).
2. **The fret grid's own height is unchanged.** Cells stay `h-9 w-9`, the mute row `h-7`,
   the fret-number row as-is. The strip's height is added to the `Fretboard` wrapper, and
   because the staff is the only `flex-1 min-h-0` child of `CaptureScreen`, the staff is
   the only element that can absorb it (FR-027, INV-011).
3. The grid region carries `data-testid="fret-grid"` so INV-011 can measure it separately
   from the wrapper.

Taking the strip as a `ReactNode` rather than as `latches`/`lit`/`onToggle` props keeps
`Fretboard` ignorant of latch state: it owns the neck's surface and the strip's position,
and `CaptureScreen` owns what is in it.

---

## `ColumnInspector` — `src/components/capture/ColumnInspector.tsx`

```ts
export interface ColumnInspectorProps {
  /** Ordered. Rendered as given; never sorted, filtered or branched on by id. */
  properties: readonly ColumnProperty[];
  ctx: PropertyContext;
  /** Named in the sheet's heading, e.g. "Column 4" or "Barline". */
  title: string;
  onClose: () => void;
}
```

### Guarantees

1. **One row per property, in order**, each rendered by the renderer for its `control`
   kind (`stepper` | `text` | `action`) — never by its `id` (FR-016, INV-015).
2. **Every edit goes through `property.commit`.** The component imports nothing from
   `src/lib/local/editing.ts` (INV-004).
3. **Opening mutates nothing.** The component has no mount effect that writes.
4. **Dismissal is possible without a pointer**: Esc via the native `<dialog>` `cancel`
   event, plus a focusable close button. Every row is reachable by `Tab` and operable by
   `Enter`/`Space`/arrow keys as appropriate to its control kind (FR-024).
5. **The delete row closes the sheet** after `commit` resolves, and the host repairs the
   cursor with `nextCursorAfterDelete` (story 3 scenario 4).
6. The sheet carries `data-testid="column-inspector"`.

The component renders the sheet's **body** and is exported separately from the `Sheet`
wrapper, so INV-015's jsdom test can mount the body directly without depending on jsdom's
`HTMLDialogElement.showModal` (research §7).

---

## `Sheet` — `src/components/ui/index.tsx`

```ts
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  children: ReactNode;
}): ReactNode;
```

A native `<dialog>` opened with `showModal()` and closed with `close()`, styled as a
bottom sheet. `onClose` fires for the `close` event, so Esc, the backdrop and
programmatic close all route through one callback. Focus containment, page inertness and
`::backdrop` come from the platform.

Thin by design — it joins `Button`, `Input`, `Card`, `PageHeader`, `EmptyState` and
`Loading`, matching that file's stated intent of "enough to keep styling in one place
without a component library this app does not need". No new dependency.

---

## `CaptureScreen` — what it still owns

For completeness, since it is the one component the whole feature funnels through:

| State | Kind | Note |
|-------|------|------|
| `cursor` | stored | unchanged; type moves to `src/lib/capture/cursor.ts` |
| `armed: ReadonlySet<LatchId>` | stored | replaces `stacking: boolean` |
| `inspecting: string \| null` | stored | an event id, never an `EventRow` |
| `chordDraft` | stored | unchanged — the toolbar's inline chord form stays (the inspector duplicates, it does not replace) |
| `selection` | stored | unchanged |
| `target` | **derived** | `resolveTarget(part, columns, afterId)` |
| `lit` | **derived** | `litLatches(armed, target)` |
| `inspected` | **derived** | `columns.find(c => c.id === inspecting) ?? null` |

`editable` is removed. Everything that read it reads `target` instead.

---

## Test hooks (`data-testid`), normative

Added because the invariants measure geometry and computed style, not roles.

| Hook | On | Used by |
|------|-----|---------|
| `latch-strip` | the strip container | INV-011, INV-014 |
| `fret-grid` | the fret-grid region inside `Fretboard` | INV-011 |
| `toolbar-stable` | the toolbar's row 1 | INV-002, INV-003 |
| `toolbar-contextual` | the toolbar's row 2 | INV-002, INV-003 |
| `column-inspector` | the sheet body | INV-005, INV-008, INV-009 |

Existing hooks relied on and **not** renamed: `tab-staff`, `tab-column`, `tab-caret`,
`data-selected`, `data-barline`, `data-chord-role`. Renaming any of them would break
`e2e/capture.spec.ts`, which INV-001 requires to run with one locator changed and nothing
else.
