# Contract: the tab notation

**Normative.** This is what the on-screen staff and the text export draw, and what the
`ascii-import` entry has to parse. Changing a character here changes a public format.

Everything below is produced in `src/lib/tab/layout.ts`, from the declarations in
`src/lib/tab/techniques.ts`. `src/lib/tab/ascii.ts` and `src/components/tab/TabStaff.tsx`
only place what the layout gives them.

## Transitions: one character, in the gap before the arriving note

| Technique | Glyph | Example |
|---|---|---|
| Hammer-on | `h` | `5h7` |
| Pull-off | `p` | `7p5` |
| Slide up | `/` | `5/7` |
| Slide down | `\` | `7\5` |

The glyph **replaces** the one rail in that gap, so a row's length never changes.

If two are stored on one string, one is drawn, in the order above.

## Decorations: an affix on the note's own cell

| Technique | Form | Example |
|---|---|---|
| Tap | before | `t7` |
| Let ring | around | `(7)` |
| Harmonic | around, inside let ring | `<7>` |
| Bend | after | `7b` |
| Vibrato | after | `7~` |
| Palm mute | after | `7m` |

**Order is fixed**, whatever the stored order: tap, let ring, harmonic, the fret, then bend,
vibrato, palm mute.

```text
t(<7>)b~m      all six, on fret 7
xm             a palm-muted dead note
```

## Repeats

The repeat label `x<n>` always comes last in the cell.

| Stored | Expanded | Compact |
|---|---|---|
| `7`, vibrato, `repeat: 3` | `7~-7~-7~` | `7~x3` |
| `5`, then `7`, hammer-on, `repeat: 3` | `5h7h7h7` | `5h7x3` |
| `7`, hammer-on, `repeat: 3`, first in the part | `7h7h7` | `7x3` |
| `<7>`, `repeat: 2` | `<7>-<7>` | `<7>x2` |

A technique draws on **every** repetition in expanded density. A chord symbol on the same
column draws only on the first. The two rules are opposites on purpose (FR-015).

## Spacing

Cells pad with rails on the right to the column's width. The connector always sits
immediately before the arriving cell.

| Situation | Reads |
|---|---|
| Adjacent | `5h7` |
| Two-digit frets | `12h14` |
| Source column widened to 2 by another string | `5-h7` |
| Source column widened to 3 by another string | `5--h7` |
| One space column between | `5--h7` |
| Across a barline | `5-\|h7` |
| Slide into a downbeat | `5-\|/7` |
| Decorated source and arrival | `7~h9b` |
| Tapped arrival | `5ht7` |
| Tapping figure | `t12p5` |

## When nothing is drawn

- The arriving note has no earlier note on that string among the columns laid out.
- The string has no note in that column.
- The stored entry is `dead_note`, or something unknown.

The stored data is untouched in each case, so a glyph appears if a source later does.

## Exact fixture

The whole grammar on one five-string part, as pinned in
`src/lib/tab/__tests__/techniques.test.ts`. String indices: 0=G, 1=D, 2=A, 3=E, 4=B.

```text
E |-5h7-7p5-5/7-7\5-|
```

`E` here is `{ "3": 5 }`, then `{ "3": 7 }` with `hammer_on`, and so on: each arrival stores
its transition. Other rows are rails of the same length.
