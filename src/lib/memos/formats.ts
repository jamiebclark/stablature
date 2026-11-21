/**
 * The audio formats a memo may have.
 *
 * One table is used by the recorder, the wire schema, the server, the player,
 * the words and the download name. `parseFormat` is the one validator: the zod
 * schema and the upload route's content-type check both call it.
 */

export type MemoBase = "audio/mp4" | "audio/webm" | "audio/ogg";

export interface MemoFormat {
  base: MemoBase;
  /** What the recorder asks for, in order. */
  candidates: readonly string[];
  /** Codecs allowed after `codecs=`. `""` (no codecs) is always allowed. */
  codecs: (codec: string) => boolean;
  words: string;
  extension: string;
}

/** Order is the recorder's preference: MP4, then WebM, then Ogg. */
export const MEMO_FORMATS: readonly MemoFormat[] = [
  {
    base: "audio/mp4",
    candidates: ["audio/mp4;codecs=mp4a.40.2", "audio/mp4"],
    codecs: (c) => c === "opus" || /^mp4a\.[0-9a-f.]+$/.test(c),
    words: "MP4 audio",
    extension: ".m4a",
  },
  {
    base: "audio/webm",
    candidates: ["audio/webm;codecs=opus", "audio/webm"],
    codecs: (c) => c === "opus",
    words: "WebM audio",
    extension: ".webm",
  },
  {
    base: "audio/ogg",
    candidates: ["audio/ogg;codecs=opus", "audio/ogg"],
    codecs: (c) => c === "opus",
    words: "Ogg audio",
    extension: ".ogg",
  },
];

export interface ParsedFormat {
  base: MemoBase;
  /** The one codec, lower-cased, or null. */
  codec: string | null;
  /** The normalised string: lower case, no spaces, at most one `codecs`. */
  normalised: string;
}

/**
 * Accept a MIME type if it is in the allow-list, else null.
 *
 * Refuses a codec list with more than one entry (`opus,vp8`), parameters other
 * than `codecs`, and any base type not in `MEMO_FORMATS`.
 */
export function parseFormat(input: string | null | undefined): ParsedFormat | null {
  if (typeof input !== "string" || input.length === 0 || input.length > 100) return null;
  const parts = input.split(";").map((p) => p.trim());
  const base = parts[0].toLowerCase();
  const format = MEMO_FORMATS.find((f) => f.base === base);
  if (!format) return null;
  if (parts.length === 1) return { base: format.base, codec: null, normalised: format.base };
  if (parts.length > 2) return null;
  const m = /^codecs\s*=\s*(?:"([^"]*)"|([^"]*))$/i.exec(parts[1]);
  if (!m) return null;
  const codec = (m[1] ?? m[2]).trim().toLowerCase();
  if (codec.length === 0 || codec.includes(",") || /\s/.test(codec)) return null;
  if (!format.codecs(codec)) return null;
  return { base: format.base, codec, normalised: `${format.base};codecs=${codec}` };
}

/** The normalised form of an allowed type, or null. */
export function normaliseFormat(input: string | null | undefined): string | null {
  return parseFormat(input)?.normalised ?? null;
}

/** The first candidate the browser can record, or null. */
export function chooseFormat(isTypeSupported: (type: string) => boolean): string | null {
  for (const format of MEMO_FORMATS) {
    for (const candidate of format.candidates) {
      if (isTypeSupported(candidate)) return candidate;
    }
  }
  return null;
}

export function formatOf(input: string | null | undefined): MemoFormat | null {
  const parsed = parseFormat(input);
  return parsed ? (MEMO_FORMATS.find((f) => f.base === parsed.base) ?? null) : null;
}

/** The container a byte string really is, from its magic numbers. */
export function sniff(bytes: Uint8Array): MemoBase | null {
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return "audio/mp4";
  }
  if (bytes.length >= 4 && bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "audio/webm";
  }
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return "audio/ogg";
  }
  return null;
}
