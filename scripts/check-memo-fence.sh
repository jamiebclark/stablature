#!/usr/bin/env bash
# INV-022: the memo limits, formats and refusal words have one source each.
#   - the six limit literals appear in src/ only in src/lib/memos/limits.ts
#   - audio/webm, audio/ogg and audio/mp4 appear only in src/lib/memos/formats.ts and tests
#   - `bytes = null` / `bytes: null` appears exactly once, in src/lib/server/memos.ts (eraseMemoAudio)
set -u
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "${MEMOS_ROOT:-$root}"
status=0

# Tests and fixtures may name any of these; product code may not.
product() { grep -rnE "$1" src --include='*.ts' --include='*.tsx' 2>/dev/null | grep -vE '/__tests__/|\.test\.tsx?:' || true; }

limits="$(product '180000|180_000|8388608|8 \* 1024 \* 1024|524288000|500 \* 1024 \* 1024' | grep -v '^src/lib/memos/limits.ts:' || true)"
if [ -n "$limits" ]; then printf 'LIMIT LITERAL outside src/lib/memos/limits.ts\n%s\n' "$limits"; status=1; else echo "limits: one source"; fi

formats="$(product 'audio/(webm|ogg|mp4)' | grep -v '^src/lib/memos/formats.ts:' || true)"
if [ -n "$formats" ]; then printf 'AUDIO TYPE outside src/lib/memos/formats.ts\n%s\n' "$formats"; status=1; else echo "formats: one source"; fi

erase="$(product 'bytes( = |: )null')"
count="$(printf '%s' "$erase" | grep -c . || true)"
if [ "$count" -ne 1 ] || ! printf '%s' "$erase" | grep -q '^src/lib/server/memos.ts:'; then
  printf 'ERASE statement must appear exactly once, in src/lib/server/memos.ts; found %s\n%s\n' "$count" "$erase"; status=1
else echo "erase: exactly one, in src/lib/server/memos.ts"; fi
exit $status
