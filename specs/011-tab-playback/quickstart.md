# Quickstart: validating tab playback

This is a run guide. What each check proves is in [plan.md](./plan.md) *Invariants*. The shapes are in
[data-model.md](./data-model.md) and [contracts/](./contracts/).

## 0. Prerequisites and traps

- Node as in CI, `npm ci`. Postgres is needed only for the e2e suite (`npm run db:up`, `npm run db:migrate`).
- **Never run the build or the e2e suite while a dev server holds `.next`.** Playwright builds and serves production
  itself.
- If a style change seems to do nothing in `next dev`, run `npm run dev:clean` before debugging.
- A visual tier is never opacity over a surface token. The speed mark uses `bg-bg` with a border, and text tokens.
- Every file touched keeps its line endings. Run `npm run check:line-endings`.
- `tsconfig.json` includes `specs/`, so nothing under `specs/` may break `npm run typecheck`.

## 1. Baselines, recorded before any source change (T001)

Run these on the unedited tree, on this branch before the first source commit:

```bash
RECORD_GOLDEN=1 npx vitest run src/lib/rhythm/__tests__/engine-golden.test.ts   # writes engine-golden.json: schedule() and due() for 3 click streams on main's engine
npm test                                                                # the whole unit suite, as the before
npx playwright test e2e/click-*.spec.ts e2e/wide-click-*.spec.ts e2e/reading-*.spec.ts e2e/wide-narrow-unchanged.spec.ts
```

Record the pass counts under "011 — suite before" in `docs/DECISIONS.md`. A failure here is `main`'s, not this entry's.
`click-running.spec.ts:62` INV-025 is a known flake on `main` (it failed 5 of 6 first attempts in entry 010's CI).

## 2. Unit (no browser)

```bash
npx vitest run src/lib/playback src/lib/rhythm
npm test
npm run typecheck && npm run lint
```

Expected:

- `timeline.test.ts`: the length corpus L1 to L21 and the pitch corpus.
- `techniques.test.ts`: T1 to T19.
- `stream.test.ts`: S1 to S6, including S4 over the whole rhythm corpus.
- `engine.test.ts`: E1 to E10.
- `voice.test.ts`: SC-012's energy property over every preset's lowest string and the harmonic nodes.
- `choices.test.ts`: the stores.
- Every existing file under `src/lib/rhythm/__tests__/` and `src/components/rhythm/__tests__/` passes **unedited**.

## 3. Guards

```bash
npm run check:untouched-playback      # scope fence: prints "zero diff" per path, fails otherwise
npm run check:playback-amendments     # spec 005 Out of Scope amended; DECISIONS sections present; re-pinned tests named
npm run check:line-endings
```

## 4. e2e (production build, Playwright)

```bash
npx playwright test e2e/play-*.spec.ts
npx playwright test e2e/click-*.spec.ts e2e/wide-click-*.spec.ts e2e/reading-*.spec.ts e2e/wide-narrow-unchanged.spec.ts e2e/polish-*.spec.ts
npx playwright test     # the whole suite, last
```

Every `click-*`, `wide-click-*` and `reading-*` spec passes unedited. The only edited existing spec is
`polish-part-card-menu.spec.ts` (plan *Existing tests this changes on purpose*).

## 5. Scenarios to see working (the browser check, T-human)

Run `npm run build && npm start`, or `npm run dev:clean`. Seed the playback song with the throwaway Playwright probe
(`e2e/play-helpers.ts` `seedPlaybackSong`) or by hand. Check at actual size, in both themes, at 375×667, 412×915 and
1280×800. Log screenshots under the entry's heading in `docs/DECISIONS.md`, as entries 5 to 10 did.

1. **Part playback, three taps.** Song page → part T's menu → **Play** → **Play**. Expect four count-in clicks, then
   the notes, looping, with the outline moving. The line says the rule (`No note has a length, so each plays one
   beat.`). Tap Stop: silence at once.
2. **The whole song.** Play view → More → Notes on. The button reads **Play**. Play: the passes in order, a drawn-once
   card's head row reading `pass 2 of 4` on its second pass, and the outline scrolling into view. Turn Click off
   mid-run: the click stops from the next beat and the notes carry on.
3. **Speed.** Step to 70%. The bar shows the `70%` mark with the cluster closed. Nothing in the bar moves (compare
   screenshots). Reload the app: back to 100%, and the song's tempo is unchanged.
4. **Loop off.** It ends by itself. The bar returns to rest with no stopped line, and focus is on **Play** if Stop had
   it.
5. **Techniques by ear** (SC-013), on the laptop's own speakers. Play part T at 70% and name each row: hammer-on and
   pull-off (no re-pick), slides (glide), vibrato (wobble), palm mute (short and dark), thud, let ring (rings under the
   next note), harmonics (bell). `bend` and `tap` sound plain.
6. **Mix.** The six-note let-ring chord under further notes does not distort, and the click stays audible.
7. **Reduced motion.** With `prefers-reduced-motion`, the outline still follows and scrolls without smoothing.
8. **Greyscale.** The outline is a box, not a fill, and is told apart from a capture selection.
9. **Print preview of part playback.** One card, no bar.

## 6. Owed to a real phone (stays 🛑 BLOCKED in tasks.md until done)

- From the phone's own speaker at full volume, a part on the B string of a five-string is heard and its notes told
  apart in a quiet room.
- With the silent switch on, the app is silent, the outline still moves, and the help line shows.
- In airplane mode, opened from the home screen: part playback and arrangement playback both work on a song opened
  before, reached by tapping through the app.
- Locking the phone and an incoming call both stop playback cleanly, ringing notes included, and Play works afterwards.
- The screen stays on through a five-minute looped part.
- The cluster's new controls are each hit first time with a thumb at 375 wide.
