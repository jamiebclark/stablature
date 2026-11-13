# Contract: part cards (US2, US5, FR-012 to FR-020)

The design is in [research.md](../research.md) R9 and R12.

## 1. `src/components/ui/OverflowMenu.tsx` (new, LF)

```tsx
export interface OverflowItem {
  /** Visible words. */
  label: string;
  /** Accessible name, when it must say more than `label` (e.g. "Delete part A"). */
  ariaLabel?: string;
  icon: ReactNode;
  /** A link item navigates; an action item runs. Exactly one is given. */
  href?: string;
  onSelect?: () => void | Promise<void>;
  /** Draws a divider and 8px above this item, and the danger ink. */
  destructive?: boolean;
}

export function OverflowMenu(props: {
  /** The trigger's accessible name, e.g. "Actions for part A, main riff". */
  label: string;
  items: readonly OverflowItem[];
  className?: string;
}): JSX.Element;
```

| Behaviour | Rule |
|---|---|
| Trigger | `button`, `aria-haspopup="menu"`, `aria-expanded`, `aria-controls`, `aria-label={label}`, `MoreHorizontal` icon, `min-h-(--control) min-w-(--control)`, ghost, `no-print`. |
| Open | Enter, Space or a click calls `dialog.showModal()`. Focus goes to the first item. |
| Structure | `<dialog aria-label={label}>` > `<div role="menu" aria-label={label}>` > items. Link items are `<Link role="menuitem">`, action items `<button role="menuitem">`. Each is `min-h-(--control)`, full width, with icon and words. |
| Destructive item | Preceded by `<hr aria-hidden>` with `my-2`. `text-danger`, icon and word. Colour is never its only cue. |
| Keys inside | ArrowDown and ArrowUp move focus, with wrap-around. Home and End go to the first and last item. Tab and Shift+Tab close, and focus the trigger. Escape closes (`cancel`), and focuses the trigger. |
| Outside | A press that begins and ends on the backdrop (`target === dialog`) closes it and focuses the trigger. The page under it is inert, so nothing else acts. |
| Stray click | A click whose press did not begin inside the dialog is swallowed, so the release of the opening press never runs an item. This is the same guard as `Sheet`. |
| Item runs | It closes, then navigates or awaits `onSelect`. |
| Position | Fixed, from the trigger's rect at open: below and right-aligned, flipped above if its bottom would pass `min(innerHeight, songActionsTop)`, clamped 8px inside the viewport horizontally. |
| One at a time | It is modal, so a second trigger cannot be reached while one menu is open. |
| Print | The dialog is `no-print` and is closed. |

## 2. `PartCard` (in `src/components/app/SongView.tsx`)

**The face**, in order: the label link, the name or the invitation (or the rename form), the heading, the variant note, and the menu
trigger at the right. **No** `Button variant="danger"`, no `+ variant`, no Edit `ButtonLink` on the face (FR-012, FR-015).

```tsx
<Link href={partCaptureHref(songId, part.id)}
      aria-label={`Edit part ${part.label}${part.name ? `, ${part.name}` : ""}`}
      className="inline-flex min-h-(--control) items-center gap-1 rounded bg-bg-sunken px-2 font-mono text-sm font-semibold hover:text-accent">
  {part.label}<Pencil size={13} aria-hidden />
</Link>
```

Named:
```tsx
<button type="button" onClick={() => setRenaming(true)}
        className="inline-flex min-h-(--control) items-center text-sm text-text-dim hover:text-accent">{part.name}</button>
```

Unnamed (FR-019): the words, a glyph and a dashed underline, so two cues are not colour.
```tsx
<button type="button" onClick={() => setRenaming(true)} aria-label={`Name part ${part.label}`}
        className="inline-flex min-h-(--control) items-center gap-1 text-sm text-text-dim underline decoration-dashed underline-offset-4 hover:text-accent">
  <Plus size={13} aria-hidden />Add a name
</button>
```

Menu:
```ts
items = [
  { label: "Edit", ariaLabel: `Edit part ${label}`, icon: <Pencil/>, href: partCaptureHref(songId, part.id) },
  ...(part.variantOfPartId ? [] : [{ label: "+ variant", icon: <GitBranch/>, onSelect: () => createVariant(part) }]),
  { label: "Delete", ariaLabel: `Delete part ${label}`, icon: <Trash2/>, destructive: true, onSelect: () => deleteRow("parts", part.id) },
]
```

`partCaptureHref(songId, partId)` returns `` `/songs/${songId}/capture/${partId}` ``. It is a single exported function, called by the label
link and by the Edit item, and by nothing that builds the URL by hand.

## 3. `e2e/part-card-helpers.ts` (new, FR-018)

```ts
/** Opens part `label`'s menu. Asserts it is open. */
export async function openPartMenu(page: Page, label: string): Promise<Locator /* the menu */>;
/** Opens the menu and activates one item. `item` is "Edit", "+ variant" or "Delete". */
export async function partAction(page: Page, label: string, item: "Edit" | "+ variant" | "Delete"): Promise<void>;
```

Each test that pressed a card action directly calls `partAction`. The test's own assertions are unchanged. The tests are listed in
plan.md under *Existing tests this changes on purpose*.
