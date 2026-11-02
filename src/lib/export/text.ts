/**
 * A whole song as plain text.
 *
 * This is the escape hatch, and it matters more than it looks. A band tool
 * that can only show you your parts inside itself is a place your work can get
 * stuck; one that hands you the whole song as text you can paste into a
 * message, print, or keep in a file is not. It is also the format that will
 * still open in ten years.
 *
 * Built from the same `toAscii` the on-screen staff shares a layout with, so
 * what gets exported is what you were looking at.
 */

import { describeArrangement, parseArrangement } from "../arrangement/expand";
import type {
  AnnotationRow,
  ArrangementEntryRow,
  EventRow,
  PartRow,
  SongRow,
} from "../model";
import { toAscii } from "../tab/ascii";
import type { Density } from "../tab/layout";
import { stringLabels, type Tuning } from "../tunings";

export interface SongExportInput {
  song: Pick<SongRow, "title" | "bpm" | "notes">;
  bandName?: string;
  tuning: Tuning;
  tuningName?: string;
  parts: readonly PartRow[];
  eventsByPart: Record<string, EventRow[]>;
  annotationsByPart?: Record<string, AnnotationRow[]>;
  entries: readonly ArrangementEntryRow[];
}

export interface SongExportOptions {
  /** Compact collapses repeats to `7x8`, as on screen. */
  density?: Density;
}

/**
 * Render the song.
 *
 * Arrangement first, matching the song screen: the form is the thing you need
 * at a glance, and the parts below it are the reference.
 */
export function songToText(
  input: SongExportInput,
  options: SongExportOptions = {},
): string {
  const { song, bandName, tuning, tuningName, parts, eventsByPart, entries } = input;
  const annotationsByPart = input.annotationsByPart ?? {};
  const density = options.density ?? "expanded";

  const lines: string[] = [];

  lines.push(song.title);

  // One line of context: who, what tuning, how fast.
  const meta = [
    bandName,
    tuningName ? `${tuningName} (${stringLabels(tuning).join(" ")})` : stringLabels(tuning).join(" "),
    song.bpm ? `${song.bpm} bpm` : null,
  ].filter(Boolean);
  if (meta.length > 0) lines.push(meta.join("  ·  "));

  if (song.notes) {
    lines.push("", song.notes.trim());
  }

  const arrangement = describeArrangement(parseArrangement([...entries]), parts);
  if (arrangement) {
    lines.push("", "Arrangement", `  ${arrangement}`);
  }

  for (const part of parts) {
    const heading = [part.label, part.name].filter(Boolean).join("  ");
    const base = part.variantOfPartId
      ? parts.find((candidate) => candidate.id === part.variantOfPartId)
      : undefined;

    lines.push("", base ? `${heading}   (variant of ${base.label})` : heading);

    const staff = toAscii({
      events: eventsByPart[part.id] ?? [],
      tuning,
      annotations: annotationsByPart[part.id] ?? [],
      density,
    });
    lines.push(staff);

    if (part.notes) lines.push(part.notes.trim());
  }

  // Trailing newline: this is a file as often as it is a paste.
  return `${lines.join("\n")}\n`;
}

/** Filesystem-safe name for a downloaded export. */
export function exportFilename(title: string): string {
  const stem =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "song";
  return `${stem}.txt`;
}
