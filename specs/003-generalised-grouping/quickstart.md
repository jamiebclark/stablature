# Quickstart: validating generalised grouping

How to prove the feature works end to end. Behaviour is defined in [spec.md](./spec.md), the
grammar in [contracts/notation.md](./contracts/notation.md), and the invariants in
[plan.md](./plan.md).

## Prerequisites

- `npm ci` has been run.
- Nothing else holds `.next`. Never run the build or the e2e suite alongside a dev server.
- The sync scenarios need Postgres (`npm run db:up`, then `npm run db:migrate`) and skip
  themselves without `STABLATURE_DATABASE_URL`.

## 1. Automated gates

Run these synchronously, in this order:

```bash
npm run typecheck < /dev/null
npm run lint < /dev/null
npm test < /dev/null
npm run test:e2e < /dev/null
```

**Expected**: all pass. `src/lib/__tests__/storage-fence.test.ts` no longer exists.

## 2. What may and may not have changed in the tests (INV-020)

```bash
git diff --stat main -- src/lib/tab/__tests__/ascii.test.ts src/lib/export/__tests__/text.test.ts
git diff --name-only main -- '*.test.ts' '*.test.tsx' '*.spec.ts'
```

**Expected**: the first prints nothing. The second lists only new files, the removed fence,
`editing.test.ts` (FR-037) and `properties.test.ts` (plan, Deviation 2).

## 3. The schema guard can still fail (INV-025)

In a scratch copy, never in the working tree, delete the `groupKind` line from `events` in
`src/db/schema/domain.ts` and run `npm run typecheck < /dev/null`.

**Expected**: it fails, naming `src/db/schema/assert-model.ts`.

```bash
cat drizzle/0004_*.sql
```

**Expected**: one `CREATE TYPE` and one `ADD COLUMN`, and nothing else.

## 4. Walk the stories in a browser

`npm run dev:clean`, then open a phone-sized view at 375×667.

1. **Any size.** Capture six notes. Tap `select` and tap the last column. The toolbar under
   `space barline select paste` shows a bracket reading 6. Tap it. One bracket with a 6 spans
   the columns, the selection ends and the cursor has not moved.
2. **Plain.** Select four columns and tap the empty bracket. A bare bracket appears, and the
   export shows `,-----,`.
3. **Change presentation.** Select exactly those columns and tap the numbered bracket. It gains
   a 4.
4. **Across a bar.** Add a barline inside a selection. The numbered control goes, and the empty
   one makes one bracket per bar.
5. **Take apart.** Select two columns of a six-column group and tap `ungroup`: the whole
   bracket goes. Make it again, long-press a column, and the sheet reads `tuplet of 6` with an
   `ungroup` button. Tap it: the bracket goes and the sheet closes.
6. **The triplet button.** Three notes, tap it, one bracket with a 3. In a new part with two
   notes, tap it: no bracket, and the status line reads
   `a triplet needs three columns in one bar`. Tap a column and the message clears.
7. **Limits.** Select 16 columns and the control reads 16. Select 17 and only the empty bracket
   remains.

## 5. Sync (needs Postgres)

Sign in on two browser contexts, on one band. On the first, make a plain group of 20 columns.

**Expected**: the second draws it with no number, the first shows no sync error, and:

```sql
select tuplet_count, group_kind, count(*) from events
where part_id = '<part>' group by 1, 2;
```

returns one row: null, `plain`, 20.

## 6. The person-level pass (owed after merge, INV-027)

The pipeline has no browser, so this happens from the separate verify worktree, as for the
previous entries, and is logged in `docs/DECISIONS.md`. **Nothing is claimed for it until
someone has looked.** At actual size, in both themes, at 375×667:

- [ ] A plain bracket is visible and reads as a bracket on the capture staff, the song page in
      both densities, and the play view.
- [ ] A plain bracket over a selected column is visible.
- [ ] The tuplet control reads clearly at 2, 3, 4, 8, 10 and 16, with no digit touching the
      bracket.
- [ ] The empty bracket reads as a bracket, not as a line.
- [ ] The triplet button looks exactly as it did.
- [ ] All seven controls show on one line, with labels unwrapped, and feel usable by thumb.
- [ ] Copy, cut and delete in their new row feel right (plan, Deviation 1).
