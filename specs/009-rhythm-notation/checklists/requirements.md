# Specification Quality Checklist: Rhythm notation under the tab

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-13
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Validated in one pass on 2026-11-13. No item failed.
- **House style, not leakage.** File paths, test file names and `docs/DECISIONS.md` appear only where earlier specs (005, 007, 008) set the precedent: the "Where the brief and the code differ" table, the Dependencies list, and the amendment and test-update requirements (FR-035 to FR-037). These name what must be amended or re-pinned. They do not prescribe how to build anything. Requirements describe shapes, rules and measurements, not components or code structure.
- **Pixel figures are user-facing measurements.** These are the 189px band, the 54×44 buttons, the 2 CSS px beams and the 1px alignment tolerance. They carry forward measured guarantees from specs 003, 007 and 008, or the brief's own legibility concern. They are not implementation choices.
- **"Drawn inline, no font" (FR-033)** is a constraint from the brief: an offline PWA must not fetch assets for this. It is stated as an outcome, "no fetched asset, works on a cold open", not as a technique.
- **No clarifications were raised.** Per the standing instruction to decide and log, every open choice the brief left was made in "Decisions made for this spec":
  - bracket placement;
  - capture drawing rhythm;
  - half and whole shapes;
  - the button symbols;
  - the status-line words;
  - compact repeats;
  - beaming of counted groups and rests;
  - per-bar beats.

  The ones marked **worth your eye** are the bracket placement and the half and whole shapes.
- **Scope check.** The spec covers one surface (rhythm under the staff, on every screen that draws one) and the one control that sets it. It is not a bundle.
