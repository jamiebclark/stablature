# Spec 011 review probes

Re-run every probe here FIRST in each review round. A probe that held last round and fails now is a regression.

## How to run

From the repo root, with no dev server holding `.next`:

```sh
# unit tier
npx vitest run --config specs/011-tab-playback/review-probes/vitest.probes.config.mts

# e2e tier: build once, then the probes and the play-* suite over that build
npm run build
REVIEW_DIR=probes npx playwright test -c specs/011-tab-playback/review-probes/playwright.review.config.ts --workers=4
REVIEW_DIR=e2e REVIEW_MATCH='play-[a-z-]+\.spec\.ts$' npx playwright test -c specs/011-tab-playback/review-probes/playwright.review.config.ts --workers=4

# INV-020 without grep -iF (which aborts in Git Bash grep 3.0 here)
node specs/011-tab-playback/review-probes/INV-020-amendments.mjs
```

`tsconfig.json` includes `specs/`, so run `npm run typecheck` after editing a probe: one type error here fails `next build`.

## Round 1 (2026-11-16)

| Probe | Tier | Result |
|---|---|---|
| `INV-003-length-rule-seeded.test.ts` | unit | held, 6000 seeds |
| `INV-004-agreement-seeded.test.ts` | unit | held, 6000 seeds |
| `INV-005-string-holds-one-note.test.ts` | unit | **violated**, 6 of 14 (F4) |
| `INV-018-every-string-every-fret.test.ts` | unit | **violated**: (1) 17 of 510 plan members, (2) 9 band members (F3) |
| `INV-008-focus-after-end.spec.ts` | e2e | held, 4 of 4 |
| `INV-010-whole-song-outline.spec.ts` | e2e | held, 2 of 2 |
| `INV-012-speed-with-notes-off.spec.ts` | e2e | **violated**, 2 of 2 (F1) |
| `INV-013-bar-every-state.spec.ts` | e2e | held, 6 of 6 |
| `INV-016-offline-requests-in-window.spec.ts` | e2e | held, 12 of 12 |
| `INV-017-part-playback-leaves-song-choices.spec.ts` | e2e | fails 4 of 4 on MINORs F7 and F8 (Notes choice itself held) |
| `INV-018-mix-peak-through-the-chord.spec.ts` | e2e, desktop | **violated**, 2 of 2: peak 1.071 at column 13 (F2) |
| `INV-020-amendments.mjs` | node | held |

## Round 2 (2026-11-16)

Every round-1 probe re-run first. No regression: the four violated in round 1 now hold, and INV-017 still fails on
MINORs F7 and F8 only (round-1 numbering).

| Probe | Tier | Result |
|---|---|---|
| `INV-003-length-rule-seeded.test.ts` | unit | held, 6000 seeds |
| `INV-004-agreement-seeded.test.ts` | unit | held, 6000 seeds |
| `INV-005-string-holds-one-note.test.ts` | unit | held, 14 of 14 (was 8 of 14) |
| `INV-018-every-string-every-fret.test.ts` | unit | held, both tests (was violated) |
| `INV-008-focus-after-end.spec.ts` | e2e | held, 4 of 4 |
| `INV-010-whole-song-outline.spec.ts` | e2e | held, 2 of 2 |
| `INV-012-speed-with-notes-off.spec.ts` | e2e | held, 2 of 2 (was violated) |
| `INV-013-bar-every-state.spec.ts` | e2e | held, 6 of 6 |
| `INV-016-offline-requests-in-window.spec.ts` | e2e | held, 12 of 12 |
| `INV-017-part-playback-leaves-song-choices.spec.ts` | e2e | fails 4 of 4 on round-1 MINORs F7 and F8, as in round 1 |
| `INV-018-mix-peak-through-the-chord.spec.ts` | e2e, desktop | held, part T peak at or under 1.0 (was 1.071) |
| `INV-020-amendments.mjs` | node | held |

New this round:

