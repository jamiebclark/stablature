# Contract: the click bar at the foot of the screen

`src/components/rhythm/ClickBar.tsx`. Every existing testid, role, text and behaviour stays:
`click-bar`, `click-start`, `click-beat`, `click-stop`, `click-state` (`role="status"`), `click-help` (only while running),
`click-follow`, `panel-play-cluster`, `panel-play-cluster-body` and `tempo-control`. INV-024 and INV-040
(`click-double-tap.spec.ts`, `click-bar-fit.spec.ts`) pass **unedited** (FR-030).

## 1. Position (FR-027)

```text
div[data-testid=click-bar]  .no-print  fixed bottom-0 inset-x-0 z-10  border-t bg-bg  (today's padding and safe-area insets)
  div.click-bar-inner  mx-auto max-w-screen-2xl
    div#panel-play-cluster-body          ← above the controls, as today; opens upward (FR-029)
    div.click-bar-row                    ← one CSS grid, three areas
      div.click-lead     Start | (beat + Stop)
      div.click-status   the slot (§2)
      div.click-tools    TempoControl, More/Less
```

- **Narrow.** `.click-bar-row` has `grid-template-columns: auto minmax(0, 1fr) auto` and
  `grid-template-areas: "lead . tools" "status status status"`. The controls row is today's geometry, with gap `0.5rem`, and
  the slot is below it.
- **Wide.** `grid-template-areas: "lead status tools"`. The slot sits between Stop and the tempo control, centred on the
  row's height.
- **Page padding.** The play view's `main` has `padding-bottom: calc(var(--click-bar-h, 0px) + 0.5rem)`, so at the end of the
  scroll the last card ends ≥ 8px above the bar. `--click-bar-h` and `scroll-padding-bottom` are written together by one
  `ResizeObserver` from `offsetHeight` (reading-cards.md §6).

## 2. The status slot (FR-028)

```html
<div class="click-status">                                  <!-- display: grid; one cell -->
  <span aria-hidden="true" class="click-ghost" data-ghost="Set a tempo to use the click."></span>
  <span aria-hidden="true" class="click-ghost" data-ghost="Stopped because the screen was hidden. Start again when you are ready."></span>
  … one ghost per idle message (STOPPED_WORDS × 3, the three idle words) …
  <span aria-hidden="true" class="click-ghost click-ghost-2" data-ghost="Following the notation." data-ghost-2="Can't hear it? Check the silent switch and volume."></span>
  … one two-line ghost per running pair: {Counting in., Following the notation., Plain beat.} × {sound, soundless} …
  <div class="click-live">
    <p data-testid="click-state" role="status" class="…today's classes, sr-only when quiet…">{words}</p>
    {running ? <p data-testid="click-help" …>{help}</p> : null}
  </div>
</div>
```

```css
.click-status { display: grid; }
.click-status > * { grid-area: 1 / 1; }
.click-ghost::before { content: attr(data-ghost); display: block; visibility: hidden; }
.click-ghost-2::after { content: attr(data-ghost-2); display: block; visibility: hidden; }
```

- **The ghost texts** come from the **same** constants the live words use. `STOPPED_WORDS`, the idle and running phrases and
  the two help lines are hoisted into one exported table, `CLICK_WORDS`, and both the ghosts and `words` read it. A message
  added later has a ghost by construction.
- **Height.** The cell is as tall as its tallest message at the current width, so the bar's height cannot change on start,
  stop, the help line, the quiet `sr-only` switch, or the cluster's follow choice.
- **Hidden from readers.** Ghosts carry no text node, so no `textContent`, no `getByText` match and no accessibility-tree entry.
  The live elements are unchanged.

## 3. What must not move (FR-029, SC-005)

These boxes move by no more than 0.5px across rest → running → stopped, and across cluster closed ↔ open:
- `click-start` and `click-beat` (they share the lead slot, same size, as R17 has it);
- `click-stop`, which appears to the right of the beat box;
- `tempo-control`;
- `panel-play-cluster`.

The bar's top edge also holds across rest ↔ running, in every state of `CLICK_WORDS`. Opening the cluster moves only the top
edge, upward.

## 4. Measured heights (research R5)

| Where | Today rest / running | After, every state |
|---|---|---|
| 1280×800, 1440×900, fine | 57 / 93 | 57 (the slot's 2 lines sit inside the 44px row) |
| 375×667 touch | ≈57 / ≈93 | the running height, ≈93, recorded at T001 and pinned by the re-pinned `usability-cluster-states.spec.ts` |
| 768–1024 | — | recorded at T001: one figure per width, rest equal to running |
