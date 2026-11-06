#!/usr/bin/env bash
# INV-046: the audit goes nowhere unanswered. Each A1..A33 has a row in audit/outcomes.md whose outcome is
# fixed, accepted (with a reason) or logged (with a reason), and audit/after.txt exists.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
dir=specs/007-usability-pass/audit
status=0
[ -s "$dir/after.txt" ] || { echo "MISSING $dir/after.txt"; status=1; }
[ -f "$dir/outcomes.md" ] || { echo "MISSING $dir/outcomes.md"; exit 1; }
for i in $(seq 1 33); do
  row="$(grep -E "^\| A$i \|" "$dir/outcomes.md" | head -1)"
  outcome="$(printf '%s' "$row" | cut -d'|' -f3 | tr -d ' ' | tr 'A-Z' 'a-z')"
  case "$outcome" in
    fixed) ;;
    accepted|logged)
      reason="$(printf '%s' "$row" | cut -d'|' -f4 | tr -d ' ')"
      [ -n "$reason" ] || { echo "A$i: $outcome needs a reason"; status=1; } ;;
    *) echo "A$i: no outcome"; status=1 ;;
  esac
done
[ $status -eq 0 ] && echo "usability audit: ok"
exit $status
