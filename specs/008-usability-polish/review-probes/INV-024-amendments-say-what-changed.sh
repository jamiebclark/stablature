#!/usr/bin/env bash
# Review probe, spec 008 INV-024: an amended requirement must stop saying something untrue, not merely carry the
# "Amended by spec 008" marker (which is all check:polish-amendments looks for). For each member FR-035 names, the
# amended line must state the change FR-035 asks for.
#   spec 007 FR-026: "the duration may give way after the tones" (FR-031)
#   spec 007 FR-001: the signed-out short form
#   spec 007 FR-056 and the Out of Scope "Wrapping … capture" line: capture wraps
# Run from the repo root: bash specs/008-usability-polish/review-probes/INV-024-amendments-say-what-changed.sh
set -u
s7=specs/007-usability-pass/spec.md
status=0
line() { grep -E "$1" "$s7"; }
need() { # label, line regex, pattern the amendment must contain (case-insensitive)
  local l; l="$(line "$2")"
  if ! printf '%s' "$l" | grep -q "Amended by spec 008"; then echo "FAIL $1: no amendment"; status=1; return; fi
  if printf '%s' "${l#*Amended by spec 008}" | grep -qiE "$3"; then echo "ok   $1"; else echo "FAIL $1: the amendment does not say /$3/"; status=1; fi
}
need "007 FR-026 (duration gives way after the tones)" '^- \*\*FR-026\*\*' 'duration'
need "007 FR-001 (signed-out short form)" '^- \*\*FR-001\*\*' 'sav(ed|ing)|sign in|signed.out'
need "007 FR-056 (capture wraps)" '^- \*\*FR-056\*\*' 'capture wraps'
need "007 Out of Scope (capture wraps)" 'Wrapping .*capture' 'capture now wraps|capture wraps'
exit $status