| Probe | Tier | Result |
|---|---|---|
| `INV-018-mix-seven-string-chord.spec.ts` | e2e, desktop | **violated**, 6 of 7: let-ring chords on every string peak 1.118 (guitar 6 open E), 1.142 (guitar 7 open), 1.103 (guitar 7 unison); with Click off 1.131, 1.167, 1.095. Bass 4, four notes: 0.880, held |
| `INV-018-mix-gain-stages.spec.ts` | e2e (offline render), desktop | diagnostic, models the graph without app code; holds on the FLOOR-kept case. With synth.ts's envelope order, 6 voices 1.098 and 7 voices 1.126 after the limiter; with the FLOOR start kept, 0.847 and 0.877. One voice's onset 0.735 against 0.442 |
| `INV-018-f0-drop-f.spec.ts` | e2e, desktop | held: share above 200 Hz 1.000 in 10 of 10 reads |
| `INV-012-notes-off-midrun.spec.ts` | e2e | held, 2 of 2: Notes off, count-in 0.75 s at 160 x 50%, then 0.375 / 0.5 / 1.0 s after speed and stored-tempo changes mid-run, one context |
| `INV-013-014-notes-off-speed.spec.ts` | e2e | held, 6 of 6: speed controls with Notes off meet the floors at 375 and 412 (touch) and 1280 (mouse); bar height and controls unmoved at 70% at rest and running |
| `INV-009-022-part-scope-keys-and-back.spec.ts` | e2e | held, 8 of 8 (two repeats): Space and `r` in part scope; browser back from a running part |
| `INV-006-variant-part.spec.ts` | e2e | held, 2 of 2: variant A' plays exactly its drawn columns |
| `plan-line-endings-kept.mjs` | node | **violated**: `ClickBar.tsx` and `audio.ts` LF to CRLF, and 12 new files with CRs |

Run the new e2e probes the same way (`REVIEW_DIR=probes`, `REVIEW_MATCH=...`). The mix probes skip on mobile.

## Round 3 (2026-11-16)

Every round-1 and round-2 probe was re-run first. None regressed. The two violated in round 2 now hold. INV-017 still
fails 4 of 4, only on round-1 MINORs F7 (Loop leaks into the whole song) and F8 (deleting the part mid-run).

| Probe | Tier | Result |
|---|---|---|
| unit tier (`INV-003`, `INV-004`, `INV-005`, `INV-018-every-string-every-fret`) | unit | held, 18 of 18 |
| `INV-020-amendments.mjs` | node | held |
| `plan-line-endings-kept.mjs` | node | held (was violated, F17) |
| `INV-018-mix-seven-string-chord.spec.ts` | e2e, desktop | held, 7 of 7 (was 6 of 7 over). Peaks: guitar 7 unison 0.738, guitar 7 open 0.752, guitar 6 open 0.728, bass 4 0.793; with Click off 0.805, 0.754, 0.738 |
| `INV-018-mix-gain-stages.spec.ts` | e2e (offline render), desktop | diagnostic, unchanged: it models the graph, not the app |
| `INV-018-mix-peak-through-the-chord.spec.ts` | e2e, desktop | held |
| `INV-018-f0-drop-f.spec.ts` | e2e, desktop | held, 1.000 in 10 of 10 reads |
| every other round-1 and round-2 e2e probe | e2e | held: 50 passed, 10 skipped (desktop-only), and INV-017's 4 by design |

New this round:

| Probe | Tier | Result |
|---|---|---|
| `INV-018-mix-every-tone-column.spec.ts` | e2e, desktop | held, 6 of 6. A column on every string, on every beat, for the tones round 2 never chorded. Dead chug on guitar 7: 0.685, and 0.722 with Click off. Dead chug on bass 6 with Click off (three thuds share the 150 Hz band and the one noise buffer): 0.679. Palm-muted on guitar 7: 0.698. Harmonics on guitar 7: 0.750. Let-ring then chug on guitar 7: 0.752 |
| `INV-009-stop-every-moment.spec.ts` | e2e | held, 36 of 36. The six **Stop** members × {mid-glide t0+1.42, mid-let-ring t0+7.2, loop seam t0+13.99} × 2 projects, timed on the audio clock. `e2e/play-stop.spec.ts` stops only in the count-in and on the first notes |

Run them like the others: `REVIEW_DIR=probes REVIEW_MATCH='INV-009-stop-every-moment\.spec\.ts$'`, and the same for
`INV-018-mix-every-tone-column`. The mix probe skips on mobile.

`npm run build` can stop once with `SecurityFatalError` (a Next.js advisory notice) after it has compiled. Run it again
and it completes.
