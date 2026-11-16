# Specification Quality Checklist: Full-width reading layout, a whole song on one screen

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

- Iteration 1 failed two items, both fixed in place:
  - "Requirements are testable and unambiguous" / "Feature meets measurable outcomes": the first FR-006 made a card whose staff did not fit on one line take a whole row. For the fit song that could leave its 4-bar cards one per row at 1024 and 1280, which made SC-001 unreachable and contradicted SC-003 at 768. FR-006 now fixes the rules of packing (order, floor, no row ending with floor-sized room while cards remain, aligned right edges, no card wider than its row) and leaves the packing itself to the plan, measured against SC-001 and SC-002. US1 scenario 4, the edge cases, SC-003 and Decision 5 were updated to match.
  - Decision 2 said 768 was the narrowest width that fits two floor cards. Two fit at about 734, so the reason now given is that every phone held upright is below 768.
- Named files and tests (`click-double-tap.spec.ts`, `docs/DECISIONS.md`, `lastRepeatPartId`, CSS pixel widths) appear on purpose. The brief names them as constraints, and the project's specs (007, 008, 009) cite them the same way. They describe what must keep working, not how to build it. Success criteria are stated as what a reader sees (no scroll, order, nothing moves under a tap).
- No [NEEDS CLARIFICATION] markers. Every open call in the brief (row-major or column-major, draw repeated passes once or each time, bar numbers on a drawn-once card, the width threshold, how the click bar fix keeps INV-024) is decided in "Decisions made for this spec", each cheap to overturn, per the standing instruction to decide and log.
- The fit figures depend on cell widths only the plan can measure. SC-001 and SC-002 are firm targets. If research finds the fit song does not fit under FR-004 to FR-007 at today's sizes, the Assumptions allow tightening the spacing between cards, recorded with the figures.
