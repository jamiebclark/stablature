# Data model: Make playing techniques capturable and visible

**No stored shape changes** (FR-001). `EventRow.techniques: TechniqueMap` already exists, is
already merged, validated and carried by the clipboard. This document records what the
existing field now *means*, and the derived, in-memory shapes built from it.

---

## Stored: `EventRow.techniques` (unchanged shape)

```ts
type TechniqueMap = Record<string, Technique[]>;   // key: string index, "0" = highest string
```

| Rule | Source |
|---|---|
| A transition is stored on the **arriving** note, on its string: `{ "3": ["hammer_on"] }`. | FR-002 |
| No source id, offset or column reference is ever stored. | FR-002 |
| A note created with nothing armed stores `techniques: {}`. | FR-003 |
| When a string's list empties, its key is removed, so toggling on and off restores the map exactly. | FR-006, INV-014 |
| A string's list never exceeds `MAX_TECHNIQUES_PER_STRING` (8), the wire's cap. | INV-015 |
| Entries this entry does not manage (`dead_note`, unknown strings) are kept by a toggle, dropped by a stack that replaces the note. | FR-004, FR-006 |
| One column's map is one merge unit: concurrent offline edits resolve to the later write. | Spec assumption |

Stored order means nothing. Drawing imposes its own order (FR-008).

**Tolerated, because the wire accepts them, and never produced by capture:**

| Stored | Drawn as |
|---|---|
| Two transitions on one string | One glyph, by the order hammer-on, pull-off, slide up, slide down. Both stay stored. |
| A technique on a string with no note in the column | Nothing. |
| A technique on a barline or an empty rest | Nothing. |
| Duplicates of a decoration | One affix. A toggle off removes every copy. |
| `dead_note` or an unknown string | Nothing. Kept by a toggle. |

---

## Declared: techniques (`src/lib/tab/techniques.ts`)

```ts
type Transition = "hammer_on" | "pull_off" | "slide_up" | "slide_down";
type Decoration = "vibrato" | "harmonic" | "let_ring" | "bend" | "tap" | "palm_mute";
```

| Technique | Kind | Glyph or affix | Words | Toggle label |
|---|---|---|---|---|
| `hammer_on` | transition | `h` | hammer-on | n/a |
| `pull_off` | transition | `p` | pull-off | n/a |
| `slide_up` | transition | `/` | slide up | n/a |
| `slide_down` | transition | `\` | slide down | n/a |
| `vibrato` | decoration | after: `~` | vibrato | `vib` |
| `harmonic` | decoration | around: `<` `>` | harmonic | `harm` |
| `let_ring` | decoration | around: `(` `)` | let ring | `ring` |
| `bend` | decoration | after: `b` | bend | `bend` |
| `tap` | decoration | before: `t` | tap | `tap` |
| `palm_mute` | decoration | after: `m` | palm mute | `mute` |

`dead_note` is deliberately in neither list. Dead notes are the fret value `x`.

See [contracts/notation.md](./contracts/notation.md) for the normative grammar.

---

## Derived: `TabColumn` (`src/lib/tab/layout.ts`)

Built on every layout and never stored.

| Field | Status | Meaning |
|---|---|---|
| `cells` | changed | Now includes affixes and, in compact, the repeat label last: `t(<7>)b~mx3`. |
| `width` | unchanged | The widest cell, so affixes widen the column in both renderers (FR-009). |
| `connectors` | **new** | `(string \| null)[]`, one entry per string, top first. The glyph in the gap **before** this column. |
| `description` | **new** | The screen-reader text, in words (FR-017). |

A connector is non-null exactly when all three hold (FR-010):

1. the string has a cell in this column;
2. a transition is stored on that string;
3. an earlier column **among those being laid out** has a cell on that string.

Barlines always have all-null connectors.

**Source derivation** is a walk, not a lookup. `heard[string]` flips true after the first
column with a cell on that string. Spaces, barlines and notes on other strings leave it
alone, which is why the source can be any distance back.

---

## State: armed latches (`CaptureScreen`, rules in `src/lib/capture/latches.ts`)

`armed: ReadonlySet<LatchId>` is the only stored state. `lit = armed ∩ applicable` is always
derived. `LatchId` widens to `"stack" | Transition`.

```text
                 tap the chip                       tap the same chip
   DARK ─────────────────────────────▶ ARMED ───────────────────────────▶ DARK
                                         │
                                         ├─ tap another transition chip ─▶ that chip ARMED, this DARK
                                         ├─ one note entered ────────────▶ DARK   (transition chips only)
                                         ├─ tap a column, switch part,
                                         │  insert space or barline ─────▶ DARK
                                         ├─ settled target rejects it ───▶ DARK   (the prune)
                                         └─ paste, cursor not delivered ─▶ stays ARMED, unlit for the wait
```

| Behaviour | `stack` | Transition chip |
|---|---|---|
| Scope | `next-note` | `transition` |
| Lifetime | Stays armed | Disarms after exactly one note |
| Exclusive with | Nothing | The other three chips |
| Available on playable | Yes | Yes |
| Available on a barline | No | Yes |
| Available at the start, or in an empty part | No | No |

Stack and one transition chip can be armed together (FR-020).

**The prune.** Two facts decide it:

- `deliveredId`: the last cursor column seen in `columns`.
- `pending`: `afterId` is non-null, is not in `columns`, and is not `deliveredId`.

While `pending`, the armed set is left alone. Otherwise it is reduced to `lit`.

---

## Derived: the next note (`nextNote`)

| Lit | Where the note goes | Techniques stored | Latches used up |
|---|---|---|---|
| nothing | new column at the cursor | none | none |
| one transition | new column at the cursor | that transition | that chip |
| stack | onto the marked column | none | none |
| stack and one transition | onto the marked column | that transition | the chip only |

---

## Derived: inspector toggles (`src/lib/capture/properties.ts`)

One group per string that has a note and exists in the tuning, in tuning order. Six toggles
per group, in the order vibrato, harmonic, let ring, bend, tap, palm mute. The `on` state
comes from the live row.

A barline, or a column with no notes, gets no `decorations` property at all (FR-026).

`PropertyContext` gains `tuning`.

---

## Write operations (`src/lib/local/editing.ts`)

Full signatures are in [contracts/writes.md](./contracts/writes.md).

| Operation | Effect on `techniques` |
|---|---|
| `insertNote` with techniques | New row, `{ [string]: techniques }`. |
| `insertNote` without | New row, `{}`, as today. |
| `stackNote` | That string's list becomes those given, or none. Other strings are untouched. Patched only if it changes. |
| `unstackNote` | That string's key is removed with its fret. |
| `toggleDecoration` | Flips one decoration on the fresh row. Everything else on the string is kept. |
| `deleteColumn`, `deleteColumns`, `cutColumns` | Tombstone only. The transition on a later note reattaches by position. |
| `pasteClipboard`, `createVariant` | Already copy the map. Sources derive from where the columns land. |
