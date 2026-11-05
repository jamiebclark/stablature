# Quickstart: validating durations, tap tempo and the click

How to prove this entry works. What is proved where is in [plan.md](./plan.md)'s invariants, and the
exact words and hooks are in [contracts/components.md](./contracts/components.md).

## 1. Prerequisites

- `npm ci`, and `npx playwright install chromium`.
- Postgres only for the two-device scenarios (`npm run db:up`, `npm run db:migrate`). They skip without
  it, and a skip is not a pass for INV-017.
- Never run the build or e2e suite while a dev server holds the same `.next`.

## 2. Automated checks

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run check:untouched-rhythm
```

Expected:

- Type check and lint clean. `tsconfig.json` includes `specs/`, so review probes count.
- Vitest green, including `src/lib/rhythm/__tests__/`.
- Playwright green on both `mobile` and `desktop`.
- `check:untouched-rhythm` prints zero diff for every path in INV-043.
- `npm run check:untouched` is **expected to fail on this branch**. It is spec 004's guard, it names
  `layout.ts` and `TabStaff.tsx`, and it is not in CI.

## 3. Story 1: play along

1. Make a song, give it 120 on the song page, and open the play view. No durations anywhere.
2. Tap start. Four clicks, numbered 1 to 4, then the beat carries on with no gap.
3. Tap stop. Silence at once, and start is back.
4. Clear the tempo on the song page. The play view says a tempo is needed, start is unavailable, and
   the tempo control is beside it.

## 4. Story 2: what tempo was that?

1. On the capture screen, arm a latch and tap a column mid-part.
2. Open the tempo control. Tap steadily. No reading on the first two taps, one on the third.
3. Close without setting. Song unchanged.
4. Open again, tap, and set. The sheet closes. The control, the song page field, the band list, the
   play view subtitle and the export heading all say the new tempo.
5. The cursor is where it was, the latch is still lit, and the URL has not changed.
6. With the click running in the play view, set a new tempo. The speed changes within a second, with
   no count-in.

## 5. Story 3: say how long a note is

1. Long-press a column. The row reads `w h q 8 16 32` on one line.
2. Tap `8`: it lights and the sheet stays open. Tap `16`: `8` goes out. Tap `16`: nothing is lit.
3. Open the inspector on a barline: no row. On a space: the row is there.
4. Set `8` on a few columns and close. The status row shows `eighth note` at those columns, and the
   staff has not moved.
5. Open the song page: a row of marks under the staff. Switch to compact: one mark under a repeated
   column.
6. Export as text. Identical to a part with no durations.
7. Copy some columns and paste them, and make a variant. The durations travel.
8. Clear them all. The staff is back to how it was, with no empty row.

## 6. Story 4: a click that knows the rhythm

Build the worked example: bar 1 four `q`, a barline, then a triplet of `8`, `q`, `h`. Add it to the
arrangement and start. Compare with the table in [contracts/notation.md](./contracts/notation.md).

1. The screen says it is following the notation.
2. Clear one duration in bar 2 and start again. Bar 1 is followed, then it turns plain and says so.
3. Turn off `Follow notation`, then start: a plain beat from the first click.

## 7. Offline

Run with a production build. Open the play view while online and wait until the page is cached, then:

1. Go offline. Reach the play view by tapping through the app, **not** only by a direct open, because
   specs/004 FU25 saw controls go missing that way.
2. Start the click, and open and use the tempo sheet.
3. DevTools shows no request from either.

## 8. Person-level pass (owed after merge)

No phase of the pipeline has a browser, so this stays open until someone has looked. Actual size, not
a magnified crop, at 375×667, in both themes.

| Look at | Pass when |
|---|---|
| The rhythm row on the song page and play view | All six marks readable and told apart, and they read as part of the staff, not as noise |
| A greyscale capture of the same | Nothing depends on colour |
| The six positions in the inspector | One line, lit position obvious |
| The tempo control in the capture header | Findable, and a long title does not squeeze it out |
| The click bar | Does not feel like it is sitting on the music |
| The beat indicator | Accent, beat and soft told apart at a glance, nothing flashes |
| The tempo sheet | The reading can be read while tapping |

Log findings under this entry on the `verify-log` branch of the verify worktree.

## 9. Owed to a real phone

From the spec. These stay open, and are not ticked to get past a gate.

- The click is audible over a played bass from the phone's own speaker at full volume.
- With the silent switch on, the app stays silent, the beat shows, and the help is there.
- With airplane mode on and the app opened from the home screen, the click and the tempo sheet work on
  a song opened before, reached by tapping through the app.
- The screen stays on for a five-minute run on a phone that would otherwise sleep.
- Locking the phone and an incoming call both stop the click cleanly, and start works afterwards.
- Tapping quickly on the tap pad neither zooms the page nor drops taps.
