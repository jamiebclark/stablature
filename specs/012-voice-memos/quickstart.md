# Quickstart: validating voice memos

**Feature**: `012-voice-memos` | **Plan**: [plan.md](./plan.md)

This guide proves the feature works end to end. The behaviour each step checks is defined in the
[contracts](./contracts/) and the [data model](./data-model.md); it is not restated here.

## 1. Prerequisites

- Node and the repo's dependencies (`npm ci`).
- Postgres running and migrated:
  ```bash
  npm run db:up
  npm run db:migrate          # applies drizzle/0006_* (memos, memo_audio)
  ```
- `.env.local` with `STABLATURE_DATABASE_URL` set. The memo e2e specs that read Postgres **fail** without it; they are
  never skipped when it is set.
- No `next dev` running. The e2e harness builds and serves its own production build on port 3100.
- Playwright's Chromium (`npx playwright install chromium`). The fake microphone file `e2e/fixtures/memo-tone.wav` is
  committed. To regenerate it, run `node scripts/make-memo-tone.mjs`.

## 2. Static checks

```bash
npm run typecheck              # assert-model.ts: _Memos, _MemoRecorder (FR-005)
npm run lint
npx drizzle-kit check          # the generated migration agrees with domain.ts
npm run check:untouched-memos  # INV-026: zero diff on the fenced paths
npm run check:memo-fence       # INV-022: one source for limits, formats, the erase
npm run check:memo-amendments  # INV-025: spec 008 FR-014 amended; DECISIONS sections present
npm run check:line-endings < /dev/null
```

Expected: each command exits 0. `check:untouched-memos` prints `zero diff` for every listed path.

## 3. Unit tests

```bash
npm test
```

The new suites and what they prove:

| Suite | Proves |
|---|---|
| `src/lib/sync/__tests__/memo-merge.test.ts` | M1–M6: 24 orderings, idempotence, the stamp survives (INV-005) |
| `src/lib/sync/__tests__/tables-agree.test.ts` | every table list agrees (FR-005) |
| `src/lib/memos/__tests__/recorder.test.ts` | endings E1–E16 and limits L1–L5 (INV-007, INV-009) |
| `src/lib/memos/__tests__/state.test.ts` | all 960 `memoState` inputs (INV-011) |
| `src/lib/memos/__tests__/transfer.test.ts` | every answer × {upload, fetch}; order and one at a time (INV-015) |
| `src/lib/memos/__tests__/formats.test.ts`, `body.test.ts`, `refusals.test.ts` | allow-list, sniffing, the cap, the words (INV-001, INV-022) |
| `src/lib/memos/__tests__/erase.test.ts`, `recover.test.ts`, `row-valid.test.ts`, `words.test.ts`, `capability.test.ts`, `sound.test.ts`, `storage.test.ts` | INV-004, INV-008, INV-019, INV-021, INV-020, INV-010, INV-029 |

Expected: all pass. `merge.test.ts` passes unedited.

## 4. End-to-end

```bash
npx playwright test e2e/memo-*.spec.ts
npx playwright test --project=insecure        # US4 on http://lan.test:3100
npm run test:e2e                              # the full suite: nothing else may fail
```

Scenario → spec map (each spec's invariant is in plan.md):

| Scenario | Spec | What you should see |
|---|---|---|
| US1: record offline, signed out, reload, play | `memo-record.spec.ts`, `memo-offline.spec.ts` | memo listed with `You`, length, date; plays; zero `/api/memos` or `/api/sync` requests |
| US2: two members, online | `memo-band.spec.ts` | B lists and plays A's 30 s memo within 10 s of Stop |
| US2: record offline, reconnect | `memo-band-offline.spec.ts` | B ready within 10 s of A reconnecting |
| US2 AS6: viewer records | `memo-refusal.spec.ts` | "You have read-only access to that band." on the memo; no `PUT` |
| US3: endings | `memo-endings.spec.ts`, `memo-recover.spec.ts`, `memo-full.spec.ts` | a memo plus a notice, or a notice that nothing was kept; microphone tracks ended |
| US4: insecure origin | `memo-unavailable.spec.ts` (`insecure` project) | item marked unavailable; the https explanation; synced memos play |
| US5: rename, download, delete, part delete | `memo-list.spec.ts`, `memo-download.spec.ts`, `memo-delete.spec.ts`, `memo-part-delete.spec.ts` | label syncs; file name and bytes; audio erased on the server and both devices |
| US6: unplayable format | `memo-states.spec.ts` | "This browser can't play WebM audio." with Download, and no play control |
| Hostile uploads and authority | `memo-routes.spec.ts` | the H1–H22 table, with `memo_audio` unchanged on every refusal |
| Nothing else moved | `memo-card-height.spec.ts` and the unedited `wide-*`, capture and sync specs | identical card boxes; existing specs green |

**Manual smoke test** (optional, at a dev server: `npm run dev:clean`, then open `http://localhost:3000`):

1. Sign up, add a band, a song and a part with a few notes.
2. In the part's menu, choose **Record memo**, and allow the microphone. The panel shows the elapsed time, the time
   left from 3:00, a moving level, **Stop** and **Discard**.
3. Speak for 5 s and tap **Stop**. The memo appears under the staff and plays.
4. In a second browser profile signed in as a bandmate (invite link from the band page), the memo appears within
   10 s and plays.
5. Delete it from the first profile. It disappears from both. Then
   `select bytes is null, erased_at from memo_audio` shows `t | <timestamp>`.

## 5. Browser check, at actual size (FR-103; owed, by a person)

This is done in a real browser at 100% zoom, in **both themes**, at **375×667** and **1280×800**. It is recorded in
`docs/DECISIONS.md` under "012 — browser check", as earlier entries recorded theirs. Check each of the following:

1. A card while recording: the timer is readable at a glance, "Only 0:14 left" stands out in the last 15 s, the level
   moves, and Stop and Discard are easy to hit.
2. A card holding a clip after running out of room: the words, Try again, Download the clip and Discard.
3. A card with memos in each state of FR-039: ready, uploading, saved on this device, will upload when online,
   refused (read-only), downloading, waiting, couldn't download, out of room, and deleted. The player and the words
   must be readable, and nothing may overflow the card.
4. A memo this browser cannot play.
5. The **Record memo** item on an insecure address (`http://<LAN IP>:3000`), and its explanation.
6. A part with 5 memos, collapsed and expanded. The wide layout uses the card's width.
7. The part-delete confirmation, and the memo-delete confirmation.
8. Print preview: no memo controls.

## 6. Owed on real phones (SC-010; recorded in DECISIONS under "012 — owed on real phones")

| # | Device | Do | Should show |
|---|---|---|---|
| P1 | iPhone, Safari (also from the home screen) | record 20 s on a part over https | timer and level; memo plays; format `audio/mp4` |
| P2 | Android, Chrome | record 20 s | memo plays; format recorded |
| P3 | both | each plays the other's clip | both play, or the memo says why and offers Download |
| P4 | iPhone, airplane mode | record, then turn airplane mode off | "Will upload when online", then uploads with no action; the bandmate gets it |
| P5 | iPhone, silent switch on | play a memo | audible |
| P6 | either | take a call during recording | the clip up to the call is kept, with the cut-short notice; the microphone indicator goes off |
