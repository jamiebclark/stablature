/**
 * The seeded song builder of `src/lib/rhythm/__tests__/notation-oracle.test.ts` section G, copied verbatim (lines
 * 189 to 327 on this branch) so a probe can walk the same 6000 arrangements without running that file's tests.
 */
import type { ArrangementEntryRow, EventRow } from "@/lib/model";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return (s >>> 8) / 16777216;
  };
}

let serial = 0;
function row(over: Partial<EventRow>): EventRow {
  serial += 1;
  return {
    id: `e${serial}`,
    bandId: "b",
    partId: "p",
    rank: String(serial).padStart(8, "0"),
    kind: "notes",
    frets: { "0": 5 },
    techniques: {},
    repeat: 1,
    durationHint: "q",
    tupletId: null,
    tupletCount: null,
    groupKind: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
    ...over,
  } as EventRow;
}

function entry(over: Partial<ArrangementEntryRow>): ArrangementEntryRow {
  serial += 1;
  return {
    id: `a${serial}`,
    bandId: "b",
    songId: "s",
    rank: String(serial).padStart(8, "0"),
    kind: "part",
    partId: null,
    repeat: 1,
    fromBar: null,
    toBar: null,
    lastRepeatPartId: null,
    label: null,
    updatedAt: "x",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
    ...over,
  } as ArrangementEntryRow;
}

const D = ["w", "h", "q", "8", "16", "32"];
const UNKNOWN: unknown[] = ["64", "", "Q", 7, true];

function buildPart(r: () => number, id: string, gaps: number): EventRow[] {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const out: EventRow[] = [];
  const duration = () => (r() < gaps ? (r() < 0.5 ? null : pick(UNKNOWN)) : pick(D)) as EventRow["durationHint"];
  const pieces = Math.floor(r() * 9);
  for (let i = 0; i < pieces; i++) {
    const roll = r();
    if (roll < 0.28) out.push(row({ partId: id, kind: "barline", frets: {}, durationHint: null }));
    else if (roll < 0.62) {
      out.push(
        row({
          partId: id,
          kind: r() < 0.25 ? "rest" : "notes",
          frets: r() < 0.2 ? {} : { "0": 5 },
          durationHint: duration(),
          repeat: r() < 0.2 ? 1 + Math.floor(r() * 8) : 1,
        }),
      );
    } else {
      const counted = r() < 0.7;
      const n = pick([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 1]);
      const size = r() < 0.85 ? n : Math.max(1, n + (r() < 0.5 ? -1 : 1));
      const gid = `${id}-g${i}`;
      const d = pick(D) as EventRow["durationHint"];
      for (let k = 0; k < Math.min(size, 16); k++) {
        const legacy = r() < 0.08;
        out.push(
          row({
            partId: id,
            durationHint: r() < gaps / 3 ? null : d,
            tupletId: gid,
            tupletCount: counted ? (legacy && n === 3 ? null : r() < 0.03 ? n + 1 : n) : null,
            groupKind: counted ? (legacy ? null : "tuplet") : r() < 0.03 ? null : "plain",
            repeat: r() < 0.05 ? 2 : 1,
            kind: r() < 0.15 ? "rest" : "notes",
          }),
        );
        if (r() < 0.12) out.push(row({ partId: id, kind: "barline", frets: {}, durationHint: null }));
      }
    }
  }
  return out;
}

export function buildSong(seed: number) {
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const gaps = pick([0, 0, 0.02, 0.1]);
  const ids = ["A", "B", "C"];
  const byPart: Record<string, EventRow[]> = {};
  for (const id of ids) byPart[id] = buildPart(r, id, gaps);
  const entries: ArrangementEntryRow[] = [];
  let open = 0;
  const count = 1 + Math.floor(r() * 7);
  for (let i = 0; i < count; i++) {
    const roll = r();
    if (roll < 0.14) {
      entries.push(entry({ kind: "section_start", repeat: 1 + Math.floor(r() * 3) }));
      open++;
    } else if (roll < 0.26) {
      entries.push(entry({ kind: "section_end" }));
      open = Math.max(0, open - 1);
    } else if (roll < 0.33) {
      entries.push(entry({ kind: "text", label: "x" }));
    } else {
      const ranged = r() < 0.35;
      const from = ranged && r() < 0.8 ? 1 + Math.floor(r() * 3) : null;
      const to = ranged && r() < 0.8 ? (from ?? 1) + Math.floor(r() * 3) : null;
      entries.push(
        entry({
          kind: "part",
          partId: pick(ids),
          repeat: 1 + Math.floor(r() * 3),
          fromBar: from,
          toBar: to,
          lastRepeatPartId: r() < 0.3 ? pick(ids) : null,
        }),
      );
    }
  }
  return { entries, byPart };
}
