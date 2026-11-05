# Specification Quality Checklist: Note names, intervals, and seeing what a variant changed

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
- Validated in one pass after a revision. SC-005 failed first: it said no cell may equal a chord symbol, which a plain `A` always does, and `parseChord` also reads degrees such as `b7` as B-rooted chords. It now covers cells carrying a letter decoration, which is where the ambiguity is. FR-017 was tightened to stop it adding a row that FR-015 forbids.
- **Named domain terms.** `variantOfPartId`, `createVariant` and file paths appear only in "Where the brief and the code differ", which reconciles the brief with the code, as in specs/005. Requirements speak of parts, columns and chords. FR-008 names the glyphs because the staff's font limits them, and that is a constraint on what the reader sees.
- **One feature per spec.** The template warns against bundling, and this entry holds two features. It stays one spec because the roadmap entry is one unit and the runner works one spec per entry. Stories 1-2 and 3-4 are independent. The cost to expect is more review surface per round. See decision 11 in the spec.
- **No clarifications raised.** Per the standing instruction to decide and log, every open call was made and listed under "Decisions made for this spec", for Jamie to overturn. Those decisions are not yet in the `verify-log` copy of `docs/DECISIONS.md`.
- **Browser items.** The six under "Owed to a browser pass" cannot be proved by the pipeline, whose implement and review phases have no browser. They must stay open, not be ticked to pass a gate.
- **Constitution.** `.specify/memory/constitution.md` is the unfilled template, so there were no principles to check against.
