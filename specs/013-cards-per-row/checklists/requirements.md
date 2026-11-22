# Specification Quality Checklist: Cards per row follow what the cards hold

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-21
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

- Validated in one pass on 2026-11-21.
- Named hooks and files (`tab-ruler`, `.card-passes`, `e2e/wide-narrow-unchanged.spec.ts`, the two narrow fixtures, the Linux replica script) are the brief's own terms. They are kept as references to the things that must not regress, as specs 007 to 012 do. The spec does not choose a mechanism: the sizing route is left to the plan (Decision 5).
- There are no clarification markers. Choices the brief left open were made and recorded under "Decisions made for this spec", per the run's decide-and-log rule:
  - greedy placement;
  - one line wherever it fits;
  - an unstretched last row;
  - a smaller card minimum, with 343px kept for memo cards;
  - the pass-words fix at every width.
- These deliberately supersede spec 010: its FR-005 343px floor for all cards, its FR-006 aligned right edges on the last row, and its SC-003 two-per-row at 768 for the fit song. They are listed in "Where the brief and the code differ", and the re-pins they force are governed by FR-022.
- Feasibility risk for planning: SC-002 needs the `short` song to fit at 1280×800 on the song page as well as in the play view. The plan should measure the song page's card height early.
