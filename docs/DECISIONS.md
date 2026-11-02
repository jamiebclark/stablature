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

_Entries below are added as the day goes._
