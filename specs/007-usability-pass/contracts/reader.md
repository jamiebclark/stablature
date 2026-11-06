# Contract: the reader's change

**Normative** for `src/lib/tab/parse.ts`. It amends `specs/004-ascii-import/contracts/reader.md` and is written into that file by this
entry (FR-064). `src/lib/tab/reading.ts` has **zero diff**.

Only these change in `parse.ts`: one new code and its reason, two new functions, one new line in `readsAsProse`, and one new line in
`failed`.

## 1. New commentary (FR-034)

In section 2's definition of prose, add:

> a line of two or more chord symbols joined by single hyphens, where every symbol has an uppercase root and at least one has a letter
> straight after its root and accidental

```ts
function joinedByQuality(text: string): boolean;
```

| Rule | Why |
|---|---|
| Splits on `-` into 2 or more pieces, none empty | "Joined by single hyphens" |
| Every piece has an uppercase root, and `parseChord` reads it | `parseChord` takes lowercase, and `b7` may be a damaged bend |
| `N.C.` is not a piece | It is not a chord symbol with a root |
| Some piece matches `^[A-G][#b]?[a-z]` | A letter before any digit is what no row can hold after a label |
| No rail or pipe at either end | Already true: `readsAsProse` returns false first |

It is asked only inside `readsAsProse`, so a chord row at an offset is unaffected: `decide` tries the chord test first.

| Line | Result beside a good system |
|---|---|
| `Am7-D7`, `Cmaj7-Fmaj7`, `Dm7-G7-Cmaj7`, `F#m7-B7`, `Am7-D7-G` | Commentary, listed with its number |
| `Am-G7` | Commentary, as today |
| `A7-D7`, `E5-A5`, `C-G7`, `A7-D7-E7` | Refused: no piece has such a letter |
| `Am7-b7` | Refused: lowercase root |
| `Am7-7`, `Am7-5`, `Bm7-5` | Refused: `7` and `5` are not chords |
| `Am7-D7-` | Refused: closes on a rail |
| `Am7--D7` | Refused: an empty piece |

The cost line in S6 changes from 43 of 202 to 39 of 202, and drops `Am7-D7` from its examples.

## 2. New wording (FR-035)

```ts
| "chords-joined"
"chords-joined": "This looks like chords joined by hyphens. Use spaces between them, on a line apart from the staff, or delete it.",
function looksJoined(line: string): boolean;
```

`looksJoined` is true when the trimmed line has no space, starts with an uppercase root, does not end in a hyphen, and can be
partitioned into two or more chord symbols, each separated by one hyphen. A symbol may hold a hyphen of its own, so `D-7-G-7` is `D-7`
and `G-7`.

`failed` maps each refusal with a line through it: if `looksJoined(r.text)`, it becomes the same refusal with code `chords-joined`.

**This runs only on a paste already refused, and maps a refusal on a line to a refusal on that same line.** It cannot change whether a
paste reads, which lines are refused, or anything stored.

| Line | Reason |
|---|---|
| `A7-D7`, `E5-A5`, `D-7-G-7`, `C-G7`, `A7-D7-E7`, `E5-G5-A5` | `chords-joined` |
| `G5-7`, `E-5-7`, `1-2-3-4-`, `(c) 1999-2004`, `Am7 - D7` | As today |

## 3. What must still hold

Every invariant of spec 004, unnarrowed. Above all: no line admitted by §1 is read as notes, a chord row or a label, and no line refused
today reads unless §1 names it. `Am7-D7` as a chord row above a system at an offset reads exactly as today.

FR-036's two lines stay refused, so no further proof is owed for them.
