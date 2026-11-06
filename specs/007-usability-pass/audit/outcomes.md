# Audit outcomes (INV-046)

After figures are in `after.txt` (production build, `playwright.audit.config.ts`; the walk audits all pass; the two exploratory `candidate`/`plan-candidate` six-string audits from the planning stage time out and are not part of the result). Before figures: `before.txt`.

| Id | Outcome | Reason / where it landed |
|---|---|---|
| A1 | fixed | FR-011: top bar and logo meet the target floor; `under24` is 0 on every page but the footer-only cases below. |
| A2 | fixed | FR-011: footer links grown to the floor. |
| A3 | fixed | FR-011: back links grown. |
| A4 | fixed | FR-011: buttons, inputs, segmented controls and family tabs at the floor (44 touch, 32 fine pointer). |
| A5 | fixed | FR-011/FR-012: steppers and sheet close buttons. |
| A6 | fixed | FR-012: capture title, jump buttons, part chips, delete. |
| A7 | fixed | FR-013: bracket controls widened and separated. |
| A8 | fixed | FR-011: part names are a real control. |
| A9 | fixed | FR-016: a cue is a button. |
| A10 | fixed | FR-041/FR-044: main actions moved to the bottom bar. |
| A11 | accepted | The neck rightly owns the bottom half at 375×667; the toolbars move 10 to 19px closer to it and stay in reach (spec Decisions). |
| A12 | fixed | FR-042: first staff within the first screen with panels shut. |
| A13 | fixed | FR-043/FR-044: play view chrome reduced; click bar in a cluster. |
| A14 | fixed | FR-055: wrapped play-view staff. |
| A15 | fixed | FR-024: chord labels are never cut; `clipped` lists none of them. |
| A16 | fixed | FR-026: status row keeps its words. |
| A17 | fixed | FR-027: long titles can be read. |
| A18 | fixed | FR-028: chord form hint. |
| A19 | fixed | FR-019: paste status clear of the keyboard. |
| A20 | fixed | FR-020: inspector input clear of the keyboard. |
| A21 | fixed | FR-017: inputs are 16px. |
| A22 | fixed | FR-018: zoom no longer locked. |
| A23 | fixed | FR-022: safe-area insets. |
| A24 | fixed | FR-029: `--text-faint` raised above 4.5:1. |
| A25 | fixed | FR-015/FR-029: fret numbers and neck header contrast. |
| A26 | fixed | FR-030: bracket numerals 12px, clear of the line. |
| A27 | fixed | FR-031: rhythm marks beneath their notes, 12px. |
| A28 | fixed | FR-032: staff in JetBrains Mono. |
| A29 | fixed | FR-033: ligatures off on tab text. |
| A30 | accepted | Sign-up is 19px taller than 375×667; it scrolls and the keyboard's Go key submits. |
| A31 | fixed | FR-005: band no longer strands or vanishes on a short screen. |
| A32 | logged | Delete on a part or tuning has no undo: a new idea, not a size problem. FR-014 keeps it clear of its neighbours. |
| A33 | fixed | FR-012: contextual row controls equal height and not overfull. |

Re-run after review remediation (T143, T142, T154): `after.txt` now shows the offline page's link at the control height (`under24` 0 where it was 1) and the `default` pill at 4.5:1 or better in both themes (`lowContrast dark` 0 where it was 3.63). No outcome above changed.
