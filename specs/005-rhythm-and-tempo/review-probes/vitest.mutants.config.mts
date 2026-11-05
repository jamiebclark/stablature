/**
 * Can the feature's own suite fail? This runs its tests against a source broken in one way, chosen by
 * MUTANT. The break is an in-memory transform: nothing on disk changes. A mutant the suite does not
 * kill is a class of defect it cannot see, and a ticked task claiming that class overstates it.
 *
 *   MUTANT=no-fraction npx vitest run --config specs/005-rhythm-and-tempo/review-probes/vitest.mutants.config.mts
 *
 * MUTANT_AGAINST=probes runs this directory's unit probes instead of the suite. `run-mutants.sh` runs
 * every mutant against both and prints the table.
 */
import os from "node:os";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.resolve(import.meta.dirname, "../../..");

const NOTATION = "src/lib/rhythm/notation.ts";
const STREAM = "src/lib/rhythm/stream.ts";
const TAP = "src/lib/rhythm/tap.ts";
const TEMPO = "src/lib/rhythm/tempo.ts";
const DURATIONS = "src/lib/rhythm/durations.ts";
const SCHEDULER = "src/lib/rhythm/scheduler.ts";
const PASSES = "src/lib/arrangement/passes.ts";
const EDITING = "src/lib/local/editing.ts";
const CLIPBOARD = "src/lib/local/clipboard.ts";

