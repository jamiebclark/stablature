# Contract: the inspector's duration buttons

**Components**: `src/components/capture/ColumnInspector.tsx` (`SegmentRow`) and a new `src/components/rhythm/NoteSymbol.tsx`. The data
comes from `src/lib/capture/properties.ts` (`segments` of the `duration` property).

## Markup

```html
<div data-testid="duration-row" class="grid w-full grid-cols-6 gap-1">
  <button type="button" aria-pressed="false" aria-label="whole note" title="whole note" data-duration="w" class="…">
    <svg data-part="note-symbol" data-duration="w" aria-hidden="true" focusable="false">…</svg>
  </button>
  … h, q, 8, 16, 32, in that order
</div>
```

| Attribute | Value | Requirement |
|---|---|---|
| order | `w h q 8 16 32` (the `DURATIONS` table's order) | FR-028, US4 #1 |
| `aria-label` | `d.words` ("quarter note") | FR-028, US4 #2 |
| `title` | the same words | FR-028, US4 #2 |
| `aria-pressed` | `"true"` on the stored duration only; none lit for unset or unknown | FR-029, US4 #3 |
| `data-duration` | `d.id` | lets tests address a button without reading a symbol |
| the button's text content | **empty** (the symbol is an `svg`) | the letters are gone (FR-028) |

## The symbols (`NoteSymbol`)

| id | Drawn |
|---|---|
| `w` | an open notehead, no stem |
| `h` | an open notehead and a stem |
| `q` | a filled notehead and a stem |
| `8` | a filled notehead, a stem and one flag |
| `16` | the same with two flags |
| `32` | the same with three flags |

- The stem points up and the flags hang on the right, which is the conventional symbol people know (spec Decisions).
- The symbol is 1.25rem tall, inside the existing `min-h-11` button. The 54×44 touch floor and spec 007's fine floor are held by the button,
  which this entry does not change.
- It is drawn in `currentColor`, so the lit button (`bg-accent text-accent-text`) and the resting one (`bg-bg-raised text-text`) colour it
  through the existing classes. The pressed state shows by fill and border, not by hue alone (FR-029).
- The path data lives in `glyphs.ts`, shared with the staff's flags, so a flag reads the same in both places.

## Behaviour (unchanged)

Tap sets, and a tap on the lit button clears: `nextDuration` through `property.commit`, exactly as today. Two taps in one tick both reach
`commit`.

## What changes in `properties.ts`

```ts
segments: (ctx) => DURATIONS.map((d) => ({
  value: d.id, label: d.mark, ariaLabel: d.words, on: d.id === lit,
  symbol: d.id,            // new
}))
```

`SegmentRow` draws `<NoteSymbol id={segment.symbol} />` when `symbol` is set and `segment.label` otherwise. No other segment control exists
today. The fallback keeps the type honest.
