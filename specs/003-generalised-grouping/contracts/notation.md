# Contract: the bracket row

**Normative.** `ascii-import` parses this. It is produced by `tupletRow` in
`src/lib/tab/ascii.ts`, the only writer of this row.

## Where it sits

One row above the staff and below the chord row, offset by the same gutter as the staff body.
It appears when the part has at least one group and `showTuplets` is not false. That option
hides counted tuplets and plain groups alike.

## Grammar

For one span over columns whose text runs from offset `start` to offset `end`:

```text
width   = end - start + 1
counted = "," rails label rails ","    the label centred at floor((width - length) / 2)
plain   = "," rails ","                the same width, all rails
```

`start` is the first column's offset. `end` is the last column's offset plus its width, less
one. A counted label overwrites rails, and a plain bracket keeps them.

| Group | Columns | Text |
|-------|---------|------|
| Counted tuplet of 2 | 2 | `,2,` |
| Counted tuplet of 3 | 3 | `,-3-,` |
| Counted tuplet of 4 | 4 | `,--4--,` |
| Plain group | 2 | `,-,` |
| Plain group | 3 | `,---,` |
| Plain group | 4 | `,-----,` |

The examples above are over single-digit columns. A two-digit column widens the span.

## Rules a parser can rely on

- **Same extents.** A plain bracket and a counted tuplet over the same columns have the same
  start and width. They differ only where the label would be.
- **Digits mean a count.** A bracket holding digits is a counted tuplet with that number. A
  bracket holding none is a plain group.
- **A group never crosses a barline** in anything this version writes. Older parts can hold
  one, drawn as two brackets that each print the same number, which is what `,4,   ,4,` is.
- **Adjacent groups** are separated by the gap between columns, so two plain pairs read
  `,-, ,-,`.
- **The number counts stored columns.** A group of three stored columns containing a `repeat: 8`
  reads `,--------3--------,` over ten drawn columns in expanded density, and `,--3--,` over
  `5 5x8 5` in compact density. Parsing it back needs the staff row, not the bracket.
- **One bracket per span.** Repetitions and connectors inside a span do not break it.

## Short spans

These come only from later edits that left a group with one column, or from a span narrower
than its label. They are not normal output.

| Span | Counted | Plain |
|---|---|---|
| Width 1 | The label alone, such as `3`, as today | `,` |
| Width 2 | As today, such as `3,` | `,,` |

A parser should accept them. The label behaviour is unchanged by this entry (FR-030).