/** [file ending, from, to]. A `from` that no longer appears throws, so a stale mutant is loud. */
const MUTANTS: Record<string, [string, string, string]> = {
  // A control: an honest suite must kill this, so a survivor below means something.
  "control-quarter": [DURATIONS, 'ticks: 360360 }', 'ticks: 360361 }'],

  // INV-033, INV-034, INV-035.
  "no-fraction": [NOTATION, "hitTicks = (duration.ticks * group.counted.fit) / group.counted.n;", "hitTicks = duration.ticks;"],
  "no-repeat-gate": [NOTATION, "n === columns && !repeated && fit !== null", "n === columns && fit !== null"],
  "no-size-gate": [NOTATION, "n === columns && !repeated && fit !== null", "!repeated && fit !== null"],
  "fit-rounds-up": [NOTATION, "2 ** Math.floor(Math.log2(n))", "2 ** Math.ceil(Math.log2(n))"],
  "seventeen-reads": [NOTATION, "n > 16", "n > 17"],
  "mixed-numbers-read": [NOTATION, "if (numbers.size !== 1) {", "if (false) {"],
  "plain-once-per-song": [NOTATION, "const startedPlain = new Set<string>();", "const startedPlain = ((globalThis as Record<string, unknown>).__sp ??= new Set<string>()) as Set<string>;"],
  "plain-soft-every-hit": [NOTATION, "(firstOfPlain && h === 0)", "firstOfPlain"],
  "first-level-wins": [NOTATION, "if (!had || RANK[level] > RANK[had]) levels.set(tick, level);", "if (!had) levels.set(tick, level);"],
  "repeat-counts-once": [NOTATION, "const hits = Math.max(1, e.repeat);", "const hits = 1;"],
  "empty-bar-ends-score": [NOTATION, "if (bar.length === 0) continue;", "if (bar.length === 0) return { clicks, lengthTicks: offset, timedFromStart: timed };"],
  "bar-rounds-to-beat": [NOTATION, "offset += read.length;", "offset += Math.ceil(read.length / TICKS_PER_BEAT) * TICKS_PER_BEAT;"],
  "length-lost-at-gap": [NOTATION, "if (!read) return { clicks, lengthTicks: offset, timedFromStart: timed };", "if (!read) return { clicks, lengthTicks: 0, timedFromStart: timed };"],
  "census-whole-bar-only": [NOTATION, "const groups = census(pass.events);", "const groups = census(pass.events.slice(0, pass.events.findIndex((e) => e.kind === \"barline\") + 1 || undefined));"],
  "ranges-ignored": [PASSES, "step.fromBar, step.toBar", "null, null"],

  // INV-036, the stream.
  "plain-ignores-length": [STREAM, "from = offset + score.lengthTicks;", "from = offset;"],
  "count-in-of-three": [STREAM, "COUNT_IN_CLICKS = 4", "COUNT_IN_CLICKS = 3"],
  "follow-off-ignored": [STREAM, "if (follow && score.clicks.length > 0)", "if (score.clicks.length > 0)"],

  // INV-013.
  "gap-boundary": [TAP, "gap > RESTART_GAP_MS", "gap >= RESTART_GAP_MS"],
  "half-boundary": [TAP, "gap < mean / 2", "gap <= mean / 2"],
  "double-boundary": [TAP, "gap > mean * 2", "gap >= mean * 2"],
  "ten-taps": [TAP, "MAX_TAPS = 9", "MAX_TAPS = 10"],
  "equal-tap-counts": [TAP, "time <= last", "time < last"],
  "reading-floors": [TAP, "Math.round(60000 / meanInterval(run.taps))", "Math.floor(60000 / meanInterval(run.taps))"],
  "too-slow-any-run": [TAP, "tooSlow: taps.length === 1", "tooSlow: taps.length >= 1"],
  "tap-floor-is-stored": [TAP, "bpm >= TAP_TEMPO_MIN", "bpm >= 1"],

  // INV-018.
  "stored-top-is-400": [TEMPO, "bpm <= STORED_TEMPO_MAX", "bpm <= TAP_TEMPO_MAX"],
  "half-tempo-usable": [TEMPO, "!Number.isInteger(bpm)", "false"],

  // INV-005, INV-007.
  "unknown-reads-quarter": [DURATIONS, "DURATIONS.find((d) => d.id === value) ?? null", "DURATIONS.find((d) => d.id === value) ?? DURATIONS[2]"],
  "tap-never-clears": [DURATIONS, "readDuration(stored)?.id === tapped ? null : tapped", "tapped"],

  // INV-021 to INV-026, the engine.
  "behind-unnoticed": [SCHEDULER, "if (time < now) {", "if (false) {"],
  "dry-queue-silent": [SCHEDULER, "if (step.done) {", "if (step.done) { timer = setTimer(topUp, TOP_UP_MS); return; }\n        if (false) {"],
  "tempo-no-floor": [SCHEDULER, "time: Math.max(nextTime, clock.now() + START_LEAD_S)", "time: nextTime"],
  "tempo-old-gap": [SCHEDULER, "(60 / next);", "(60 / bpm);"],
  "time-rounds-to-ms": [SCHEDULER, "const time = timeOf(pending.tick);", "const time = Math.round(timeOf(pending.tick) * 1000) / 1000;"],
  "second-start-restarts": [SCHEDULER, 'if (state !== "idle") return;', ""],
  "stop-keeps-timers": [SCHEDULER, "    clearTimers();", ""],
  "stop-keeps-queue": [SCHEDULER, "    last = null;\n    queue = [];\n    closing?.close();", "    last = null;\n    closing?.close();"],
  "stop-leaves-clock": [SCHEDULER, "closing?.close();", ""],
  "stale-ready-begins": [SCHEDULER, 'if (token !== generation || state !== "starting") return;', 'if (state !== "starting") return;'],
  "no-start-timeout": [SCHEDULER, "startTimer = setTimer(() => settle(false), AUDIO_START_TIMEOUT_MS);", ""],
  "stale-loss-stops": [SCHEDULER, 'if (token === generation) stop("audio-lost");', 'stop("audio-lost");'],
  "silent-not-swapped": [SCHEDULER, "clock = makeSilent();", ""],

  // Round 2. INV-003, INV-004, INV-015: the writes. T070 overwrote the tests that held these.
  "paste-drops-duration": [CLIPBOARD, "durationHint: column.durationHint,", "durationHint: null,"],
  "copy-drops-duration": [CLIPBOARD, "durationHint: event.durationHint,", "durationHint: null,"],
  "variant-drops-duration": [EDITING, "durationHint: event.durationHint,", "durationHint: null,"],
  "insert-inherits-duration": [EDITING, "repeat: Math.max(1, options.repeat ?? 1),\n      durationHint: null,\n      ...NO_GROUP,\n    },\n    ctx,\n  );\n}\n\n/**", "repeat: Math.max(1, options.repeat ?? 1),\n      durationHint: before?.durationHint ?? null,\n      ...NO_GROUP,\n    },\n    ctx,\n  );\n}\n\n/**"],
  "append-inherits-duration": [EDITING, "kind: \"notes\",\n      frets,\n      techniques: {},\n      repeat: Math.max(1, options.repeat ?? 1),\n      durationHint: null,", "kind: \"notes\",\n      frets,\n      techniques: {},\n      repeat: Math.max(1, options.repeat ?? 1),\n      durationHint: existing.at(-1)?.durationHint ?? null,"],
  "barline-inherits-duration": [EDITING, "kind: \"barline\",\n      frets: {},\n      techniques: {},\n      repeat: 1,\n      durationHint: null,", "kind: \"barline\",\n      frets: {},\n      techniques: {},\n      repeat: 1,\n      durationHint: existing.at(-1)?.durationHint ?? null,"],
  "stack-clears-duration": [EDITING, "frets: { ...row.frets, [key]: fret },", "frets: { ...row.frets, [key]: fret },\n        durationHint: null,"],
  "unstack-clears-duration": [EDITING, "hadTechniques ? { frets, techniques } : { frets }", "hadTechniques ? { frets, techniques, durationHint: null } : { frets, durationHint: null }"],
  "duration-writes-repeat": [EDITING, "{ durationHint: duration }", "{ durationHint: duration, repeat: 1 }"],
  "tempo-rewrites-same-value": [EDITING, "if (song && song.bpm === bpm) return false;", ""],
  "tempo-reports-no-write": [EDITING, "await patchRow(\"songs\", songId, { bpm }, ctx);\n  return true;", "await patchRow(\"songs\", songId, { bpm }, ctx);\n  return false;"],
};

