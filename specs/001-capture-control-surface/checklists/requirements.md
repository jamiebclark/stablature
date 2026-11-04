# Specification Quality Checklist: Restructure the capture control surface

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-02
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

All items pass. Three things were corrected during validation and are recorded
here so the next reader knows they were deliberate:

- **FR-021** originally said the long press must be "opt-in via a prop on the
  staff component". That is how, not what. It now states the outcome — the long
  press exists only where a column can already be tapped, and is absent from
  every read-only staff — which is what a test can check.
- **FR-030** originally forbade a specific styling mechanism (opacity over a
  surface token). The requirement is now the outcome it protects: the shades
  stay distinct in both themes and the distinction does not rest on hue alone.
  The forbidden mechanism is recorded in Assumptions, where it belongs as
  context for implementers rather than as the requirement itself.
- **SC-007 / SC-008** originally described extensibility as "a one-item addition
  to a list". Extensibility is genuinely this entry's deliverable — three later
  roadmap entries hang their controls on these two extension points — so the
  criteria are kept, restated as something observable: the strip reads correctly
  with five latches, and the sheet with one more property, at the smallest
  supported phone width.

Two deliberate retentions, both flagged rather than removed:

- The **Assumptions** section names a dev-environment command (`npm run dev:clean`)
  and a styling anti-pattern. Both are standing repo conventions from
  `docs/DECISIONS.md` that have each already cost hours, and the roadmap entry
  asked for them to be carried forward. They are context for planning, not
  requirements.
- **FR-029** names the verification method (a browser, at actual size, both
  themes, phone viewport). That is the repo's existing definition of done for
  any visual change, so it is a constraint on this work rather than a leaked
  implementation detail.

Zero `[NEEDS CLARIFICATION]` markers were raised. Where the roadmap entry left
room, the spec takes a documented decision in **Assumptions** instead — the three
that would otherwise have been questions are: what fills the space freed on a
barline (nothing, this entry adds no controls), whether the toolbar may reflow
under the thumb (no, the always-applicable controls hold fixed positions), and
whether the inspector replaces or duplicates the toolbar controls (duplicates).
