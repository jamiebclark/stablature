/**
 * Reading ASCII tab back into a clipboard.
 *
 * The inverse of `ascii.ts`. Pure, synchronous and total: it never throws,
 * and it never returns a partial result. Any line it cannot read refuses the
 * whole paste, with every such line named, so nothing is imported that the
 * person did not see.
 *
 * Normative: specs/004-ascii-import/contracts/reader.md.
 */

import { parseChord } from "../chords";
import { isPartHeading } from "../export/text";
import {
  MAX_CHORD_LENGTH,
  MAX_FRET,
  MAX_REPEAT,
  MAX_TUPLET_COLUMNS,
  MIN_GROUP_COLUMNS,
  type FretValue,
  type Technique,
} from "../model";
import type { Clipboard, ClipboardColumn } from "../local/clipboard";
import { DECORATIONS, TRANSITIONS, decorate, type Decoration } from "./techniques";

export type RefusalCode =
  | "bad-character"
  | "run-together"
  | "fret-range"
  | "decoration-order"
  | "long-dash"
  | "space-in-body"
  | "repeat-sign"
  | "partial-barline"
  | "row-length"
  | "cell-overlap"
  | "repeat-disagrees"
  | "repeat-range"
  | "connector-unjoined"
  | "connector-double"
  | "systems-differ"
  | "labels-mixed"
  | "label-unknown"
  | "lone-row"
  | "bracket-placement"
  | "bracket-range"
  | "chord-collision"
  | "chord-no-column"
  | "chord-too-long"
  | "several-parts"
  | "no-staff"
  | "no-notes"
  | "rows-lowest-first"
  | "tuning-unknown"
  | "tuning-notes-change"
  | "unlabelled-count"
  | "unlabelled-no-tuning";

export interface Refusal {
  /** 1-indexed, or null when it concerns the paste as a whole. */
  line: number | null;
  text: string;
  code: RefusalCode;
  reason: string;
}

export interface LineNote {
  line: number;
  text: string;
}

export interface ParsedRow {
  /** The line of this row in the first system. */
  line: number;
  /** The row as pasted, for messages. */
  text: string;
  label: string | null;
  /** Whether any cell sits on this row. */
  filled: boolean;
}

export type ParsedTab =
  | { ok: false; refusals: Refusal[] }
  | {
      ok: true;
      clipboard: Clipboard;
      rows: ParsedRow[];
      density: "expanded" | "compact";
      ignored: LineNote[];
      spaces: number;
      moved: LineNote[];
      clipped: LineNote[];
    };

const REASONS: Record<string, string> = {
  "bad-character": "This character is not part of the tab notation.",
  "run-together": "Notes run together here. Put a rail between them.",
  "fret-range": `Frets go from 0 to ${MAX_FRET}.`,
  "decoration-order": "The marks on this note are in a different order than the app draws them.",
  "long-dash": "This is a long dash, not a rail. Use a plain hyphen.",
  "space-in-body": "A space inside a staff cannot be read. Use rails.",
  "repeat-sign": "Repeat signs cannot be read.",
  "partial-barline": "A barline must cross every string.",
  "row-length": "The strings are not all the same length.",
  "cell-overlap": "Notes overlap here and cannot be told apart.",
  "repeat-disagrees": "The repeat counts on this column disagree.",
  "repeat-range": `A repeat is from 1 to ${MAX_REPEAT}.`,
  "connector-unjoined": "This hammer-on, pull-off or slide has no note to join.",
  "connector-double": "Two joins sit in one gap.",
  "systems-differ": "This staff does not match the one above it.",
  "labels-mixed": "Some strings are labelled and some are not.",
  "label-unknown": "This label is not a note name.",
  "lone-row": "A staff needs at least two strings.",
  "bracket-placement": "This bracket does not line up with the columns beneath it.",
  "bracket-range": `A group is counted from ${MIN_GROUP_COLUMNS} to ${MAX_TUPLET_COLUMNS}.`,
  "chord-collision": "Two chords land on the same column.",
  "chord-no-column": "There is no column for this chord to sit over.",
  "chord-too-long": `A chord is at most ${MAX_CHORD_LENGTH} characters.`,
  "several-parts": "This looks like more than one part. Paste one part at a time.",
  "no-staff": "No tab was found in this text.",
  "no-notes": "The staff has no notes on it.",
};

function refusal(line: number | null, text: string, code: RefusalCode): Refusal {
  return { line, text, code, reason: REASONS[code] ?? code };
}

// ---------------------------------------------------------------- characters

