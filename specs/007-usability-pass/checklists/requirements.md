# Specification Quality Checklist: Usability pass across every screen, phone first

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-05
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

- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
- Validated in one pass after correcting the spec against `audit/before.txt`. That pass fixed FR-053 against FR-057 (a reading position set by key while stopped) and four figures.
- Implementation names appear on purpose in three places, as in specs 004 to 006: the brief-against-code table, Dependencies, and FR-063, which fences `parse.ts` because the brief does. FR-032 names the typeface because the product decision is about that face. No requirement prescribes how to build anything.
- Measured figures come from a production build under emulation. What emulation cannot prove is listed under "Owed to a real phone" and goes to `tasks.md` as human items.
- The template warns against bundling features in one spec. This entry bundles several on purpose, because the roadmap defines it as one pass. The spec logs that as a decision, and names FR-047 to FR-061 as the natural cut.
