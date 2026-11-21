# Contract: the memo UI on the song page

Components (new): `src/components/memos/PartMemos.tsx` (the memo area of one card), `MemoItem.tsx`, `RecordPanel.tsx`,
`useRecorder.ts`, `useMemoPlayer.ts`, `MemoBoot.tsx`. Changed: `src/components/app/SongView.tsx` (the menu item, the
memo area, part delete), `src/components/ui/OverflowMenu.tsx` (an optional `unavailable` item), `src/app/layout.tsx`
(mounts `MemoBoot`), `src/components/app/SyncProvider.tsx` (`setMemoAccount`).

Memos appear **only** in `PartCard` on `/songs/{id}` (FR-041). They do not appear in `CaptureScreen`, `PlayView`,
`PasteTab` or the export.

## 1. The part menu (FR-010, FR-018, FR-027, FR-028)

The order becomes: **Play**, **Record memo**, **Edit**, **+ variant** (base parts only), **Delete**.

| Availability | Item | `aria-disabled` | `ariaLabel` | Choosing it |
|---|---|---|---|---|
| `ok` | Record memo (mic icon) | — | `Record a memo on part {label}` | starts recording on this part |
| `insecure` | Record memo | `true` | `Record a memo on part {label}, unavailable on this address` | opens the explanation (§5) |
| `no-microphone` | Record memo | `true` | `… , no microphone` | explanation |
| `no-recorder` | Record memo | `true` | `… , this browser can't record` | explanation |
| `busy` | Record memo | `true` | `… , a recording is already running` | explanation |
| *(this part is recording)* | Stop recording | — | `Stop recording on part {label}` | `stop()` |

`OverflowItem` gains `unavailable?: boolean`. An unavailable item:
- stays focusable and choosable;
- carries `aria-disabled="true"`;
- is drawn in `text-text-dim` with a trailing "(unavailable)" word, so it never relies on colour alone;
- keeps the `--control` floor.

## 2. The memo area (FR-043–FR-045)

It is placed under the staff and `VariantLine`, inside the `Card`, as `<section data-testid="part-memos"
aria-label="Memos for part {label}">`. It renders **nothing** (`null`) when the part has no live memos, no recording
running on it, no held clip, no explanation open and no notice (INV-012).

Inside it, in order:
1. the **notices** (§6), each `role="status"`;
2. the **RecordPanel** while this part is recording or holding a clip (§3);
3. the **explanation** (§5), when open;
4. the **list**: `<ol data-testid="memo-list">`, oldest first. If the part has more than 3 memos and is not expanded,
   only the newest 3 are drawn, under a button `Show {n} earlier memo(s)` (`data-testid="memo-more"`). When it is
   expanded, all are drawn, and the button reads `Show fewer`. The choice is stored per part in
   `stablature.memos.expanded`.

The list takes the card's full width (`w-full`, no `max-w`) on every width. It has `no-print`.

## 3. RecordPanel (FR-013, FR-015)

`data-testid="record-panel"`. It is one row on wide screens and wraps on phones.
- `record-elapsed`: `m:ss`, tabular.
- `record-left`: `m:ss left`. With `warn`, it reads `Only m:ss left` in `font-semibold text-danger`.
- `record-level`: the level meter, `aria-hidden`.
- **Stop** (`record-stop`, primary).
- **Discard** (`record-discard`). The first press turns it into **Discard recording?** with **Yes, discard**
  (`record-discard-confirm`) and **Keep recording**. Recording continues while this is shown.
- An `aria-live="polite"` node, `record-announce`, carries the 60/30/10 s announcements only.

**Held** (out of room or save failed): the notice words, then **Try again** (`record-retry`), **Download the clip**
(`record-download-held`) and **Discard**.

## 4. A memo (FR-045–FR-049)

`<li data-testid="memo" data-memo-id data-state="{memoState kind}">`

