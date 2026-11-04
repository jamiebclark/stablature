# Quickstart: validating playing techniques

How to prove the feature works end to end. Behaviour is defined in [spec.md](./spec.md), and
the grammar in [contracts/notation.md](./contracts/notation.md).

## Prerequisites

- `npm ci` has been run.
- Nothing else holds `.next`. Never run the build or the e2e suite alongside a dev server.
- `e2e/sync.spec.ts` needs Postgres (`npm run db:up`) and skips itself without
  `STABLATURE_DATABASE_URL`.

## 1. Automated gates

Run these synchronously, in this order:

```bash
npm run typecheck < /dev/null
npm run lint < /dev/null
npm test < /dev/null
npm run test:e2e < /dev/null
```

**Expected**: all pass. No `test.fail` mark remains on the mid-part paste case.

## 2. The storage fence (INV-001, INV-003)

```bash
git diff --stat main -- src/db drizzle src/lib/model.ts src/lib/sync src/lib/local/clipboard.ts src/lib/local/db.ts
git diff --stat main -- src/lib/tab/__tests__/ascii.test.ts src/lib/export/__tests__/text.test.ts
```

**Expected**: both print nothing.

## 3. Line endings (F27)

```bash
git ls-files --eol src/components/tab/TabStaff.tsx src/components/ui/index.tsx \
  e2e/capture-surface.spec.ts src/components/capture/__tests__/ColumnInspector.test.tsx
```

**Expected**: `i/crlf w/crlf` on all four, and a `git diff --stat` for each that shows only
the lines really changed.

## 4. Capture by hand

`npm run dev`, at a 375×667 viewport. Use a B Standard part. All text below is the row for
that string, from the staff or from **Download** on the song page.

| # | Do | Expect |
|---|---|---|
| 1 | Fret 5 on E, tap `h`, fret 7 on E, fret 9 on E | Reads `5h7-9`. The chip lit while armed, the status line said `next note: hammer-on`, and the chip went dark after the 7. |
| 2 | Tap `h`, then `p` | Only `p` is lit. |
| 3 | Tap `p` again | Dark. Nothing was written. |
| 4 | Tap the first column, arm `stack` and `/`, fret 3 on A | The note joins that column with a slide on A. `/` is dark, stack is still lit, the status line said `stack + slide up`. |
| 5 | Tap barline, tap `/`, fret 7 on E | The slide is drawn after the barline. |
| 6 | Tap `start` | All four chips are unavailable and have not moved. |
| 7 | Hold a column, or tap the `details` button | The sheet opens. Each played string has its own toggles. |
| 8 | Turn on vibrato, close | The note reads `7~`, and the sheet stayed open while toggling. |
| 9 | Toggle two decorations as fast as you can | Both land. |
| 10 | Tab to a column, press `Shift+F10`, Tab to a toggle, press Space | The sheet opens and the toggle flips with no pointer. |
| 11 | Set stack, paste with the cursor mid-part | Stack is still lit once the columns appear. |
| 12 | Delete the 5 in `3`, `5`, `h7` | The part reads `3h7`. |

## 5. The repeat rule

Capture a 5, then arm `h` and fret 7, and press `×3` on the 7. On the song page:

| Density | Reads |
|---|---|
| Expanded | `5h7h7h7` |
| Compact | `5h7x3` |

## 6. The browser pass (a person, at actual size)

**Not run by the pipeline.** Its implement and review phases have no browser, so this
happens after merge, in a separate worktree (spec assumption; `docs/DECISIONS.md`).

Use one part with all four connectors and all six decorations. Check it at 375×667 in the
**light and dark** themes, without zooming:

- [ ] All four connectors can be told apart on the staff. `/` and `\` do not read as mush.
- [ ] A tap reads differently from a hammer-on (`t7` against `5h7`).
- [ ] All five chips are legible, lit and unlit.
- [ ] Toggles read clearly on and off, without relying on colour.
- [ ] Connectors look right inside a selection, and on the song page's raised surface.
- [ ] A real phone: hold a column and lift. No toggle flips.

If `/` or `\` fail, adjust `.tab-connector` in `src/app/globals.css`. **The characters do not
change.** If a style appears to do nothing, run `npm run dev:clean` before touching the CSS.
