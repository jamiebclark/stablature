/**
 * What pasted text means for this song.
 *
 * `parseTab` says what the text holds; this says whether it can go onto the
 * song's strings, and what has to be said to the person first. Pure and total,
 * and the preview and the write both call it, so what the button promises is
 * what the write checks (contracts/writes.md).
 */

import type { Clipboard } from "../local/clipboard";
import { draftPart } from "../local/clipboard";
import { noteToMidi } from "../pitch";
import type { EventRow, TuningRow } from "../model";
import { TUNING_PRESETS, type Tuning } from "../tunings";
import { countBars, type Density } from "./layout";
import { parseTab, pitchClass, type LineNote, type ParsedRow, type Refusal } from "./parse";

export interface ReadingContext {
  /** The song's resolved tuning, or null when it has none. */
  tuning: Tuning | null;
  /** The band's live tunings, in `listTunings` order. */
  bandTunings: readonly TuningRow[];
  /** Every live column of every live part of the song. */
  songEvents: readonly EventRow[];
  /** Whether another live song of the band sits on no tuning of its own (`othersOnNull`). */
  othersOnNull?: boolean;
}

/**
 * Whether a song other than this one follows whatever tuning the band plays in: its `tuningId` is
 * null, or names no live tuning of the band, which `resolveTuning` treats the same way.
 */
export function othersOnNull(
  song: { id: string },
  bandSongs: readonly { id: string; tuningId: string | null }[],
  bandTunings: readonly { id: string }[],
) {
  const live = new Set(bandTunings.map((t) => t.id));
  return bandSongs.some(
    (other) => other.id !== song.id && (other.tuningId === null || !live.has(other.tuningId)),
  );
}

export type Fit =
  | { kind: "fits"; tuning: Tuning; leftOut: string[] }
  | {
      kind: "offer";
      tuning: Tuning;
      name: string;
      source: { tuningId: string } | { presetId: string };
    };

export interface ReadingNote {
  kind:
    | "spaces-read"
    | "unlabelled"
    | "row-left-out"
    | "row-name-differs"
    | "chord-moved"
    | "chord-clipped";
  text: string;
  line?: number;
}

export type TabReading =
  | { kind: "idle" }
  | { kind: "refused"; refusals: Refusal[] }
  | {
      kind: "ready";
      clipboard: Clipboard;
      density: Density;
      fit: Fit;
      tuning: Tuning;
      fitKey: string;
      ignored: LineNote[];
      notes: ReadingNote[];
      columns: number;
      bars: number;
    };

const REASONS = {
  "rows-lowest-first": "The rows run lowest string first. Put the highest string on top.",
  "tuning-unknown": "No tuning matches the labels on these rows.",
  "tuning-notes-change":
    "Switching tunings would change notes already in this song. Import into a new song instead.",
  "unlabelled-count": "The number of rows does not match the song's strings.",
  "unlabelled-no-tuning": "This song has no tuning yet, so the rows need labels.",
} as const;

function refuse(
  code: keyof typeof REASONS,
  line: number | null,
  text: string,
  detail: string,
): TabReading {
  return {
    kind: "refused",
    refusals: [{ line, text, code, reason: `${REASONS[code]} ${detail}`.trim() }],
  };
}

const names = (tuning: Tuning) => tuning.strings.map((s) => s.note).join(" ");

/** Pitch class of a label, ignoring any octave. */
const classOf = (label: string | null) => (label === null ? null : pitchClass(label));

type Matched =
  | { ok: true; notes: ReadingNote[] }
  | { ok: false; firstBad: ParsedRow };

/** Row by row, against one tuning, by the fit table in writes.md. */
function matches(rows: readonly ParsedRow[], tuning: Tuning): Matched {
  const notes: ReadingNote[] = [];
  for (const [index, row] of rows.entries()) {
    const string = tuning.strings[index];
    const same = string !== undefined && classOf(row.label) === pitchClass(string.note);
    if (row.filled) {
      if (!same) return { ok: false, firstBad: row };
    } else if (!same && string === undefined) {
      notes.push({ kind: "row-left-out", text: `The empty ${row.label} row was left out`, line: row.line });
    } else if (!same) {
      notes.push({
        kind: "row-name-differs",
        text: `Row ${index + 1} is labelled ${row.label} and the song's string is ${string.note}. Nothing is on it`,
        line: row.line,
      });
    }
  }
  return { ok: true, notes };
}

function sameNames(rows: readonly ParsedRow[], tuning: Tuning): boolean {
  return (
    rows.length === tuning.strings.length &&
    rows.every((row, i) => classOf(row.label) === pitchClass(tuning.strings[i].note))
  );
}

interface Candidate {
  tuning: Tuning;
  name: string;
  source: { tuningId: string } | { presetId: string };
}

