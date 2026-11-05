# Quickstart: validating note names, intervals and variant marks

How to prove this entry works. What is proved where is in [plan.md](./plan.md)'s invariants. The exact
words and hooks are in [contracts/components.md](./contracts/components.md), and the comparison's exact
cases in [contracts/compare.md](./contracts/compare.md).

## 1. Prerequisites

- `npm ci`, and `npx playwright install chromium`.
- Postgres only for the two-device scenario (`npm run db:up`, `npm run db:migrate`). It skips without
  it, and a skip is not a pass for INV-003's second device.
- Never run the build or e2e suite while a dev server holds the same `.next`.

## 2. Automated checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run check:untouched-reading
```

Expected:

- Type check and lint clean. `tsconfig.json` includes `specs/`, so review probes count.
- Vitest green, including `src/lib/reading/__tests__/`.
- Playwright green on both `mobile` and `desktop`.
- `check:untouched-reading` prints zero diff for every path in INV-037.
- `check:untouched` and `check:untouched-rhythm` are **expected to fail on this branch**. They are the
  guards of specs 004 and 005, they name files this entry changes on purpose, and neither is in CI.

## 3. Story 1: read a riff as notes

1. Make a 4-string song in E Standard, with a part holding two-digit frets, a chord, a group and each
   decoration.
2. On the song page choose `notes`. Every fret on the page becomes a name at once, and the card says
   `Note names`.
3. A palm-muted A reads `A·m`. A harmonic reads `<?>`.
4. Open the play view. It is already in notes. Choose `frets` there and go back: the song page is in
   frets too.
5. Choose `notes` and reload. No fret number shows at any point.
6. Copy the song as text. It holds fret numbers, and `Exports use fret numbers` is beside the buttons.
7. Open the capture screen and the paste preview: fret numbers.
8. The pending-write count has not moved.

## 4. Story 2: read a line against its chord

1. Give a part Am, then C7#9, then `N.C.`, across several bars.
2. Choose `intervals`. Columns read against the chord over them, and those after `N.C.` show note names.
   The caption reads `Intervals, and note names where no chord`.
3. Remove all the chords. The caption reads `Note names: no chords to read against`.
4. Put Am back in bar 1, and add an arrangement entry for bars 3-4. On the play view that pass reads
   against Am, and `(Am)` sits over its first column, whole and untruncated.
5. Switch that pass to frets or notes: `(Am)` is gone.

## 5. Story 3: see what a variant changed

1. On a long part tap `+ variant`. The new card says `Same as A`, with nothing marked, and never
   flashes anything else.
2. Add one column near the start. Exactly that column carries `+`, and the line says `1 added`.
3. Delete a column elsewhere. A `−1` gap sits between its neighbours.
4. Change one fret. One column carries `*`, and it does not read as one removed and one added.
5. Change only a technique, then a duration, then a chord. Each marks its column.
6. Switch density to compact, and the view to notes. The same columns are marked, with the same counts.
7. Build a second variant by copying all of the parent's columns into an empty part, and set its
   parent. It says `Same as A`.
8. Edit the parent in another tab. The marks change with nothing else done.

## 6. Story 4: see the flourish where it is played

1. Build `A x4` with A' on the last pass.
2. In the play view passes 1 to 3 have no marks and no line. Pass 4 has the song page's marks and line.
3. Cut the entry to bars 3-4. Marks and counts cover those bars, and the line ends
   `in these bars only`, or says `Same as A in these bars`.
4. Open the print preview with backgrounds off. Marks, lines and captions all print.

## 7. Failure cases

| Do this | Expect |
|---|---|
| Delete the parent | No marks and no line on the variant |
| Set `stablature.staffView` to `tabs`, and reload | Frets, with no error |
| Make `localStorage.setItem` throw, and tap `notes` | Notes for this visit, then frets after a reload |
| Paste two unrelated long parts and link them | The page stays responsive and every column is accounted for |
| A song with no tuning | No control |

## 8. Browser pass, owed after merge

The pipeline's implement and review phases have no browser. These stay open and are never ticked to
pass a gate. In Chrome, at actual size, in both themes, per `docs/DECISIONS.md`:

| Check | Screen |
|---|---|
| `·` is visible and is not mistakable for a rail or a mask gap | Song page, notes and intervals |
| Marked columns read as marked at a glance, and the tint does not fight the masks | Song page and play view |
| Desaturated, the marks still separate from unmarked columns in the light theme | Both |
| A removal gap reads as "something was here", not as a drawing fault | Song page |
| The caption in the card's padding reads as part of the card, and does not touch the staff or line | Both |
| A printed play view from the print preview, in greyscale | Play view |
| The control row at 375×667 with export, BPM, density and the view control together | Song page |
| With a classic desktop scrollbar, how a staff behaves when notes push it past the card's width | Song page, Windows |

Take colour readings from the screen at actual size, never from a magnified crop.
