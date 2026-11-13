/**
 * Review probe, INV-010 member set {--bg, --bg-raised, --selection} × Th × print: every rhythm part draws in
 * `currentColor` from `.tab-rhythm`, which is `--text`; so the contrast of `--text` against each surface token, in
 * each theme and in print, is the contrast of every symbol. Read from the stylesheet the app ships.
 * The e2e `notation-symbols.spec.ts` measures song and play backgrounds only, never a selected column.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

function tokens(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

const dark = tokens(/:root\s*\{([\s\S]*?)\n\}/.exec(css)![1]);
const light = { ...dark, ...tokens(/:root:not\(\[data-theme="dark"\]\)\s*\{([\s\S]*?)\n {2}\}/.exec(css)![1]) };
const printBlock = /@media print\s*\{\s*:root\s*\{([\s\S]*?)\n {2}\}/.exec(css)![1];
const print = { ...dark, ...tokens(printBlock) };

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe("INV-010: --text against every surface a symbol sits on", () => {
  it("the rhythm row draws in --text", () => {
    expect(/\.tab-rhythm\s*\{[^}]*color:\s*var\(--text\)/.test(css)).toBe(true);
  });
  // Print draws the song page and the play view, which have no selection (only capture selects), so print × --selection
  // is not a reachable member.
  for (const [theme, t] of Object.entries({ dark, light, print }))
    for (const surface of theme === "print" ? ["--bg", "--bg-raised"] : ["--bg", "--bg-raised", "--selection"])
      it(`${theme}: --text on ${surface} ≥ 4.5`, () => {
        expect(t["--text"], "token").toMatch(/^#/);
        expect(t[surface], "token").toMatch(/^#/);
        expect(ratio(t["--text"], t[surface])).toBeGreaterThanOrEqual(4.5);
      });
});