const RAIL = "-";
const GLYPHS = new Map<string, Technique>(TRANSITIONS.map((t) => [t.glyph, t.id]));
for (const t of TRANSITIONS) {
  if (/[a-z]/.test(t.glyph)) GLYPHS.set(t.glyph.toUpperCase(), t.id);
}
const CELL_CHARS = new Set([..."0123456789xX~<>()btm"]);
const NOTE_NAME = /^[A-Ga-g][#b♯♭]{0,2}\d?$/;

/** Pitch class of a note name, ignoring case and octave. Null if not a note name. */
export function pitchClass(name: string): number | null {
  const match = /^([A-Ga-g])([#b♯♭]{0,2})\d?$/.exec(name);
  if (!match) return null;
  const base = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }[match[1].toLowerCase() as "c"];
  let shift = 0;
  for (const ch of match[2]) shift += ch === "#" || ch === "♯" ? 1 : -1;
  return (((base + shift) % 12) + 12) % 12;
}

// -------------------------------------------------------------------- cells

interface Cell {
  line: number;
  row: number;
  start: number;
  end: number;
  fret: FretValue;
  decorations: Decoration[];
  connector: Technique | null;
  repeat: number | null;
}

interface StaffRow {
  line: number;
  text: string;
  label: string | null;
  spacedLabel: boolean;
  opening: boolean;
  closing: boolean;
  bodyStart: number;
  bodyLength: number;
  cells: Cell[];
  bars: { start: number; end: number }[];
  dangling: boolean;
  refusal: Refusal | null;
}

const MASKS: Decoration[][] = Array.from({ length: 1 << DECORATIONS.length }, (_, mask) =>
  DECORATIONS.filter((_, i) => (mask >> i) & 1).map((d) => d.id),
);

type CellRead =
  | { ok: true; fret: FretValue; decorations: Decoration[]; repeat: number | null }
  | { ok: false; code: RefusalCode };

const cellCache = new Map<string, CellRead>();

function sortedChars(text: string): string {
  return [...text].sort().join("");
}

function readCell(raw: string): CellRead {
  const cached = cellCache.get(raw);
  if (cached) return cached;
  const result = readCellUncached(raw);
  if (cellCache.size > 5000) cellCache.clear();
  cellCache.set(raw, result);
  return result;
}

function readCellUncached(raw: string): CellRead {
  let text = raw;
  let repeat: number | null = null;
  const labelled = /^(.+?)x(\d+)$/.exec(text);
  if (labelled) {
    text = labelled[1];
    repeat = Number(labelled[2]);
    if (repeat < 1 || repeat > MAX_REPEAT) return { ok: false, code: "repeat-range" };
  }
  if (text === "X") text = "x";
  const core = /\d+|x/.exec(text);
  if (!core) return { ok: false, code: "run-together" };
  const coreText = core[0];
  if (/0\d/.test(text)) return { ok: false, code: "run-together" };
  if (coreText !== "x" && Number(coreText) > MAX_FRET) return { ok: false, code: "fret-range" };

  for (const ids of MASKS) {
    if (decorate(coreText, ids) === text) {
      return {
        ok: true,
        fret: coreText === "x" ? "x" : Number(coreText),
        decorations: ids,
        repeat,
      };
    }
  }
  const chars = sortedChars(text);
  for (const ids of MASKS) {
    if (sortedChars(decorate(coreText, ids)) === chars) return { ok: false, code: "decoration-order" };
  }
  return { ok: false, code: "run-together" };
}

function scanRow(line: number, raw: string): StaffRow {
  const trimmed = raw.trimEnd();
  const row: StaffRow = {
    line,
    text: raw,
    label: null,
    spacedLabel: false,
    opening: false,
    closing: false,
    bodyStart: 0,
    bodyLength: 0,
    cells: [],
    bars: [],
    dangling: false,
    refusal: null,
  };
  const fail = (code: RefusalCode) => {
    row.refusal ??= refusal(line, raw, code);
  };

  if (/\|:|:\|/.test(trimmed)) fail("repeat-sign");

  let at = 0;
  while (at < trimmed.length && trimmed[at] === " ") at += 1;
  let bodyStart: number;
  let openingIndex = -1;
  const rest = trimmed.slice(at);
  const withPipe = /^([A-Za-z0-9#♯♭]{1,4})(\s*)\|/.exec(rest);
  const named = /^([A-Ga-g][#b♯♭]{0,2}\d?)(\s*)-/.exec(rest);
  if (rest.startsWith("|")) {
    openingIndex = at;
    bodyStart = at + 1;
  } else if (withPipe) {
    row.label = withPipe[1];
    row.spacedLabel = withPipe[2].length > 0;
    openingIndex = at + withPipe[1].length + withPipe[2].length;
    bodyStart = openingIndex + 1;
  } else if (named) {
    // A digit flush on the note name may be an octave or a first fret, and the text cannot say.
    if (/\d$/.test(named[1])) fail("run-together");
    row.label = named[1];
    bodyStart = at + named[1].length + named[2].length;
  } else {
    bodyStart = at;
  }
  row.opening = openingIndex >= 0;
  if (row.opening && trimmed[bodyStart] === "|") bodyStart += 1;

  let end = trimmed.length;
  if (trimmed.endsWith("|") && end - 1 >= bodyStart && end - 1 > openingIndex) {
    row.closing = true;
    end -= 1;
    if (end - 1 >= bodyStart && trimmed[end - 1] === "|") end -= 1;
  }
  if (end < bodyStart) end = bodyStart;
  if (/\|\s+\S/.test(trimmed.slice(Math.max(0, bodyStart - 1)))) fail("repeat-sign");

  row.bodyStart = bodyStart;
  row.bodyLength = end - bodyStart;
  const body = trimmed.slice(bodyStart, end);
  // A note-name label with no pipe and no rail after it (`E-x`, `G-5`) is a symbol, not a string.
  if (named && !withPipe && !body.slice(1).includes(RAIL)) fail("row-length");

  let pending: Technique | null = null;
  let i = 0;
  while (i < body.length) {
    const ch = body[i];
    if (ch === RAIL) {
      i += 1;
    } else if (ch === " " || ch === "\t") {
      fail("space-in-body");
      i += 1;
    } else if (ch === "—" || ch === "–") {
      fail("long-dash");
      i += 1;
    } else if (ch === "|") {
      let stop = i;
      while (body[stop + 1] === "|") stop += 1;
      row.bars.push({ start: i, end: stop });
      i = stop + 1;
    } else if (GLYPHS.has(ch)) {
      if (pending) fail("connector-double");
      pending = GLYPHS.get(ch)!;
      i += 1;
    } else {
      let stop = i;
      while (
        stop < body.length &&
        body[stop] !== RAIL &&
        body[stop] !== "|" &&
        !GLYPHS.has(body[stop]) &&
        body[stop] !== " " &&
        body[stop] !== "\t" &&
        body[stop] !== "—" &&
        body[stop] !== "–"
      ) {
        stop += 1;
      }
      const run = body.slice(i, stop);
      if ([...run].some((c) => !CELL_CHARS.has(c))) {
        fail("bad-character");
      } else {
        const read = readCell(run);
        if (!read.ok) {
          fail(read.code);
        } else {
          row.cells.push({
            line,
            row: 0,
            start: i,
            end: stop - 1,
            fret: read.fret,
            decorations: read.decorations,
            connector: pending,
            repeat: read.repeat,
          });
        }
      }
      pending = null;
      i = stop;
    }
  }
  row.dangling = pending !== null;
  return row;
}

// ------------------------------------------------------------ classification

function isStaffLine(raw: string): boolean {
  const t = raw.trim();
  if (t === "") return false;
  if (/^[A-Za-z0-9#♯♭]{1,4}\s*\|/.test(t)) return true; // S1
  if (t.startsWith("|")) return true; // S2
  const s3 = /^[A-Ga-g][#b♯♭]{0,2}\d?\s*-(.*)$/.exec(t); // S3
  if (s3 && (/\d/.test(s3[1]) || s3[1].includes(RAIL))) return true;
  // A phone turns `--` to a long dash; a note name then a long dash is a damaged row, not commentary.
  if (/^[A-Ga-g][#b♯♭]{0,2}\d?\s*[—–]/.test(t)) return true;
  return /-{3,}/.test(t) && (/\d/.test(t) || /x-|-x/.test(t)); // S4
}

// ------------------------------------------------------------------ columns

interface DrawnColumn {
  start: number;
  end: number;
  kind: "notes" | "rest" | "barline";
  cells: Cell[];
  chord: string | null;
  group: number | null;
  /** Row text of the system, for messages. */
  line: number;
}

interface System {
  rows: StaffRow[];
  first: number;
  /** Line indexes (0-based) the system's rows, bracket and chord rows occupy. */
  top: number;
  columns: DrawnColumn[];
  rawGaps: number[] | null;
}

function nests(a: Cell, b: Cell): boolean {
  return (a.start <= b.start && a.end >= b.end) || (b.start <= a.start && b.end >= a.end);
}

/** Build the non-space columns of one system, or return a refusal. */
function buildColumns(rows: StaffRow[]): { columns: DrawnColumn[] } | { refusals: Refusal[] } {
  const items: { start: number; end: number; cells: Cell[]; barline: boolean }[] = [];
  rows.forEach((row, index) => {
    for (const cell of row.cells) {
      cell.row = index;
      items.push({ start: cell.start, end: cell.end, cells: [cell], barline: false });
    }
  });
  for (const bar of rows[0].bars) {
    items.push({ start: bar.start, end: bar.end, cells: [], barline: true });
  }
  items.sort((a, b) => a.start - b.start || a.end - b.end);

  const columns: DrawnColumn[] = [];
  const refusals: Refusal[] = [];
  let current: { start: number; end: number; cells: Cell[]; barline: boolean } | null = null;
  // Every cell at fault is named, so fixing the named lines leaves nothing new to refuse (INV-008).
  const flush = (): Refusal[] => {
    if (!current) return [];
    const cells = current.cells;
    const named: Refusal[] = [];
    const kept: Cell[] = [];
    for (const cell of cells) {
      if (kept.every((k) => k.row !== cell.row && nests(k, cell))) kept.push(cell);
      else named.push(refusal(cell.line, rows[cell.row].text, "cell-overlap"));
    }
    const counts = new Map<number | null, number>();
    for (const cell of cells) counts.set(cell.repeat, (counts.get(cell.repeat) ?? 0) + 1);
    let norm = cells[0]?.repeat ?? null;
    for (const [label, n] of counts) if (n > (counts.get(norm) ?? 0)) norm = label;
    for (const cell of cells) {
      if (cell.repeat !== norm) named.push(refusal(cell.line, rows[cell.row].text, "repeat-disagrees"));
    }
    if (named.length > 0) return named;
    columns.push({
      start: current.start,
      end: current.end,
      kind: current.barline ? "barline" : "notes",
      cells,
      chord: null,
      group: null,
      line: rows[0].line,
    });
    return [];
  };
  for (const item of items) {
    if (current && !current.barline && !item.barline && item.start <= current.end) {
      current.end = Math.max(current.end, item.end);
      current.cells.push(...item.cells);
      continue;
    }
    refusals.push(...flush());
    current = { ...item, cells: [...item.cells] };
  }
  refusals.push(...flush());
  return refusals.length > 0 ? { refusals } : { columns };
}

function gapsOf(columns: readonly DrawnColumn[], bodyLength: number): number[] {
  if (columns.length === 0) return [bodyLength];
  const gaps = [columns[0].start];
  for (let k = 1; k < columns.length; k += 1) gaps.push(columns[k].start - columns[k - 1].end - 1);
  gaps.push(bodyLength - 1 - columns[columns.length - 1].end);
  return gaps;
}

function withSpaces(system: System, line: number): { columns: DrawnColumn[]; spaces: number } {
  const out: DrawnColumn[] = [];
  const bodyLength = system.rows[0].bodyLength;
  const gaps = gapsOf(system.columns, bodyLength);
  let spaces = 0;
  const addSpaces = (gap: number, gapStart: number) => {
    const count = (gap - 1) / 2;
    for (let k = 0; k < count; k += 1) {
      const at = gapStart + 1 + 2 * k;
      out.push({ start: at, end: at, kind: "rest", cells: [], chord: null, group: null, line });
      spaces += 1;
    }
  };
  addSpaces(gaps[0], 0);
  system.columns.forEach((column, k) => {
    out.push(column);
    addSpaces(gaps[k + 1], column.end + 1);
  });
  return { columns: out, spaces };
}

// ------------------------------------------------------------ chords/brackets

interface Token {
  text: string;
  at: number;
}

function tokens(line: string): Token[] {
  return [...line.matchAll(/\S+/g)].map((m) => ({ text: m[0], at: m.index ?? 0 }));
}

function isChord(symbol: string): boolean {
  return symbol === "N.C." || parseChord(symbol) !== null;
}

function nearest(columns: readonly DrawnColumn[], pos: number): { index: number; exact: boolean } | null {
  let best = -1;
  let bestDistance = Infinity;
  columns.forEach((column, index) => {
    if (column.kind === "barline") return;
    const distance = pos < column.start ? column.start - pos : pos > column.end ? pos - column.end : 0;
    if (
      distance < bestDistance ||
      (distance === bestDistance && best >= 0 && column.start > columns[best].start)
    ) {
      best = index;
      bestDistance = distance;
    }
  });
  if (best < 0) return null;
  return { index: best, exact: columns[best].start === pos };
}

/** Whether every token on the line reads as a chord, as `D-7  G-7` does. */
function readsAsChords(raw: string): boolean {
  const found = tokens(raw);
  // One symbol at offset 0 is not a chord row (reader.md section 4), so `C-9` goes on to the staff tests.
  if (found.length === 1 && found[0].at === 0) return false;
  return found.length > 0 && found.every((t) => !/^[([]/.test(t.text) && (isChord(t.text) || splits(t.text)));
}

/**
 * Whether a token that is no chord whole could be several, as `D-G-7` is `D-` then `G-7`.
 * Columns do not exist yet, so this only says the line stays a candidate (reader.md section 2);
 * `readChordRow` settles it against the columns, and a candidate that fails there is commentary.
 */
function splits(symbol: string): boolean {
  if (symbol.length > MAX_CHORD_LENGTH || !/^[A-Ga-g]/.test(symbol)) return false;
  const ok: boolean[] = [true];
  for (let end = 1; end <= symbol.length; end += 1) {
    ok[end] = false;
    for (let from = Math.max(0, end - 24); from < end && !ok[end]; from += 1) {
      ok[end] = ok[from] && isChord(symbol.slice(from, end));
    }
  }
  return ok[symbol.length];
}

/** A rail, long dash or pipe: a line holding one and a note is a row unless it is prose. */
const HOLDS_RAIL = /[-—–|]/;

/** Whether a character is one a note is never next to: not a letter, digit, space or bracket. */
function isMark(c: string | undefined): boolean {
  return c !== undefined && !/[\p{L}\p{N}\s()[\]{}]/u.test(c);
}

/**
 * Whether a line that touches a staff row is one of its rows (reader.md section 2, S5). It is,
 * when some digit or free `x` on it touches a mark. So `-5s7-`, `--5 7--` and `B:-5-7-` are
 * rows, and `Verse 2` and `1   2   3   4` are commentary.
 */
function readsAsBlockRow(raw: string): boolean {
  const chars = [...raw.trim()];
  const letter = (c: string | undefined) => c !== undefined && /\p{L}/u.test(c);
  return chars.some((c, i) => {
    const free = /\d/.test(c) || (/[xX]/.test(c) && !letter(chars[i - 1]) && !letter(chars[i + 1]));
    return free && (isMark(chars[i - 1]) || isMark(chars[i + 1]));
  });
}

/**
 * Whether a line is positively something other than a damaged row (reader.md section 2, S5): only
 * numbers and `. / :`, only chord symbols, or a word of two letters or more that is not a
 * note name. A line opening or closing on a rail or pipe never is.
 */
function readsAsProse(raw: string): boolean {
  const t = raw.trim();
  if (/^[-\u2014\u2013\u2212|]|[-\u2014\u2013\u2212|]$/.test(t)) return false;
  if (/^[\d\s./:]+$/.test(t)) return true;
  if (tokens(t).every((k) => isChord(k.text))) return true;
  return [...t.matchAll(/(?<![\p{L}\p{N}])\p{L}{2,}(?![\p{L}\p{N}])/gu)].some((m) => !NOTE_NAME.test(m[0]));
}

/** A line of the notation's own characters with at least one rail or pipe, and no spaces. */
function isNotationOnly(raw: string): boolean {
  const t = raw.trim();
  if (t === "" || !/[-—–|]/.test(t)) return false;
  return [...t].every(
    (c) => c === RAIL || c === "|" || c === "—" || c === "–" || CELL_CHARS.has(c) || GLYPHS.has(c),
  );
}

interface ChordRead {
  refusal: Refusal | null;
  moved: LineNote[];
  clipped: LineNote[];
}

/**
 * Settle a candidate chord row against a system's columns. Returns null when
 * the line is not a chord row. Placed chords are written onto the columns.
 */
function readChordRow(
  raw: string,
  lineNo: number,
  columns: DrawnColumn[],
  top: StaffRow,
): ChordRead | null {
  const found = tokens(raw);
  if (found.length === 0) return null;
  if (found.length === 1 && found[0].at === 0) return null;
  const starts = columns.filter((c) => c.kind !== "barline").map((c) => top.bodyStart + c.start);
  const pieces: Token[] = [];
  let tooLong = false;
  for (const token of found) {
    if (token.text.startsWith("(") || token.text.startsWith("[")) return null;
    if (token.text.length > MAX_CHORD_LENGTH && /^[A-Ga-g]/.test(token.text)) {
      tooLong = true;
      continue;
    }
    if (isChord(token.text)) {
      pieces.push(token);
      continue;
    }
    const cuts = starts.filter((s) => s > token.at && s < token.at + token.text.length);
    const bounds = [token.at, ...cuts, token.at + token.text.length];
    const parts: Token[] = [];
    for (let k = 0; k + 1 < bounds.length; k += 1) {
      parts.push({ text: raw.slice(bounds[k], bounds[k + 1]), at: bounds[k] });
    }
    if (cuts.length === 0 || !parts.every((p) => isChord(p.text))) return null;
    pieces.push(...parts);
  }
  const result: ChordRead = { refusal: null, moved: [], clipped: [] };
  if (tooLong) {
    result.refusal = refusal(lineNo, raw, "chord-too-long");
    return result;
  }
  if (raw.includes("\t")) {
    result.refusal = refusal(lineNo, raw, "chord-collision");
    return result;
  }
  if (columns.every((c) => c.kind === "barline")) {
    result.refusal = refusal(lineNo, raw, "chord-no-column");
    return result;
  }
  const lastBodyPosition = top.bodyStart + top.bodyLength - 1;
  for (const piece of pieces) {
    const hit = nearest(columns, piece.at - top.bodyStart);
    if (!hit) {
      result.refusal = refusal(lineNo, raw, "chord-no-column");
      return result;
    }
    if (columns[hit.index].chord !== null) {
      result.refusal = refusal(lineNo, raw, "chord-collision");
      return result;
    }
    columns[hit.index].chord = piece.text;
    if (!hit.exact) result.moved.push({ line: lineNo, text: piece.text });
    if (piece.at + piece.text.length - 1 === lastBodyPosition) {
      result.clipped.push({ line: lineNo, text: piece.text });
    }
  }
  return result;
}

interface BracketToken extends Token {
  count: number | null;
  bare: boolean;
}

function bracketTokens(raw: string): BracketToken[] | null {
  const found = tokens(raw);
  if (found.length === 0) return null;
  const out: BracketToken[] = [];
  for (const token of found) {
    const t = token.text;
    let match: RegExpExecArray | null;
    if ((match = /^,(-*)(\d*)(-*),$/.exec(t))) {
      out.push({ ...token, count: match[2] === "" ? null : Number(match[2]), bare: false });
    } else if ((match = /^(\d+),$/.exec(t))) {
      out.push({ ...token, count: Number(match[1]), bare: false });
    } else if (t === "," || t === ",,") {
      out.push({ ...token, count: null, bare: false });
    } else if (/^\d+$/.test(t)) {
      out.push({ ...token, count: Number(t), bare: true });
    } else {
      return null;
    }
  }
  return out;
}

/**
 * Settle a candidate bracket row. Null means not a bracket row. Otherwise the
 * groups are written onto the columns, numbered from `firstGroup`.
 */
function readBracketRow(
  raw: string,
  lineNo: number,
  columns: DrawnColumn[],
  top: StaffRow,
  groups: Map<number, number | null>,
): { refusal: Refusal | null } | null {
  const found = bracketTokens(raw);
  if (!found) return null;
  const commas = raw.includes(",");
  const startOf = (pos: number) => columns.findIndex((c) => top.bodyStart + c.start === pos);
  const endOf = (pos: number) => columns.findIndex((c) => top.bodyStart + c.end === pos);
  if (!commas) {
    const ok = found.every(
      (t) =>
        t.count !== null &&
        t.count >= MIN_GROUP_COLUMNS &&
        t.count <= MAX_TUPLET_COLUMNS &&
        startOf(t.at) >= 0 &&
        columns[startOf(t.at)].kind !== "barline",
    );
    if (!ok) return null;
  }
  if (raw.includes("\t")) return { refusal: refusal(lineNo, raw, "bracket-placement") };
  for (const token of found) {
    if (token.count !== null && (token.count < MIN_GROUP_COLUMNS || token.count > MAX_TUPLET_COLUMNS)) {
      return { refusal: refusal(lineNo, raw, "bracket-range") };
    }
  }
  const placed: { from: number; to: number; count: number | null }[] = [];
  for (const token of found) {
    const from = startOf(token.at);
    const to = token.bare ? from : endOf(token.at + token.text.length - 1);
    if (from < 0 || to < from) return { refusal: refusal(lineNo, raw, "bracket-placement") };
    if (columns.slice(from, to + 1).some((c) => c.kind === "barline")) {
      return { refusal: refusal(lineNo, raw, "bracket-placement") };
    }
    placed.push({ from, to, count: token.count });
  }
  for (const span of placed) {
    const id = groups.size;
    groups.set(id, span.count);
    for (let k = span.from; k <= span.to; k += 1) columns[k].group = id;
  }
  return { refusal: null };
}

// ---------------------------------------------------------------- the parser

function failed(refusals: Refusal[]): ParsedTab {
  const seen = new Set<string>();
  const unique: Refusal[] = [];
  for (const r of refusals) {
    const key = r.line === null ? "paste" : String(r.line);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  unique.sort((a, b) => (a.line ?? 0) - (b.line ?? 0));
  return { ok: false, refusals: unique };
}

export function parseTab(input: string): ParsedTab {
  try {
    return parse(input);
  } catch {
    return failed([refusal(null, "", "no-staff")]);
  }
}

function parse(input: string): ParsedTab {
  const text = input.replace(/^﻿/, "").replace(/ /g, " ");
  const lines = text.split(/\r\n|\r|\n/).map((l) => l.trimEnd());

  // One walk decides every line kind (reader.md section 2): bracket, chord, staff and S5 are tried
  // together, so each test sees the block as it has grown. Sweeps alternate direction until nothing
  // changes, so a block grows whole in one sweep and stacked lines stay linear.
  const isStaff: boolean[] = lines.map(() => false);
  const isBracket: boolean[] = lines.map(() => false);
  const isChordRow: boolean[] = lines.map(() => false);
  const decide = (i: number): boolean => {
    if (isStaff[i] || isBracket[i] || isChordRow[i] || lines[i].trim() === "") return false;
    const staffBelow = i + 1 < lines.length && isStaff[i + 1];
    if (staffBelow && lines[i].includes(",") && bracketTokens(lines[i]) !== null) {
      isBracket[i] = true;
      return true;
    }
    if ((staffBelow || (i + 1 < lines.length && isBracket[i + 1])) && readsAsChords(lines[i])) {
      isChordRow[i] = true;
      return true;
    }
    // S6: a row wherever it sits. A run with no space holding a note and a rail, long dash, minus sign or pipe, and the line is not prose.
    const held = lines[i].trim();
    const note = [...held].some((c, n, all) => {
      const letter = (l: string | undefined) => l !== undefined && /\p{L}/u.test(l);
      return /\d/.test(c) || (/[xX]/.test(c) && !letter(all[n - 1]) && !letter(all[n + 1]));
    });
    const inRun = (k: string) =>
      /\d|(?<!\p{L})[xX](?!\p{L})/u.test(k) || (isNotationOnly(k) && /[xX]/.test(k));
    const railed = (k: number) =>
      k >= 0 && k < lines.length && /[-—–−|]/.test(lines[k]) && !readsAsProse(lines[k]);
    const numbers = /^[\dxX\s./:-]+$/.test(held) && !/^[-—–−|]|[-—–−|]$/.test(held);
    const touches = held.split(/\s+/).some((k) => /[-—–−|]/.test(k) && inRun(k));
    const loose =
      (note || touches) &&
      (/\|[-—–−0-9xX]|[-—–−0-9xX]\|/.test(held) ||
        (touches && railed(i) && (!numbers || railed(i - 1) || railed(i + 1))));
    if (isStaffLine(lines[i]) || loose) {
      isStaff[i] = true;
      return true;
    }
    const empty = !/[0-9xX]/.test(lines[i]);
    const can = isNotationOnly(lines[i]) || (!empty && (HOLDS_RAIL.test(lines[i]) || readsAsBlockRow(lines[i])) && !readsAsProse(lines[i]));
    if (!can) return false;
    const against = (k: number) =>
      k >= 0 && k < lines.length && isStaff[k] && (!empty || scanRow(k + 1, lines[k]).label === null);
    if (against(i - 1) || against(i + 1)) {
      isStaff[i] = true;
      return true;
    }
    return false;
  };
  for (let changed = true, up = true; changed; up = !up) {
    changed = false;
    for (let n = 0; n < lines.length; n += 1) {
      if (decide(up ? lines.length - 1 - n : n)) changed = true;
    }
  }
  if (!isStaff.some(Boolean)) return failed([refusal(null, "", "no-staff")]);

  const refusals: Refusal[] = [];
  const used = new Set<number>();

  // Group consecutive staff lines into systems.
  const systems: System[] = [];
  for (let i = 0; i < lines.length; ) {
    if (!isStaff[i]) {
      i += 1;
      continue;
    }
    let j = i;
    while (j < lines.length && isStaff[j]) j += 1;
    const rows: StaffRow[] = [];
    for (let k = i; k < j; k += 1) {
      rows.push(scanRow(k + 1, lines[k]));
      used.add(k);
    }
    systems.push({ rows, first: i, top: i, columns: [], rawGaps: null });
    i = j;
  }

  const good: System[] = [];
  for (const system of systems) {
    const rows = system.rows;
    // Every check that needs no columns runs on every system, so one bad row never hides another
    // bad line (INV-008). The rows that read are the clean ones; columns are built from them alone.
    const before = refusals.length;
    for (const r of rows) if (r.refusal) refusals.push(r.refusal);
    const clean = rows.filter((r) => !r.refusal);
    const barKey = (r: StaffRow) => r.bars.map((b) => `${b.start}:${b.end}`).join(",");
    let columnsReadable = true;
    if (rows.length < 2) {
      if (clean.length === 1) refusals.push(refusal(rows[0].line, rows[0].text, "lone-row"));
      columnsReadable = false;
    }
    const labelled = rows.filter((r) => r.label !== null).length;
    if (labelled > 0 && labelled < rows.length) {
      refusals.push(refusal(rows[0].line, rows[0].text, "labels-mixed"));
      columnsReadable = false;
    }
    for (const unknown of rows.filter((r) => r.label !== null && !NOTE_NAME.test(r.label!))) {
      refusals.push(refusal(unknown.line, unknown.text, "label-unknown"));
      columnsReadable = false;
    }
    if (clean.length > 0) {
      const lengths = clean.map((r) => r.bodyLength);
      const min = Math.min(...lengths);
      const max = Math.max(...lengths);
      if (min !== max) {
        const onlyRails =
          !clean.some((r) => r.closing) &&
          clean.every((r) => r.cells.every((c) => c.end < min) && r.bars.every((b) => b.end < min));
        if (!onlyRails) {
          // Every row off the system's most common length; on a tie the longer length is the norm.
          const tally = new Map<number, number>();
          for (const n of lengths) tally.set(n, (tally.get(n) ?? 0) + 1);
          const usual = [...tally.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
          for (const r of clean) {
            if (r.bodyLength !== usual) refusals.push(refusal(r.line, r.text, "row-length"));
          }
          columnsReadable = false;
        } else if (clean.length === rows.length) {
          for (const r of rows) r.bodyLength = max;
        }
      }
      // The rows that read still disagree about barlines in their own right: the odd one is
      // the one that differs from most of them.
      const keys = clean.map(barKey);
      const counts = new Map<string, number>();
      for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
      const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      clean.forEach((r, k) => {
        if (keys[k] === common) return;
        refusals.push(refusal(r.line, r.text, "partial-barline"));
        columnsReadable = false;
      });
    }
    if (columnsReadable && clean.length >= 2) {
      const built = buildColumns(clean);
      if ("refusals" in built) {
        refusals.push(...built.refusals);
      } else if (refusals.length === before && clean.length === rows.length) {
        system.columns = built.columns;
        good.push(system);
      }
    }
    if (!good.includes(system)) {
      for (const r of clean) if (r.dangling) refusals.push(refusal(r.line, r.text, "connector-unjoined"));
    }
  }

  // Reading rails: one decision for the whole paste.
  const appShape =
    good.length > 0 &&
    good.length === systems.length &&
    good.every((system) => {
      const rows = system.rows;
      if (!rows.every((r) => r.label !== null && r.spacedLabel && r.opening && r.closing)) return false;
      if (!rows.every((r) => r.bodyStart === rows[0].bodyStart && r.bodyLength === rows[0].bodyLength))
        return false;
      return gapsOf(system.columns, rows[0].bodyLength).every((g) => g % 2 === 1);
    });

  // Systems must agree with the first.
  const reference = good[0];
  if (reference) {
    const sig = (s: System) => s.rows.map((r) => (r.label === null ? "" : String(pitchClass(r.label))));
    const base = sig(reference);
    for (const system of good.slice(1)) {
      const mine = sig(system);
      if (mine.length !== base.length || mine.some((m, k) => m !== base[k])) {
        refusals.push(refusal(system.rows[0].line, system.rows[0].text, "systems-differ"));
      }
    }
  }
  const surviving = good;

  // Chord, bracket and heading rows above each system.
  const moved: LineNote[] = [];
  const clipped: LineNote[] = [];
  const groups = new Map<number, number | null>();
  let spaces = 0;
  const joined: DrawnColumn[] = [];
  const systemColumns: DrawnColumn[][] = [];

  const headingAbove = (system: System, position: number, from: number) => {
    // A heading is listed with the other lines read past; it only decides whether parts join.
    // Past commentary, the nearest heading above (up to the previous staff) still starts a part.
    if (position === 0) return;
    let k = from;
    while (k >= 0 && !isStaff[k] && !isPartHeading(lines[k])) k -= 1;
    if (k >= 0 && !isStaff[k] && !used.has(k)) {
      used.add(k);
      refusals.push(refusal(k + 1, lines[k], "several-parts"));
    }
    void system;
  };

  for (const [position, system] of systems.entries()) {
    if (!good.includes(system)) {
      // The line-local checks need no columns: a bracket's range and a chord's length. Anything
      // that does need them is left to the next try (INV-008).
      let top = system.first - 1;
      const topRow = system.rows[0];
      const lineLocal = (r: Refusal | null) => {
        if (r && (r.code === "bracket-range" || r.code === "chord-too-long")) refusals.push(r);
      };
      if (top >= 0 && lines[top].trim() !== "" && !isStaff[top]) {
        const bracket = readBracketRow(lines[top], top + 1, [], topRow, new Map());
        if (bracket) {
          used.add(top);
          lineLocal(bracket.refusal);
          top -= 1;
        }
      }
      if (top >= 0 && lines[top].trim() !== "" && !isStaff[top]) {
        const chord = readChordRow(lines[top], top + 1, [], topRow);
        if (chord) {
          used.add(top);
          lineLocal(chord.refusal);
          top -= 1;
        }
      }
      headingAbove(system, position, top);
      continue;
    }
    const { columns, spaces: added } = appShape
      ? withSpaces(system, system.rows[0].line)
      : { columns: system.columns, spaces: 0 };
    spaces += added;
    const topRow = system.rows[0];
    let above = system.first - 1;

    if (above >= 0 && lines[above].trim() !== "" && !isStaff[above]) {
      const bracket = readBracketRow(lines[above], above + 1, columns, topRow, groups);
      if (bracket) {
        used.add(above);
        if (bracket.refusal) refusals.push(bracket.refusal);
        above -= 1;
      }
    }
    if (above >= 0 && lines[above].trim() !== "" && !isStaff[above]) {
      const chord = readChordRow(lines[above], above + 1, columns, topRow);
      if (chord) {
        used.add(above);
        if (chord.refusal) refusals.push(chord.refusal);
        moved.push(...chord.moved);
        clipped.push(...chord.clipped);
        above -= 1;
      }
    }
    headingAbove(system, position, above);
    systemColumns.push(columns);
  }
  if (good.length === 0) return failed(refusals);

  // Join systems; a closing pipe on the upper system becomes a barline.
  surviving.forEach((system, index) => {
    if (index > 0 && surviving[index - 1].rows[0].closing) {
      joined.push({ start: 0, end: 0, kind: "barline", cells: [], chord: null, group: null, line: system.rows[0].line });
    }
    joined.push(...systemColumns[index]);
  });

  // Connectors must have something to join (reader.md section 9).
  const rowCount = reference.rows.length;
  for (let row = 0; row < rowCount; row += 1) {
    let seen = false;
    for (const column of joined) {
      const cell = column.cells.find((c) => c.row === row);
      if (!cell) continue;
      if (cell.connector && !seen) {
        const owner = surviving.find((s) => s.rows.some((r) => r.line === cell.line))!;
        refusals.push(refusal(cell.line, owner.rows[row].text, "connector-unjoined"));
      }
      seen = true;
    }
  }
  for (const system of surviving) {
    system.rows.forEach((r) => {
      if (r.dangling) refusals.push(refusal(r.line, r.text, "connector-unjoined"));
    });
  }

  const anyNote = joined.some((c) => c.cells.length > 0);
  if (!anyNote && refusals.length === 0) refusals.push(refusal(null, "", "no-notes"));
  if (refusals.length > 0) return failed(refusals);

  const rows: ParsedRow[] = reference.rows.map((r, index) => ({
    line: r.line,
    text: r.text,
    label: r.label,
    filled: joined.some((c) => c.cells.some((cell) => cell.row === index)),
  }));

  const ignored: LineNote[] = [];
  lines.forEach((l, index) => {
    if (l.trim() !== "" && !used.has(index)) ignored.push({ line: index + 1, text: l });
  });

  const compact = joined.some((c) => c.cells.some((cell) => cell.repeat !== null));
  const clipboard = finish(joined, groups, compact);
  return {
    ok: true,
    clipboard,
    rows,
    density: compact ? "compact" : "expanded",
    ignored,
    spaces,
    moved,
    clipped,
  };
}

// ----------------------------------------------------------------- finishing

function columnKey(column: DrawnColumn): string {
  const frets: Record<string, FretValue> = {};
  const techniques: Record<string, string[]> = {};
  for (const cell of column.cells) {
    frets[cell.row] = cell.fret;
    const list = [...(cell.connector ? [cell.connector] : []), ...cell.decorations];
    if (list.length > 0) techniques[cell.row] = list;
  }
  return JSON.stringify([column.kind, frets, techniques]);
}

function finish(
  columns: readonly DrawnColumn[],
  groups: ReadonlyMap<number, number | null>,
  compact: boolean,
): Clipboard {
  const frets = (column: DrawnColumn) => {
    const out: Record<string, FretValue> = {};
    for (const cell of column.cells) out[String(cell.row)] = cell.fret;
    return out;
  };
  const techniques = (column: DrawnColumn) => {
    const out: Record<string, Technique[]> = {};
    for (const cell of column.cells) {
      const list: Technique[] = [...(cell.connector ? [cell.connector] : []), ...cell.decorations];
      if (list.length > 0) out[String(cell.row)] = list;
    }
    return out;
  };

  // Which stored repeat each drawn column becomes: a list of segment sizes per run.
  const segments: { from: number; repeats: number[] }[] = [];
  if (compact) {
    columns.forEach((column, index) => {
      const label = column.cells.find((c) => c.repeat !== null)?.repeat ?? 1;
      segments.push({ from: index, repeats: [column.kind === "barline" ? 1 : label] });
    });
  } else {
    // Runs of identical, mergeable columns.
    const runs: { from: number; length: number; group: number | null }[] = [];
    for (let index = 0; index < columns.length; index += 1) {
      const column = columns[index];
      const last = runs[runs.length - 1];
      const previous = columns[index - 1];
      if (
        last &&
        column.kind !== "barline" &&
        previous.kind !== "barline" &&
        column.group === last.group &&
        column.chord === null &&
        columnKey(column) === columnKey(previous)
      ) {
        last.length += 1;
      } else {
        runs.push({ from: index, length: 1, group: column.group });
      }
    }
    // Counted groups: spend the excess left to right.
    const spend = new Map<number, number>();
    for (const [id, count] of groups) {
      if (count === null) continue;
      const members = runs.filter((r) => r.group === id);
      const drawn = members.reduce((n, r) => n + r.length, 0);
      const excess = drawn - count;
      // A run saves columns by storing chunks of at most MAX_REPEAT, as the plain path does.
      const room = (run: { length: number }) => run.length - Math.ceil(run.length / MAX_REPEAT);
      const savable = members.reduce((n, r) => n + room(r), 0);
      if (excess <= 0 || excess > savable) continue;
      let left = excess;
      for (const run of members) {
        const take = Math.min(left, room(run));
        spend.set(run.from, take);
        left -= take;
      }
    }
    for (const run of runs) {
      const column = columns[run.from];
      if (column.kind === "barline") {
        segments.push({ from: run.from, repeats: [1] });
      } else if (run.group === null) {
        const repeats: number[] = [];
        for (let left = run.length; left > 0; left -= MAX_REPEAT) repeats.push(Math.min(left, MAX_REPEAT));
        segments.push({ from: run.from, repeats });
      } else if (groups.get(run.group) === null) {
        segments.push({ from: run.from, repeats: Array.from({ length: run.length }, () => 1) });
      } else {
        // Spend the saving into chunks of at most MAX_REPEAT, then the rest stay drawn out.
        const repeats: number[] = [];
        let saving = spend.get(run.from) ?? 0;
        let left = run.length;
        while (saving > 0) {
          const chunk = Math.min(saving + 1, MAX_REPEAT, left);
          repeats.push(chunk);
          left -= chunk;
          saving -= chunk - 1;
        }
        for (; left > 0; left -= 1) repeats.push(1);
        segments.push({ from: run.from, repeats });
      }
    }
  }

  const stored: ClipboardColumn[] = [];
  const annotations: Clipboard["annotations"] = [];
  const groupSlot = new Map<number, number>();
  for (const segment of segments) {
    const column = columns[segment.from];
    segment.repeats.forEach((repeat, k) => {
      let tupletGroup: number | null = null;
      let tupletCount: number | null = null;
      let groupKind: ClipboardColumn["groupKind"] = null;
      if (column.group !== null) {
        if (!groupSlot.has(column.group)) groupSlot.set(column.group, groupSlot.size);
        tupletGroup = groupSlot.get(column.group)!;
        tupletCount = groups.get(column.group) ?? null;
        groupKind = tupletCount === null ? "plain" : "tuplet";
      }
      if (k === 0 && column.chord !== null) {
        annotations.push({ columnIndex: stored.length, kind: "chord", value: column.chord });
      }
      stored.push({
        kind: column.kind,
        frets: frets(column),
        techniques: techniques(column),
        repeat,
        durationHint: null,
        tupletGroup,
        tupletCount,
        groupKind,
      });
    });
  }
  return { columns: stored, annotations };
}