function candidateFor(rows: readonly ParsedRow[], context: ReadingContext): Candidate | null {
  for (const row of context.bandTunings) {
    if (sameNames(rows, row)) return { tuning: row, name: row.name, source: { tuningId: row.id } };
  }
  for (const preset of TUNING_PRESETS) {
    if (sameNames(rows, preset)) {
      return { tuning: preset, name: preset.name, source: { presetId: preset.id } };
    }
  }
  return null;
}

/** Every existing note must keep its pitch on the candidate. */
function keepsNotes(candidate: Tuning, context: ReadingContext): boolean {
  const used = new Set<number>();
  for (const event of context.songEvents) {
    for (const key of Object.keys(event.frets)) used.add(Number(key));
  }
  if (used.size === 0) return true;
  if (context.tuning === null) return false;
  for (const index of used) {
    const wanted = context.tuning.strings[index];
    const got = candidate.strings[index];
    if (!wanted || !got || noteToMidi(wanted) !== noteToMidi(got)) return false;
  }
  return true;
}

export function readTab(text: string, context: ReadingContext): TabReading {
  if (text.trim() === "") return { kind: "idle" };
  const parsed = parseTab(text);
  if (!parsed.ok) return { kind: "refused", refusals: parsed.refusals };

  const { rows } = parsed;
  const notes: ReadingNote[] = [];
  let fit: Fit;

  if (rows.every((row) => row.label === null)) {
    const tuning = context.tuning;
    if (tuning === null) {
      return refuse("unlabelled-no-tuning", rows[0].line, rows[0].text, "");
    }
    if (rows.length !== tuning.strings.length) {
      return refuse(
        "unlabelled-count",
        rows[0].line,
        rows[0].text,
        `${rows.length} rows, ${tuning.strings.length} strings.`,
      );
    }
    notes.push({
      kind: "unlabelled",
      text: `Rows had no labels, so they were read top down as ${names(tuning)}`,
    });
    fit = { kind: "fits", tuning, leftOut: [] };
  } else {
    const fitted = context.tuning ? matches(rows, context.tuning) : null;
    if (fitted && fitted.ok && context.tuning) {
      notes.push(...fitted.notes);
      fit = {
        kind: "fits",
        tuning: context.tuning,
        leftOut: fitted.notes.filter((n) => n.kind === "row-left-out").map((n) => n.text),
      };
    } else {
      const bad = fitted && !fitted.ok ? fitted.firstBad : rows.find((row) => row.filled)!;
      const candidate = candidateFor(rows, context);
      if (!candidate) {
        const flipped = [...rows].reverse();
        const lowestFirst =
          (context.tuning && matches(flipped, context.tuning).ok) ||
          candidateFor(flipped, context) !== null;
        const labels = rows.map((r) => r.label).join(" ");
        const song = context.tuning ? names(context.tuning) : "none";
        return refuse(
          lowestFirst ? "rows-lowest-first" : "tuning-unknown",
          bad.line,
          bad.text,
          lowestFirst ? "" : `The rows are ${labels}; the song is ${song}. Row ${bad.label} does not match.`,
        );
      }
      if (!keepsNotes(candidate.tuning, context)) {
        const song = context.tuning ? names(context.tuning) : "none";
        return refuse(
          "tuning-notes-change",
          bad.line,
          bad.text,
          `${song} to ${names(candidate.tuning)}, at row ${bad.label}.`,
        );
      }
      // A preset the band gains can become what a band without a default resolves to, for every
      // song sitting on null. Only this song may move.
      if (
        "presetId" in candidate.source &&
        context.othersOnNull &&
        !context.bandTunings.some((t) => t.isDefault)
      ) {
        const song = context.tuning ? names(context.tuning) : "none";
        return refuse(
          "tuning-notes-change",
          bad.line,
          bad.text,
          `${song} to ${names(candidate.tuning)}: other songs in this band follow the band's tuning and would change with it.`,
        );
      }
      fit = { kind: "offer", tuning: candidate.tuning, name: candidate.name, source: candidate.source };
    }
  }

  if (parsed.spaces > 0) {
    notes.push({ kind: "spaces-read", text: `${parsed.spaces} spaces read from the rails` });
  }
  for (const moved of parsed.moved) {
    notes.push({
      kind: "chord-moved",
      text: `${moved.text} on line ${moved.line} moved to the nearest column`,
      line: moved.line,
    });
  }
  for (const clipped of parsed.clipped) {
    notes.push({
      kind: "chord-clipped",
      text: `The chord at the end of the staff may have been cut short (${clipped.text})`,
      line: clipped.line,
    });
  }

  const fitKey =
    fit.kind === "fits"
      ? "fits"
      : "tuningId" in fit.source
        ? `tuning:${fit.source.tuningId}`
        : `preset:${fit.source.presetId}`;

  return {
    kind: "ready",
    clipboard: parsed.clipboard,
    density: parsed.density,
    fit,
    tuning: fit.tuning,
    fitKey,
    ignored: parsed.ignored,
    notes,
    columns: parsed.clipboard.columns.filter((c) => c.kind !== "barline").length,
    bars: countBars(draftPart(parsed.clipboard).events),
  };
}
