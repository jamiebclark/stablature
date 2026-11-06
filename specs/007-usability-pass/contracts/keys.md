# Contract: keyboard shortcuts

**Normative** for `src/lib/keys/` and `src/components/keys/`.

## 1. One table

`src/lib/keys/shortcuts.ts` holds one `SHORTCUTS` list. Dispatch and the help overlay both read it, so a key cannot work without
being listed, or be listed without working.

```ts
export type Screen = "play" | "capture" | "other";
export type ActionId =
  | "toggle-click" | "restart" | "column-back" | "column-on" | "bar-back" | "bar-on"
  | "start" | "end" | "part-back" | "part-on" | "string-up" | "string-down"
  | "enter" | "dead-note" | "help";

export interface Shortcut {
  readonly id: ActionId;
  readonly keys: readonly string[];        // `KeyboardEvent.key` values
  readonly label: string;                  // How the help shows the key
  readonly words: string;                  // What the help says it does
  readonly screens: readonly Screen[];
}

export const SHORTCUTS: readonly Shortcut[];
export function screenFor(pathname: string): Screen;
export function shortcutFor(key: string, screen: Screen): Shortcut | null;
export function acceptsShortcut(event: KeyEventLike, doc: Document): boolean;
```

Digits are one entry whose `keys` are `0` to `9`. The table has every row of FR-057 and nothing else.

## 2. When a shortcut rests

`acceptsShortcut` returns false, and nothing happens, when any of these hold:

| Condition | Test |
|---|---|
| Focus is in something editable | `target.closest("input, select, textarea, [contenteditable]:not([contenteditable=false]), [role=textbox]")` |
| Text is being composed | `event.isComposing \|\| event.keyCode === 229` |
| A modifier is held | `event.ctrlKey \|\| event.metaKey \|\| event.altKey` |
| A sheet is open | `doc.querySelector("dialog[open]")` |
| The key is the focused control's own | Space or Enter on `button, a, summary, [role=button]` |
| The key repeats a digit or `x` | `event.repeat`, for those keys only |

Shift is not a modifier here, because `?` needs it. Esc is never a shortcut, so a sheet keeps its meaning.

When a shortcut acts, it calls `preventDefault`. When it rests, it calls nothing.

## 3. Where it lives

`KeyboardHelp`, in `src/components/keys/`, is mounted once in the root layout. It holds the one `keydown` listener and the overlay.
A screen registers what its actions do:

```ts
useScreenKeys(screen: Screen, actions: Partial<Record<ActionId, (event: KeyboardEvent) => void>>): void;
```

An action a screen has not registered does nothing. `help` is the layout's own. The listener reads actions through a ref, so a
new render never rebinds it.

## 4. The help overlay

A `Sheet` labelled `Keyboard shortcuts`, `data-testid="help-overlay"`, listing `SHORTCUTS` for the current screen, label then words.

| Opens | Closes |
|---|---|
| `?`, on any screen, unless shortcuts rest | `?`, handled on the dialog itself, since §2 rests while it is open |
| `help-open`, a visible control, on a fine pointer only | Esc, by the native dialog |
| | Its close control |

## 5. Capture's actions

| Action | Does the same as |
|---|---|
| `column-back`, `column-on` | The same route as tapping that column: a selection extends its head, otherwise the cursor moves and latches clear |
| `start`, `end` | The jump buttons |
| `bar-back`, `bar-on` | The same route, to the first column of that bar |
| `part-back`, `part-on` | The chips: reset the cursor and latches, then replace the URL. Stops at the ends |
| `string-up`, `string-down` | Moves the keyboard string. Stops at the ends |
| Digits, `enter` | The reducer in [data-model.md](../data-model.md) |
| `dead-note` | `press(string, "x")` |

**Moving the cursor.** New pure functions in `src/lib/capture/cursor.ts`, with `Cursor` moved there too:

```ts
export function cursorStep(columns: readonly EventRow[], cursor: Cursor, by: -1 | 1): Cursor;
export function cursorBar(columns: readonly EventRow[], cursor: Cursor, by: -1 | 1): Cursor;
```

They step by stored column, so a `×4` is one step, as a tap is. Back from the first column gives `null`. On from the last gives
`"end"`.

**Entering a fret.** One queue, in `CaptureScreen`:

```text
enqueue(string, fret):
  chain = chain.then(() => pressRef.current(string, fret))
               .then(() => waitForDelivery())
```

- `pressRef.current` is always the latest render's `press`, so the note sees the latest columns and latches.
- `waitForDelivery` resolves on the next change of `columns`, or after 250ms.
- `press` is not copied or wrapped. It stays the only route to a write, and the neck calls it as it always did.

**The waiting digit.** `data-testid="digit-waiting"` in the status row, reading `fret 1…`. It takes the place of the duration.

**The keyboard string.** Set to used by the first capture shortcut of any kind. Never written to a table.

## 6. What no key does

No shortcut deletes, cuts or pastes, or opens anything but the help. A slip can add a note, which the delete control removes.