const mutant = process.env.MUTANT ?? "";
const against = process.env.MUTANT_AGAINST ?? "suite";

if (process.env.MUTANT_LIST) {
  console.log(Object.keys(MUTANTS).join("\n"));
  process.exit(0);
}

export default defineConfig({
  // One cache per mutant: a shared cache serves the last mutant to every run.
  cacheDir: path.join(os.tmpdir(), "spec005-mutants", `${against}-${mutant || "none"}`),
  plugins: [
    react(),
    {
      name: "mutate-rhythm",
      enforce: "pre",
      transform(code, id) {
        if (!mutant) return null;
        const [file, from, to] = MUTANTS[mutant];
        if (!id.replace(/\\/g, "/").endsWith(file)) return null;
        const source = code.replace(/\r\n/g, "\n");
        if (!source.includes(from)) throw new Error(`mutant ${mutant} no longer applies`);
        return source.replace(from, to);
      },
    },
  ],
  root,
  test: {
    globals: true,
    environment: "node",
    include:
      against === "all"
        ? ["src/**/*.test.{ts,tsx}"]
        : against === "probes"
        ? ["specs/005-rhythm-and-tempo/review-probes/**/*.test.{ts,tsx}"]
        : [
            "src/lib/rhythm/**/*.test.{ts,tsx}",
            "src/lib/arrangement/__tests__/passes.test.ts",
            "src/lib/local/__tests__/rhythm-writes.test.ts",
            "src/components/rhythm/**/*.test.{ts,tsx}",
            "src/components/capture/__tests__/duration-row.test.tsx",
            "src/components/tab/__tests__/tab-staff-rhythm.test.tsx",
          ],
    setupFiles: ["fake-indexeddb/auto", path.join(root, "vitest.setup.ts")],
    testTimeout: 300_000,
    // Not in the type yet, and needed: a shared module cache served one mutant to all of them.
    experimental: { fsModuleCache: false } as object,
  },
  resolve: {
    alias: { "@": path.join(root, "src") },
  },
});
