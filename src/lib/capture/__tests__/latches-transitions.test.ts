import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/model";
import type { CursorTarget } from "../target";
import {
  LATCHES,
  armLatch,
  cursorPending,
  litLatches,
  nextNote,
  prunedArmed,
  statusFor,
  type LatchId,
} from "../latches";

const event = {
  id: "e1",
  bandId: "b",
  partId: "p",
  rank: "a",
  kind: "notes",
  frets: {},
  techniques: {},
  repeat: 1,
  durationHint: null,
  tupletId: null,
  tupletCount: null,
  updatedAt: "",
  deletedAt: null,
  fieldClocks: {},
  serverSeq: 0,
} as EventRow;

const TRANSITION_IDS: LatchId[] = ["hammer_on", "pull_off", "slide_up", "slide_down"];
const ALL: LatchId[] = ["stack", ...TRANSITION_IDS];

// INV-010: arming
describe("armLatch", () => {
  for (const a of TRANSITION_IDS) {
    for (const b of TRANSITION_IDS) {
      if (a === b) continue;
      it(`arming ${b} while ${a} is armed replaces it`, () => {
        expect([...armLatch(new Set([a]), b)]).toEqual([b]);
      });
    }
    it(`tapping ${a} twice disarms it`, () => {
      expect(armLatch(armLatch(new Set(), a), a).size).toBe(0);
    });
    it(`stack and ${a} coexist in either order`, () => {
      expect(new Set(armLatch(new Set<LatchId>(["stack"]), a))).toEqual(new Set(["stack", a]));
      expect(new Set(armLatch(new Set<LatchId>([a]), "stack"))).toEqual(new Set(["stack", a]));
    });
  }
});

// INV-011 (derivation)
describe("litLatches over every target", () => {
  const targets: Record<string, CursorTarget> = {
    note: { kind: "playable", event },
    rest: { kind: "playable", event: { ...event, frets: {} } },
    barline: { kind: "barline", event: { ...event, kind: "barline" } },
    start: { kind: "no-column" },
    empty: { kind: "no-column" },
    none: { kind: "no-part" },
  };
  for (const id of ALL) {
    for (const [name, target] of Object.entries(targets)) {
      it(`${id} on ${name}`, () => {
        const lit = litLatches(new Set([id]), target);
        const expected =
          id === "stack"
            ? target.kind === "playable"
            : target.kind === "playable" || target.kind === "barline";
        expect(lit.has(id)).toBe(expected);
      });
    }
  }
});

describe("nextNote", () => {
  const playable: CursorTarget = { kind: "playable", event };
  it("plain: inserts, no techniques, consumes nothing", () => {
    expect(nextNote(new Set(), playable)).toEqual({ stackOnto: null, techniques: [], consumed: [] });
  });
  it("stack alone stacks and stays armed", () => {
    const n = nextNote(new Set<LatchId>(["stack"]), playable);
    expect(n.stackOnto).toBe(event);
    expect(n.consumed).toEqual([]);
  });
  it("a transition inserts and is consumed", () => {
    const n = nextNote(new Set<LatchId>(["slide_up"]), playable);
    expect(n).toEqual({ stackOnto: null, techniques: ["slide_up"], consumed: ["slide_up"] });
  });
  it("stack + transition stacks, stores it, consumes only the transition", () => {
    const n = nextNote(new Set<LatchId>(["stack", "pull_off"]), playable);
    expect(n.stackOnto).toBe(event);
    expect(n.techniques).toEqual(["pull_off"]);
    expect(n.consumed).toEqual(["pull_off"]);
  });
});

describe("statusFor", () => {
  it("is null when nothing is lit", () => expect(statusFor(new Set())).toBeNull());
  it("keeps stack's exact text", () =>
    expect(statusFor(new Set<LatchId>(["stack"]))).toBe("stacking onto the marked column"));
  it("names each transition", () => {
    expect(statusFor(new Set<LatchId>(["hammer_on"]))).toBe("next note: hammer-on");
    expect(statusFor(new Set<LatchId>(["pull_off"]))).toBe("next note: pull-off");
    expect(statusFor(new Set<LatchId>(["slide_up"]))).toBe("next note: slide up");
    expect(statusFor(new Set<LatchId>(["slide_down"]))).toBe("next note: slide down");
  });
  it("combines short forms", () =>
    expect(statusFor(new Set<LatchId>(["stack", "hammer_on"]))).toBe("stack + hammer-on"));
});

describe("pending prune", () => {
  it("is pending only while the cursor names an undelivered column", () => {
    expect(cursorPending(null, undefined, null)).toBe(false);
    expect(cursorPending("x", "x", "x")).toBe(false);
    expect(cursorPending("new", undefined, "old")).toBe(true);
  });
  it("keeps armed while pending, prunes otherwise", () => {
    const armed = new Set<LatchId>(["stack"]);
    const lit = new Set<LatchId>();
    expect(prunedArmed(armed, lit, true)).toBe(armed);
    expect(prunedArmed(armed, lit, false)).toBe(lit);
    expect(prunedArmed(armed, armed, false)).toBe(armed);
  });
});

describe("declared latches", () => {
  it("labels transitions by glyph, in order", () => {
    expect(LATCHES.map((l) => l.label)).toEqual(["stack", "h", "p", "/", "\\"]);
  });
});
