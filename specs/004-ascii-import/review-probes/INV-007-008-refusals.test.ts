/**
 * INV-007: never does a refusal write anything or offer an import.
 * INV-008: never does a refusal lack its line, its text or a reason, and never is a bad line left out.
 * Over R, every code in contracts/reader.md and contracts/writes.md, each with its sample.
 */
import { describe, expect, it } from "vitest";
import { importTab } from "@/lib/local/importing";
import { parseTab, type RefusalCode } from "@/lib/tab/parse";
import { readTab } from "@/lib/tab/reading";
import { presetById } from "@/lib/tunings";
import { dump, four, holdNotes, reading, staff, world, type World } from "./unit-helpers";

const G = four("--5--");
const row = (rest: string) => [`G |${rest}|`, "D |-----|", "A |-----|", "E |-----|"].join("\n");

/** Every code of reader.md, with a sample that holds the whole staff. */
const READER: [RefusalCode, string][] = [
  ["bad-character", row("-5s7-")],
  ["run-together", row("-7b9-")],
  ["fret-range", row("-57--")],
  ["decoration-order", row("-7~b-")],
  ["long-dash", row("-5—7-")],
  ["space-in-body", row("-5 7-")],
  ["repeat-sign", row(":-5-:")],
  ["repeat-sign", `${G} x4`],
  ["partial-barline", staff("GDAE", ["--5--|--7--", "-----------", "-----------", "-----------"])],
  ["row-length", staff("GDAE", ["--5--", "---", "-----", "-----"])],
  ["cell-overlap", staff("GDAE", ["-12--", "--34-", "-----", "-----"])],
  ["repeat-disagrees", staff("GDAE", ["-7x3-", "-5x4-", "-----", "-----"])],
  ["repeat-range", row("-7x0-")],
  ["repeat-range", row("7x513")],
  // On the D row: `G` above holds a note only on the G row, so this one has no source in any position.
  ["connector-unjoined", staff("GDAE", ["-----", "--h7-", "-----", "-----"])],
  ["connector-unjoined", row("--7h-")],
  ["connector-double", staff("GDAE", ["-5h/7-", "------", "------", "------"])],
  ["systems-differ", `${G}\n\n${staff("GDA", ["--5--", "-----", "-----"])}`],
  ["labels-mixed", "G |--5--|\n  |-----|\n  |-----|\n  |-----|"],
  ["label-unknown", "T |--5--|\nA |-----|\nB |-----|"],
  ["lone-row", "G |--5--|"],
  ["bracket-placement", `  ,--,\n${staff("GDAE", ["-5-7-9-", "-------", "-------", "-------"])}`],
  ["bracket-range", `    ,-1-,\n${staff("GDAE", ["-5-7-", "-----", "-----", "-----"])}`],
  ["bracket-range", `    ,-17-,\n${staff("GDAE", ["-5-7--", "------", "------", "------"])}`],
  ["chord-collision", `    A B\n${staff("GDAE", ["-5-", "---", "---", "---"])}`],
  ["chord-no-column", `    Am\n${staff("GDAE", ["-|-|-", "-|-|-", "-|-|-", "-|-|-"])}`],
  ["chord-too-long", `    C${"7".repeat(200)}\n${G}`],
  ["several-parts", `A\n${G}\n\nB\n${G}`],
  ["no-staff", "Lyrics only\nand more lyrics"],
  ["no-notes", staff("GDAE", ["-", "-", "-", "-"])],
];

const NULL_LINE = new Set<RefusalCode>(["no-staff", "no-notes"]);

/** The five codes of writes.md, each needing a song as well as text. */
const TUNING: [RefusalCode, () => Promise<World>, string][] = [
  ["rows-lowest-first", () => world("bass4-e"), staff("EADG", ["-5-", "---", "---", "---"])],
  ["tuning-unknown", () => world("bass4-e"), staff("CFAD", ["-5-", "---", "---", "---"])],
  [
    "tuning-notes-change",
    async () => {
      const w = await world("bass4-e");
      await holdNotes(w, [0, 1, 2, 3]);
      return w;
    },
    staff("FCGD", ["-5-", "---", "---", "---"]),
  ],
  ["unlabelled-count", () => world("bass4-e"), "|-5-|\n|---|\n|---|"],
  ["unlabelled-no-tuning", () => world(null), "|-5-|\n|---|\n|---|\n|---|"],
];

function expectWellFormed(refusals: { line: number | null; text: string; reason: string; code: string }[], lines: string[]) {
  for (const r of refusals) {
    expect(r.reason.trim(), `${r.code} reason`).not.toBe("");
    if (NULL_LINE.has(r.code as RefusalCode)) {
      expect(r.line, `${r.code} line`).toBeNull();
      continue;
    }
    expect(r.line, `${r.code} line`).not.toBeNull();
    expect(r.text, `${r.code} shows the line it names`).toBe(lines[r.line! - 1]);
  }
}

