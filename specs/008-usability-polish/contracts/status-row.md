# Contract: the capture status row (US4, FR-029 to FR-033)

The design and its width budget are in [research.md](../research.md) R10. The segments are in
[data-model.md](../data-model.md#status-row-segments-derived).

## Markup

This is the non-selection branch only. The selection branch (`N selected · tap another column to extend`) is unchanged.

```tsx
<div data-testid="status-row"
     className="flex h-(--status-row) shrink-0 items-center gap-0.5 overflow-hidden whitespace-nowrap border-t border-border-subtle px-3 text-[0.7rem]">
  {/* 1. position / latches / refusal: words, classes and colours exactly as today */}
  <span data-testid="status-position" className="shrink-0 …today's colour…">{…today's expression…}</span>

  {/* 2. chord: present when chordSymbol */}
  <Sep />
  <span data-testid="status-symbol" className="{symbolFit or refusal cut} font-mono font-semibold text-accent">{symbol}</span>
  <span className="sr-only"> chord:</span>
  <span data-testid="status-tones" aria-hidden className="ml-0.5 min-w-0 shrink-[1000] truncate font-mono text-text-dim">{tones.join(" ")}</span>
  <span className="sr-only">{tones.join(", ")}</span>
  {/* or, unreadable: symbol (font-mono font-semibold text-text-faint) + "— not a chord I know" (min-w-0 truncate), as today */}

  {/* 3. duration or waiting digit */}
  <span data-testid="cursor-duration" className="min-w-0 shrink truncate font-mono text-text-dim"><Sep inline />{words}</span>
  {/*   or */}
  <span data-testid="digit-waiting" className="shrink-0 font-mono text-accent"><Sep inline />fret {waiting}…</span>

  {/* 4. jumps: present when columns.length > 0 */}
  <Sep />
  <button …today's start…/>
  <button …today's end…/>
</div>
```

`Sep` is `<span aria-hidden className="h-3 w-px shrink-0 bg-text-faint" />`. `Sep inline` is the same rule drawn as
`inline-block align-middle mr-0.5` inside a truncating box, so it is clipped with its segment (R10).

## Rules

| Rule | Source |
|---|---|
| Words are byte-identical to today's in every state. `latches.ts` has zero diff. | FR-032, INV-022 |
| The row is 26px and one line in every state. | FR-031 |
| At 375, segment 1 is whole. A symbol of up to 10 characters is whole, except beside a refusal (Deviation 3). Both jump buttons are at least 44×24. | FR-031 |
| The tones give way first, then the duration. Each shows an ellipsis while it has room for one. | FR-031, Deviation 4 |
| Adjacent visible segments always have a `Sep` between them. The symbol's computed `font-weight` is greater than the tones'. | FR-029, FR-030 |
| A screen reader hears "Dsus4 chord: D, G, A". Separators are not read. | FR-030 |
| `data-testid="digit-waiting"` and `"cursor-duration"` keep their names. `status-position`, `status-symbol` and `status-tones` are new hooks. | test hooks |

## Where it lives

The row moves from `CaptureScreen.tsx` into `src/components/capture/StatusRow.tsx` (new, LF), with props `{ status, lit, waiting, wideRow,
refused, atEnd, afterId, chord, chordSymbol, cursorDuration, hasColumns, onStart, onEnd }`. It is a move: every expression comes across
unchanged except the markup above.
