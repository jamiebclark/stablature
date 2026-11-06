#!/usr/bin/env bash
# INV-015: the usability pass touches no storage, wire, layout, export or audio path. Named paths must have no
# diff against main, tracked or untracked. parse.ts may change only inside REASONS, RefusalCode, joinedByQuality,
# looksJoined, readsAsProse and failed (contracts/reader.md). notation.ts may not name clickStream.
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"
status=0
paths=(
  src/db drizzle src/lib/server src/lib/sync src/app/api src/lib/model.ts src/lib/local
  src/lib/tab/layout.ts src/lib/tab/ascii.ts src/lib/tab/reading.ts src/lib/tab/techniques.ts
  src/lib/export src/lib/rhythm/audio.ts src/lib/rhythm/stream.ts src/lib/rhythm/tempo.ts
  src/lib/rhythm/durations.ts public/sw.js src/lib/tab/__tests__
)
for p in "${paths[@]}"; do
  changed="$(git diff main --stat -- "$p"; git ls-files --others --exclude-standard -- "$p")"
  if [ -n "$changed" ]; then printf 'CHANGED %s\n%s\n' "$p" "$changed"; status=1; else printf 'zero diff  %s\n' "$p"; fi
done

# parse.ts: every changed line (old side by the old file's enclosing top-level declaration, new side by the new
# file's) must sit in an allowed declaration. Uses grep -U0 hunks, not git's function-name guess.
bad="$(node - <<'JS'
const { execSync } = require("node:child_process");
const allowed = new Set(["REASONS", "RefusalCode", "joinedByQuality", "looksJoined", "readsAsProse", "failed"]);
const file = "src/lib/tab/parse.ts";
const sh = (c) => { try { return execSync(c, { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] }); } catch { return ""; } };
const oldSrc = sh(`git show main:${file}`).split(/\r?\n/);
const newSrc = require("node:fs").readFileSync(file, "utf8").split(/\r?\n/);
const decl = /^(?:export\s+)?(?:async\s+)?(?:const|let|function|type|interface|class)\s+([A-Za-z_$][\w$]*)/;
const comment = /^\s*(\/\*|\*|\/\/)/;
const owner = (lines, n) => {
  // a comment block belongs to the declaration it precedes
  if (comment.test(lines[n - 1] ?? "")) { let j = n - 1; while (j < lines.length && (comment.test(lines[j]) || lines[j].trim() === "")) j++; const m = decl.exec(lines[j] ?? ""); if (m) return m[1]; } // n is 1-based; a pure insertion after line n belongs to the declaration holding n
  for (let i = Math.min(n, lines.length) - 1; i >= 0; i--) { const m = decl.exec(lines[i]); if (m) return m[1]; }
  return "(top of file)";
};
const diff = sh(`git diff main -U0 -- ${file}`);
const out = [];
for (const h of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)) {
  const [oa, ob = "1", na, nb = "1"] = h.slice(1);
  const spans = [];
  if (+ob > 0) for (let i = 0; i < +ob; i++) spans.push(["old", +oa + i]);
  else spans.push(["old", +oa]);
  if (+nb > 0) for (let i = 0; i < +nb; i++) spans.push(["new", +na + i]);
  const seen = new Set();
  for (const [side, n] of spans) {
    // a pure insertion (old count 0) is judged by the new side only
    if (side === "old" && +ob === 0) continue;
    const who = owner(side === "old" ? oldSrc : newSrc, n);
    if (!allowed.has(who) && !seen.has(who + side)) { seen.add(who + side); out.push(`${side} line ${n} in ${who}`); }
  }
}
console.log(out.join("\n"));
JS
)"
if [ -n "$bad" ]; then printf 'CHANGED %s outside the allowed declarations\n%s\n' src/lib/tab/parse.ts "$bad"; status=1; else printf 'zero diff  parse.ts outside the allowed declarations\n'; fi

# notation.ts must not name clickStream in its diff
named="$(git diff main -U0 -- src/lib/rhythm/notation.ts | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -U 'clickStream' || true)"
if [ -n "$named" ]; then printf 'CHANGED notation.ts names clickStream\n%s\n' "$named"; status=1; else printf 'zero diff  notation.ts names no clickStream\n'; fi
exit $status