- **Title**: `label`, or `Memo {n}`, where `n` is its 1-based position among the part's live memos, oldest first.
- **Meta line**: `{recorder} · {date} · {m:ss}`. The recorder is `recordedByName`, or `You` when it is null. The date
  is `toLocaleDateString(undefined, { day: "numeric", month: "short" })`, plus the year when it is not the current
  year.
- **Player**, when `memoState` says yes:
  - **Play/Pause** (`memo-play`, `aria-label` "Play memo {title}" / "Pause memo {title}", `aria-pressed`);
  - a position bar, `<input type="range" data-testid="memo-seek">`, with `min = 0`, `max = durationMs`, `step = 100`,
    and `aria-label` "Position in memo {title}". It responds to taps and drags;
  - `memo-elapsed` `m:ss`.
- **State line**, when there is no player: `data-testid="memo-state"`, with exactly `memoState`'s words (data-model §5)
  and its action button, if any (`memo-retry` "Try again" / `memo-download` "Download").
- **Menu**: an `OverflowMenu` labelled `Actions for memo {title}`, holding:
  - **Rename** (`Rename memo {title}`);
  - **Download** (`Download memo {title}`, only with audio);
  - **Delete** (`Delete memo {title}`, `destructive`).

  The menu's behaviour is `OverflowMenu`'s own, which is the same as the part card's (FR-046).
- **Rename** turns the title into an `Input` (`maxLength` 120, `aria-label` "Memo name") with **Save**. An empty value
  stores `null`.
- **Delete** opens a `Sheet` labelled `Delete memo {title}?`. It reads: "This deletes the memo for everyone in the
  band. Its recording is erased and can't be brought back." The buttons are **Delete memo** (danger) and **Cancel**.

## 5. The explanation (FR-027, FR-028, US4)

`data-testid="record-unavailable"`, `role="note"`, with a **Close** button.

| Availability | Words |
|---|---|
| `insecure` | Recording needs a secure (https) address. This browser only allows the microphone on https or on localhost, and this page was opened over plain http. Whoever runs your server can set up https. Memos recorded elsewhere still play here. |
| `no-microphone` | This browser can't open a microphone here. Memos recorded elsewhere still play here. |
| `no-recorder` | This browser can't record audio. Memos recorded elsewhere still play here. |
| `busy` | A recording is already running on part {label}. Stop it first. |

## 6. Notices

These are from `meta.memoNotices` for this part, with words from contracts/recorder.md §3 and data-model §7. Each is
a line with **Dismiss** (`aria-label` "Dismiss notice"). The persistence notice reads: "This browser may clear memos
if the device runs short of space. Adding the app to your home screen makes that less likely."

## 7. Deleting a part (FR-065)

The menu's Delete calls `confirmPartDelete(part)`:
- With `liveMemos(part.id).length === 0`, it calls `deletePart(part.id)` at once. This is one tap, as today.
- Otherwise it opens a `Sheet` labelled `Delete part {label}?`, which reads "Part {label} has {n} memo(s). Deleting
  the part deletes them too, for everyone in the band, and erases their recordings." The buttons are **Delete part and
  memos** (danger) and **Cancel**. Confirming calls `deletePart(part.id)`. Cancelling writes nothing.

## 8. Floors and themes (FR-047)

Every button and input above uses `Button`, `Input`, `OverflowMenu` or the `--control` floors. The range input's
thumb and track are given a `min-h-(--control)` hit box. Text uses the `text`, `text-dim` and `text-faint` tokens.
Danger uses `text-danger` with a word or icon. No opacity is laid over a surface token.

## 9. Test ids

`part-memos`, `memo-list`, `memo-more`, `memo`, `memo-play`, `memo-seek`, `memo-elapsed`, `memo-state`,
`memo-retry`, `memo-download`, `record-panel`, `record-elapsed`, `record-left`, `record-level`, `record-stop`,
`record-discard`, `record-discard-confirm`, `record-retry`, `record-download-held`, `record-announce`,
`record-unavailable`, `memo-notice`.
