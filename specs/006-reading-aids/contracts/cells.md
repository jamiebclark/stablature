# Contract: views and cells

Public surface of `src/lib/reading/view.ts`, `spelling.ts` and `labels.ts`, and the additions to
`layout.ts`, `techniques.ts` and `chords.ts`. All React-free.

## The view store (`view.ts`)

```ts
export const STAFF_VIEWS = ["frets", "notes", "intervals"] as const;
export type StaffView = (typeof STAFF_VIEWS)[number];
export const STAFF_VIEW_KEY = "stablature.staffView";

export function readStaffView(raw: unknown): StaffView;      // anything unknown is "frets"
export function getStaffView(): StaffView;                   // the snapshot
export function setStaffView(view: StaffView): void;         // never throws
export function subscribeStaffView(listener: () => void): () => void;
export function resetStaffViewForTest(storage?: Pick<Storage, "getItem" | "setItem"> | null): void;
```

- The in-memory value, once set, wins over the store, so a refused write still changes the screen.
- `subscribeStaffView` also listens for `storage` events on the key, which replace the in-memory value.
- `useStaffView()` in `src/components/reading/useStaffView.ts` is `useSyncExternalStore` over these, with
  `() => "frets"` as the server snapshot.

## Spelling (`spelling.ts`)

```ts
export type Spelling = "sharp" | "flat";
export function spellingFor(chord: Chord | null, tuning: Tuning): Spelling;
export function noteName(pitchClass: number, chord: Chord | null, spelling: Spelling): string;
export function degreeName(pitchClass: number, chord: Chord): string;
export const FOLDED_DEGREES: readonly string[];  // 1 b2 2 b3 3 4 b5 5 b6 6 b7 7
```

`spellingFor`:

| Case | Flat if |
|---|---|
| A readable chord | Any `tone.name` has a `b` after its first character |
| No readable chord | Any `tuning.strings[].note` has a `b` after its first character |

`noteName`, first match wins:

| Order | Case | Result |
|---|---|---|
| 1 | `chord.bass === pitchClass` | `chord.bassName` |
| 2 | A tone has this pitch class | `tone.name` |
| 3 | Otherwise | `midiToNote(pitchClass, spelling).note` |

`degreeName`: the tone's `degree` if one has this pitch class, else
`FOLDED_DEGREES[(pitchClass - chord.root + 12) % 12]`.

## Cell text (`labels.ts`)

The writer gives the pitch text. `decorate` adds the rest. `layoutWith` adds the repeat suffix.

| Stored | Notes | Intervals, readable chord | Intervals, no readable chord |
|---|---|---|---|
| Fretted note | `noteName` | `degreeName` | `noteName` |
| Any `harmonic` in the list | `?` | `?` | `?` |
| Dead note, `"x"` | `x` | `x` | `x` |
| Dead note with `harmonic` | `x` | `x` | `x` |
| Fret that is not a non-negative integer | `?` | `?` | `?` |

So a dead note with a harmonic draws `<x>`. It has no pitch to hide, and `x` says more than `?`.

Every view but frets passes the separator `·` to `decorate`:

```ts
export function decorate(fret: string, stored: readonly string[], separator = ""): string;
```

A decoration takes the separator on the side its letter sits: `before` of tap, `after` of bend and palm
mute. Worked: `A·m`, `B·b`, `t·D`, `(C)`, `<?>`, `A~`, `t·(<?>)·b~·m`.

## Layout

```ts
// layout.ts
export interface CellWriter {
  /** The pitch text for one played cell, before decorations. */
  pitch(event: EventRow, stringIndex: number, fret: string, stored: readonly string[]): string;
  /** Passed to `decorate`. */
  separator: string;
  /** Words for the screen reader, or null. Null keeps the description as it is today. */
  words(event: EventRow, stringIndex: number, fret: string, stored: readonly string[]): string | null;
}
export function layoutWith(options: LayoutOptions, writer: CellWriter): TabLayout;
export function layoutPart(options: LayoutOptions): TabLayout;   // signature unchanged

// reading/labels.ts
export interface ReadingOptions extends LayoutOptions {
  view: Exclude<StaffView, "frets">;
  /** Every event of the part, so a slice reads chords anchored before it. */
  partEvents: readonly EventRow[];
}
export interface ReadingLayout extends TabLayout {
  carriedChord: string | null;
  chordCover: "all" | "some" | "none" | "nothing";
}
export function layoutReading(options: ReadingOptions): ReadingLayout;
```

`ascii.ts` does not import `layoutWith` or anything under `src/lib/reading/`. `text.ts` likewise.

## Screen-reader words

The column description keeps `string N fret F` and adds ` shown as <words>` before any ` with ...`:

| Cell | Spoken for that string |
|---|---|
| `C#` | `string 2 fret 4 shown as C sharp` |
| `Bbb` | `string 1 fret 9 shown as B double flat` |
| `b3` | `string 2 fret 3 shown as flat third` |
| `bb7` | `string 3 fret 2 shown as double flat seventh` |
| `#9` | `string 2 fret 3 shown as sharp ninth` |
| `1` | `string 3 fret 5 shown as root` |
| `A·m` | `string 4 fret 5 shown as A with palm mute` |
| `<?>` | `string 2 fret 5 shown as no pitch with harmonic` |
| `x` | `string 1 fret x`, as today |

Degree words: `1` root, `2` second, `3` third, `4` fourth, `5` fifth, `6` sixth, `7` seventh, `9` ninth,
`11` eleventh, `13` thirteenth, with `flat`, `double flat` or `sharp` before them. No word in the
description is an affix character. In frets the description is byte-identical to today.
