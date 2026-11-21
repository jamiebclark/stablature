import { describe, expect, it } from "vitest";
import { downloadName } from "../words";

/** INV-021: a download name is always a short, plain file name. */
const SHAPE = /^[a-z0-9-]{1,40}(-[a-z0-9-]{1,40}){2}\.(m4a|webm|ogg)$/;
const FORMATS = ["audio/mp4", "audio/webm", "audio/ogg"];
const at = new Date(2026, 10, 16, 9, 5).getTime();

describe("downloadName", () => {
  const cases: Array<[string, { songTitle: string; partLabel: string; label: string | null }]> = [
    ["label", { songTitle: "Song", partLabel: "A", label: "Take two" }],
    ["no label", { songTitle: "Song", partLabel: "A", label: null }],
    ["only symbols", { songTitle: "!!!", partLabel: "???", label: "***" }],
    ["emoji", { songTitle: "🎸🎸", partLabel: "B'", label: "🔥" }],
    ["empty song title", { songTitle: "", partLabel: "A", label: null }],
    ["200-char title", { songTitle: "x".repeat(200), partLabel: "A", label: "y".repeat(200) }],
  ];
  for (const format of FORMATS) {
    for (const [name, input] of cases) {
      it(`${format} · ${name}`, () => {
        expect(downloadName({ ...input, recordedAt: at, format })).toMatch(SHAPE);
      });
    }
  }
});
