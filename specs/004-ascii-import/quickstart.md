# Quickstart: validating ASCII import

How to prove the feature works end to end. Behaviour is defined in [spec.md](./spec.md), the
grammar in [contracts/reader.md](./contracts/reader.md), and the invariants in [plan.md](./plan.md).

## Prerequisites

- `npm ci` has been run.
- Nothing else holds `.next`. Never run the build or the e2e suite alongside a dev server.
- The sync scenarios need Postgres (`npm run db:up`, then `npm run db:migrate`) and skip themselves
  without `STABLATURE_DATABASE_URL`.

## 1. Automated gates

Run these synchronously, in this order:

```bash
npm run typecheck < /dev/null
npm run lint < /dev/null
npm test < /dev/null
npm run test:e2e < /dev/null
```

**Expected**: all pass.

## 2. The backbone on its own

```bash
npx vitest run src/lib/tab/__tests__/round-trip.test.ts < /dev/null
```

**Expected**: passes, having recorded at least 1,000 calls, with every ledger class hit. A failure
prints the text that did not come back. See [contracts/round-trip.md](./contracts/round-trip.md).

## 3. What must not have changed (INV-026)

```bash
git diff --stat main -- src/lib/tab/ascii.ts src/lib/tab/layout.ts src/components/tab/TabStaff.tsx
git diff --stat main -- src/lib/tab/__tests__/ascii.test.ts src/lib/export/__tests__/text.test.ts
git diff --stat main -- src/lib/local/__tests__/clipboard.test.ts
git diff --stat main -- drizzle src/db src/lib/server src/app/api src/lib/local/db.ts
```

**Expected**: every command prints nothing.

```bash
git diff main -- src/lib/sync/protocol.ts
```

**Expected**: only literals swapped for the three new constants and their import.

## 4. Stories by hand

`npm run dev:clean`, then open a band with a song in **B Standard (Bass 5)** holding parts A and B.

### Story 1: text the app wrote

1. Tap **Copy text** on a song. Paste into a scratch note, and cut out one part's staff.
2. Tap **Paste tab** and paste it.

**Expected**: the preview draws the same staff, and the status says part C. Toggle **compact** and
**expanded**, and the preview follows. Tap **Import as part C**. The panel closes, part C is in
view and draws what the preview drew, and the arrangement is unchanged.

### Story 2: tab from the wild

In a song tuned `G D A E`, paste:

```text
G|---------------|
D|---------------|
A|-----5-----7---|
E|---3-----------|
and a line of lyrics here

G|---------------|
D|---------------|
A|---------------|
E|---5-----3-----|
```

**Expected**: one part, two bars, the notes in order, no spaces read, and the lyric line listed with
its line number.

### Story 3: a refusal

Paste a good staff, then change one note to `7b9`.

**Expected**: no preview and no import button. The message gives the line number, shows the line,
and says why. Change the text back, and the preview returns with nothing else to do.

### Story 4: another tuning

In an **empty** song in `G D A E`, paste five rows `G D A E B` with notes on the `B` row.

**Expected**: the button reads **Switch to B Standard and import**, and the preview has five rows.
After the import the song is five-string, the band has B Standard, and the band default is the same
as before.

Repeat in a song in `F C G D` holding notes.

**Expected**: refused, naming both tunings, and the song unchanged.

## 5. Offline

In DevTools, set the network to offline and repeat Story 1.

**Expected**: it works. The pending-writes count rises. Back online, it drains with no rejected row.

## 6. The person-level pass (owed after merge)

The pipeline has no browser. This is SC-010, FR-033 and INV-032, and they stay unverified until
someone has done it. From the verify worktree, in Chrome, at 375×667 and actual size, in **both
themes**:

| Look at | Asking |
|---|---|
| The **Paste tab** button beside **+ part** | Does the row still fit on one line, or wrap tidily? |
| The empty song's two buttons | Do they sit together? |
| The box with the phone keyboard up, if a real phone is to hand | Can you see what you pasted? |
| A 200-character line in the box and in a refusal | Is the page still unable to scroll sideways? |
| A refusal | Can you read the line, its number and the reason at actual size? |
| The preview of a long part | Does it scroll inside itself? |
| The ignored and notes lists, light theme | Legible, not faint? |
| Eight bars pasted and imported on a phone | Under 30 seconds (SC-005)? |

Log findings in `docs/DECISIONS.md` on the verify worktree's `verify-log` branch.

## 7. Pasting for real

Automated tests `fill` the box, so a real paste gesture is checked only here. Long-press, **Paste**,
on a phone, from a chat app. **Expected**: line breaks survive, and if a chat app turned `--` into
`—`, the message says so. The spec counts that as a refusal, not a defect.
