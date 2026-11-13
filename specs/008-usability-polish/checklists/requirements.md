# Specification Quality Checklist: Usability polish: capture height, part card overflow, honest labels

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-12
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs). See note 1.
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders. See note 1.
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
- [x] No implementation details leak into specification. See note 1.

## Notes

1. **Named code and tests, kept on purpose.** The brief itself names the capture behaviours that must survive wrapping: `followTail`, `keepCaretInView`, `revealGroups` and the `--status-row` height. It also names the e2e tests that must be updated rather than deleted. Requirements and Dependencies quote those names so that each one can be checked against the code. This matches specs 001 to 007, which pin earlier requirements and tests by name. No framework, library or code structure is prescribed. The overflow menu, the wrapping mechanism and the signed-out check are left to the plan. The Success Criteria name no technology.
2. **Ambiguities resolved without markers.** These are recorded under "Decisions made for this spec" so they can be overturned at review, as the standing instruction asks:
   - the cursor's line against later bars;
   - one line against one wrapped line;
   - whether a tap moves the band;
   - the label as the route into editing;
   - no confirm on Delete;
   - song counts on the band list;
   - "not known" sign-in state.
3. **The bundling warning.** The template warns against bundling stories. This spec stays one entry because the roadmap defines it as one, and the reason is recorded in its Decisions.
4. Validation passed on the first iteration.
