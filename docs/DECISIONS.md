# Decisions

A running log of calls made while you were away, with the reasoning, so you
can overturn any of them quickly. Newest first. Anything marked **worth your
eye** is either a judgement call I am least sure about or something with a
cost you should know about.

---

## 2026-11-02 — session with Jamie away

### Process

**Browser testing is now part of "done", not an afterthought.**
Three defects this session reached you despite a green suite, and all three
were rendering or wiring problems a test could not see: a selection band that
was invisible, a cursor highlight that buried the staff, and buttons wrapping
their labels. Playwright asserts structure; it does not have an opinion about
whether something is legible. Every visual change from here gets looked at in
Chrome at actual size.

**Verifying a colour through a magnified crop is not verifying it.**
I confirmed the selection band by zooming into a 400×120 region, which
flatters a subtle tint into looking obvious. Screenshots for colour and
contrast decisions are taken at actual size now.

**Two stale-artifact traps bit this session; both are now closed.**

- The long-running dev server served a CSS chunk that predated a whole
  feature. Source and clean build were both correct. If styling ever looks
  impossible, kill the dev server and `rm -rf .next` before debugging
  anything else.
- Playwright was reusing an orphaned `next start` left behind by an
  interrupted run, so the suite was testing a build from before the changes —
  a renamed button passed its own test. `reuseExistingServer` is now `false`.
  Costs ~20s a run; worth it.

---

### Fixed

**Light mode: the fretboard was unusable.** Worth your eye — this one was a
genuine defect, not a polish item, and nobody had ever looked at the light
theme. The cell tiers were `bg-raised` at 25% and 60% opacity. On near-black
that gives three readable steps; on near-white `bg-raised` *is* white, so the
tiers collapsed into the background and the fret numbers went with them. The
primary input surface effectively disappeared if your phone was in light mode.

Tiers are now explicit colour tokens per theme (`--fret-cell`,
`--fret-cell-inlay`, `--fret-number`) rather than opacity over a surface.
Checked in both themes at actual size.

The lesson generalises: opacity over a surface token is only safe when the
surface is dark. Anywhere else, name the colour.

---

### Merged: chord-tone highlighting (another Claude session)

**Worth your eye** — this is someone else's feature and I merged it on your
behalf. A second session built it in a worktree on `feat/chord-tones`: chord
symbols are parsed into notes, and the frets belonging to the chord in force
at the cursor light up on the neck. Roots in bold, the notes actually in the
current column still win. 26 new unit tests; the status bar now reads e.g.
`C · C E G`.

I reviewed it rather than taking their word, rebased it onto main, resolved
one conflict in the fretboard cell renderer, and verified it in a browser. It
is on main. Revert `6d62315..5982f0b` if you would rather it waited.

Two things I changed in the merge:

- Their background tiers used the opacity approach I had just removed for
  breaking the light theme, so the resolution kept their `tier`/`ink` split
  but on the per-theme tokens.
- **The feature silently did not work after merging**, and the measurements
  caught it where eyes would not have: the chord-tone colour was rendering at
  the resting grey. `.fret-cell { color }` was beating `text-accent`.

  The cause is worth remembering. Lightning CSS flattens `@layer components`
  into plain rules and hoists the layer declaration to the top, so custom
  classes land *after* the utilities in source order and win every specificity
  tie. Wrapping rules in a layer buys nothing here. The fretboard has no
  classes of its own now — the tokens are exposed as Tailwind colours and the
  component emits exactly one background utility and one text utility per
  cell. Nothing to override, nothing to order.

### `npm run dev:clean`

Turbopack's CSS cache went stale on the long-running dev server three separate
times today, each time silently: source right, production build right, browser
serving an older chunk. It is what made the selection highlight look invisible
to you. Added a `dev:clean` script that clears `.next` first, and documented it
in the README as the first thing to try when a style change appears to do
nothing.

---

_Entries below are added as the day goes._
