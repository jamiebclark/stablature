# Contract: the capture band (US1, FR-001 to FR-011)

The design and its figures are in [research.md](../research.md) R1 to R5, and the derived state is in
[data-model.md](../data-model.md#band-geometry-derived-capture-only).

## 1. `src/lib/capture/band.ts` (new, pure, React-free)

```ts
/** Whole lines of height `line`, separated by `gap`, that fit in `band`. 0 when `line` is 0. */
export function bandLines(band: number, line: number, gap: number): number;

/** True when two or more whole lines fit (FR-002). */
export function bandWraps(band: number, line: number, gap: number): boolean;

/**
 * Where the band must be, for the cursor's line to be its bottom line.
 * All inputs are in px, measured in the band's coordinates at the moment of anchoring.
 */
export function anchorFor(input: {
  band: number;             // the band's content height
  contentHeight: number;    // the staff's height, without runway
  lineBottom: number;       // the cursor line's bottom, measured from the content top
}): { runway: number; overflows: boolean };
```

**Rules**:
- `overflows = contentHeight > band`.
- `runway = overflows ? max(0, band − lineBottom) : 0`.
- Unit tests in `src/lib/capture/__tests__/band.test.ts` are hand tables (FR-002 edges: exactly 2 lines, 2 lines less 0.1px, line 0, gap
  0; the anchor at the first line, the last line and a middle line; a part that fits).

## 2. `src/components/capture/useCaptureBand.ts` (new; re-planned in review round 2, INV-004 and INV-002 by construction)

```ts
export function useCaptureBand(opts: {
  content: unknown;          // the part's columns; undefined while loading
  annotations: unknown;      // the part's annotations
  request: { id: number; wait: "now" | "write" | "load" };   // set by CaptureScreen at each trigger
}): {
  bandRef: RefObject<HTMLDivElement | null>;
  wrapped: boolean;
  runway: number;            // the band child's padding-top in wrapped mode, 0 otherwise
  leftWrapped: number;       // counts the exits from wrapped mode, for the one-line scroller
  spend: () => void;         // every Still: the outstanding request ends
  deliver: (id: number, committed: string) => void;   // the write's own promise has settled
};
```

- **Anchoring happens on exactly three renders**, and the request ends on each:
  1. the render of a trigger's bump when it needs no write (`wait: "now"`: a key move, a jump, including one to where the cursor already is);
  2. the render that delivers that trigger's own write (`wait: "write"`);
  3. a resize of the band, or a mode change.
  Opening a part (`wait: "load"`) is case 2 with the part's columns as the write.
- **The delivery signal is the write's own promise, not a change**. `CaptureScreen.anchored(write)` sets the request before the write
  starts, and when the write settles it reads the part's rows back and calls `deliver(id, signature)`. The request ends on the render whose
  `(content, annotations)` has that signature. A write that changed nothing, or only an annotation, or only one column's repeat, ends at
  once or on its own render. A request is never left outstanding for a later change, so a sync arrival after it moves nothing. A failed write
  calls `spend`.
- **Mode**: re-decided after any render where one of `bandLines`'s three inputs may have changed: the band's size, a drawn column's height
  or the gap. One `ResizeObserver` watches the band and a drawn column; a layout effect also runs after content or annotations change. Only a
  change of the band's size or of the mode anchors; a column growing does not.
- **Mode change**: leaving wrapped mode counts `leftWrapped`, so the one-line scroller shows the caret.
- **Never** reads layout on a fret tap's hot path, other than inside these effects (FR-008).

## 3. `CaptureScreen.tsx` changes

- **The band**:

  ```tsx
  <div ref={bandRef} data-testid="tab-band"
       className="flex min-h-0 flex-1 flex-col-reverse gap-y-(--line-gap) overflow-y-auto px-3 pt-1">
    <div className="shrink-0" style={wrapped ? { paddingTop: runway } : undefined}>
      <TabStaff � wrap={wrapped} />
    </div>
  </div>
  ```

  The band has one child, so `gap-y` draws nothing. It exists so the hook can read the token as px (R2).
- **Requests**: `anchor()` for a trigger with no write, `anchored(() => write())` for one with a write (the request precedes the write),
  and `request("load")` for opening another part. Every trigger in research R4's left column goes through one of them.
- **`followTail`, `keepCaretInView`, `revealGroups`, `activeEventId`, `insertAfterEventId`, `selectedEventIds`, `onInspectColumn` and
  `onSelectColumn`** are passed exactly as today.

## 4. `TabStaff.tsx` changes (wrapped branch only)

The one-line branch (`if (wrap) { … }` not taken) is **not edited**. Its markup stays byte-identical (FR-003, SC-002, INV-001).

| # | Change | Active when |
|---|---|---|
| a | Draw the caret at the head of the first run when `insertAfterEventId === null`. | `insertAfterEventId !== undefined` |
| b | Draw every caret as a zero-advance holder: `relative w-0 shrink-0`, with the bar `absolute -left-px w-0.5`. | `wrap && insertAfterEventId !== undefined` |
| c | A ref on the wrapped root. `followTail` sets the last run's `scrollLeft` to its `scrollWidth`. | `wrap && followTail` |
| d | `keepCaretInView` sets the caret's run's `scrollLeft` so that the caret is inside it (horizontal only). | `wrap` and the counter changed |
| e | `revealGroups` finds `[data-start]` under the wrapped root, rather than `scroller.current`, and calls `scrollIntoView({ block: "nearest", inline: "nearest" })`. | `wrap` and the counter changed |
| f | The `TabStaffProps.wrap` doc comment says "the play view and capture". | always |

**The play view passes none of the props in a to e**, so its wrapped markup and behaviour are unchanged. `PlayView.tsx` has zero diff, and
`usability-wrap.spec.ts` and `usability-staves.spec.ts` run unedited (INV-009).

## 5. `globals.css`

- `--line-gap: 0.75rem` moves from `.tab-staff-wrapped` to `:root`. `.tab-staff-wrapped` keeps `--gutter`.
- No other rule changes.

## 6. Test hooks

These are the existing hooks, plus nothing new on the staff, because the markup is pinned. The band's state is read from the DOM:
`.tab-staff-wrapped` exists exactly when the band is wrapped. Lines are the distinct `getBoundingClientRect().top` values of
`.tab-bar-run`.
