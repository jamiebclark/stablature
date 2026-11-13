import { describe, expect, it } from "vitest";
import { pendingWords, signInKnowledge, SAVED_HERE, SAVED_HERE_SHORT, SAVED_HERE_NAME } from "../saving";

type S = Parameters<typeof signInKnowledge>[0];
const pendingSession: S = { data: null, isPending: true, error: null };
const noSession: S = { data: null, isPending: false, error: null };
const unauthorised: S = { data: null, isPending: false, error: { status: 401 } };
const netFail: S = { data: null, isPending: false, error: { status: 0 } };
const netFailNoStatus: S = { data: null, isPending: false, error: {} };
const signedIn: S = { data: { user: {} }, isPending: false, error: null };
const signedInThenNetFail: S = { data: { user: {} }, isPending: false, error: { status: 0 } };

// [label, session, expected for each sync state: idle, syncing, offline, signed-out, error, undefined]
const table: [string, S, string[]][] = [
  ["pending", pendingSession, ["unknown", "unknown", "unknown", "signed-out", "unknown", "unknown"]],
  ["no session", noSession, ["signed-out", "signed-out", "signed-out", "signed-out", "signed-out", "signed-out"]],
  ["401", unauthorised, ["signed-out", "signed-out", "signed-out", "signed-out", "signed-out", "signed-out"]],
  ["network failure", netFail, ["unknown", "unknown", "unknown", "signed-out", "unknown", "unknown"]],
  ["error without status", netFailNoStatus, ["unknown", "unknown", "unknown", "signed-out", "unknown", "unknown"]],
  ["signed in", signedIn, ["signed-in", "signed-in", "signed-in", "signed-out", "signed-in", "signed-in"]],
  ["signed in, then offline", signedInThenNetFail, ["unknown", "unknown", "unknown", "signed-out", "unknown", "unknown"]],
];
const states = ["idle", "syncing", "offline", "signed-out", "error", undefined] as const;

describe("signInKnowledge", () => {
  for (const [label, session, expected] of table) {
    states.forEach((state, i) => {
      it(`${label} × ${state ?? "undefined"} → ${expected[i]}`, () => {
        expect(signInKnowledge(session, state)).toBe(expected[i]);
      });
    });
  }
});

describe("pendingWords", () => {
  const rows: [string, number | undefined, unknown][] = [
    ["signed-in", undefined, null],
    ["signed-in", 0, null],
    ["signed-in", 1, { count: 1 }],
    ["signed-in", 14, { count: 14 }],
    ["unknown", undefined, null],
    ["unknown", 0, null],
    ["unknown", 1, { count: 1 }],
    ["unknown", 14, { count: 14 }],
    ["signed-out", undefined, null],
    ["signed-out", 0, null],
    ["signed-out", 1, "saved-here"],
    ["signed-out", 14, "saved-here"],
  ];
  for (const [k, p, want] of rows) {
    it(`${k} × ${p} → ${JSON.stringify(want)}`, () => {
      expect(pendingWords(k as "signed-in", p)).toEqual(want);
    });
  }
});

it("words", () => {
  expect(SAVED_HERE).toBe("Saved on this device");
  expect(SAVED_HERE_SHORT).toBe("saved · sign in");
  expect(SAVED_HERE_NAME).toBe("Saved on this device. Sign in to sync with your band.");
});