describe("INV-007 every reader code refuses and writes nothing", () => {
  it.each(READER)("%s, alone", async (code, text) => {
    const w = await world("bass4-e");
    const r = await reading(w, text);
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.refusals.map((x) => x.code)).toContain(code);
    const before = await dump(w);
    for (const key of ["fits", "preset:bass5-b"]) {
      const out = await importTab(w.song, text, key, w.ctx);
      expect(out.kind).toBe("changed");
    }
    expect(await dump(w)).toBe(before);
  });

  const among = READER.filter(([code]) => !["no-staff", "no-notes", "several-parts"].includes(code));
  it.each(among)("%s, first, middle and last among good systems", async (code, text) => {
    const w = await world("bass4-e");
    for (const pasted of [`${text}\n\n${G}`, `${G}\n\n${text}\n\n${G}`, `${G}\n\n${text}`]) {
      const r = await reading(w, pasted);
      expect(r.kind, pasted).toBe("refused");
      if (r.kind === "refused") expect(r.refusals.map((x) => x.code), pasted).toContain(code);
      const before = await dump(w);
      expect((await importTab(w.song, pasted, "fits", w.ctx)).kind).toBe("changed");
      expect(await dump(w)).toBe(before);
    }
  });
});

describe("INV-007 every tuning code refuses and writes nothing", () => {
  it.each(TUNING)("%s", async (code, make, text) => {
    const w = await make();
    const r = await reading(w, text);
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expect(r.refusals.map((x) => x.code)).toContain(code);
    const before = await dump(w);
    expect((await importTab(w.song, text, "fits", w.ctx)).kind).toBe("changed");
    expect(await dump(w)).toBe(before);
  });
});

describe("INV-008 every refusal names its line, shows it, and gives a reason", () => {
  it.each(READER)("%s", (_code, text) => {
    const parsed = parseTab(text);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expectWellFormed(parsed.refusals, text.split("\n"));
  });

  it.each(TUNING)("%s", async (_code, make, text) => {
    const w = await make();
    const r = await reading(w, text);
    expect(r.kind).toBe("refused");
    if (r.kind === "refused") expectWellFormed(r.refusals, text.split("\n"));
  });

  it("the plan's own list: three codes in order, two systems, CRLF, a blank first line", () => {
    const text = `\n${row("-5s7-")}\n\n${row("-57--")}\n\n${row("-5 7-")}`;
    for (const pasted of [text, text.replace(/\n/g, "\r\n")]) {
      const parsed = parseTab(pasted);
      expect(!parsed.ok && parsed.refusals.map((r) => [r.line, r.code])).toEqual([
        [2, "bad-character"],
        [7, "fret-range"],
        [12, "space-in-body"],
      ]);
    }
  });
});

/**
 * FR-018: "for every such line, not only the first". Each pair below is two lines that each
 * refuse alone. Both must be listed when they arrive together.
 */
describe("INV-008 no bad line is left out when two kinds of bad line meet", () => {
  const bracketBad = (body: string) => `    ,-1-,\n${staff("GDAE", [body, rails(body), rails(body), rails(body)])}`;
  const chordBad = (body: string) => `    A B\n${staff("GDAE", [body, rails(body), rails(body), rails(body)])}`;
  function rails(body: string) {
    return "-".repeat(body.length);
  }
  const lineOf = (text: string, needle: string) => text.split("\n").findIndex((l) => l.includes(needle)) + 1;

  const pairs: [string, string, string, string][] = [
    ["a bad staff row, then a bad bracket row", row("-5s7-"), bracketBad("-5-7-"), ",-1-,"],
    ["a bad staff row, then a chord collision", row("-5s7-"), chordBad("-5-"), "A B"],
    ["a bad bracket row, then a bad staff row", bracketBad("-5-7-"), row("-5s7-"), "-5s7-"],
    ["a chord collision, then an unjoined connector", chordBad("-5-"), row("--7h-"), "--7h-"],
    ["a bad staff row, then a dangling connector", row("-5s7-"), row("--7h-"), "--7h-"],
  ];

  it.each(pairs)("%s", (_name, one, two, needle) => {
    const text = `${one}\n\n${two}`;
    const parsed = parseTab(text);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    const lines = parsed.refusals.map((r) => r.line);
    expect(lines).toContain(lineOf(text, needle));
    expect(lines.length).toBe(2);
  });

  it("two bad rows of different kinds inside one system", () => {
    // Row 1 holds a character the notation lacks. Row 2 alone has a barline. Each refuses alone.
    const text = staff("GDAE", ["--5s-", "--|--", "-----", "-----"]);
    const parsed = parseTab(text);
    expect(!parsed.ok && parsed.refusals.map((r) => r.line).sort()).toEqual([1, 2]);
  });

  it("a whole song with one bad row names the heading too", () => {
    const text = `A\n${row("-5s7-")}\n\nB\n${G}`;
    const parsed = parseTab(text);
    expect(!parsed.ok && parsed.refusals.map((r) => r.code).sort()).toEqual(["bad-character", "several-parts"]);
  });
});

describe("the fit refusals say what writes.md says they name", () => {
  const context = (id: string) => ({ tuning: presetById(id)!, bandTunings: [], songEvents: [] });

  it("tuning-unknown names the paste, the song and the row", () => {
    const r = readTab(staff("CFAD", ["-5-", "---", "---", "---"]), context("bass4-e"));
    expect(r.kind === "refused" && r.refusals[0].reason).toMatch(/C F A D/);
    expect(r.kind === "refused" && r.refusals[0].reason).toMatch(/G D A E/);
  });
});
