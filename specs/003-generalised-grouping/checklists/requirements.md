# Specification Quality Checklist: Group any run of columns, as a counted tuplet or as plain phrasing

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-04
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

- Validated in two passes. The first pass found an edge-case heading that contradicted its own example (two columns across a bar are two playable columns), three requirements phrased as "No ... MUST", a success criterion weaker than the rule it proves (SC-006), and a claim in User Story 1 that it needed no new stored data, which FR-002 contradicts. All are fixed.
- Claims about today's behaviour were run, not read: a throwaway script drove the real `layoutPart`, `tupletSpans`, `toAscii` and wire schema. It confirmed `,4,   ,4,` and `3   ,3,` across a barline, one span with a stable number around a `repeat: 8` column in both densities, and a count of 17 failing validation. The push route rejects a batch on any invalid row.
- The notation table was checked against `tupletRow`'s own width and centring arithmetic. The plain form cannot be run until it exists.
- Deliberately concrete, and judged not to fail "no implementation details": the `groupKind` name and the stored states table (the brief requires the field be named and the spec to say so), the notation table (user-visible output and the contract `ascii-import` parses), `tripletFromTail` (the brief names it to be kept), and the two named tests in FR-036 and FR-037 (changing them is a decision the plan must not reverse). Success criteria stay free of these.
- The stored states table is the one part of the spec aimed at developers rather than stakeholders. The Summary's comparison table above it carries the same meaning in plain terms.
- No [NEEDS CLARIFICATION] markers: this phase runs headless, and each open choice had a defensible default. The five choices most worth a second look lead the Assumptions section.
- File and line references live in the roadmap entry, which the spec's Input line points to. Note that those line numbers have drifted since `playing-techniques` landed: `groupAsTuplet` is near `editing.ts:555`, not 482.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`.
