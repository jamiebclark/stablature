/**
 * INV-002, the comparison round 1 could not make: each of the plan's 7 nothing-armed routes run
 * through this branch's `editing.ts` and through main's, in fresh databases with the same clock,
 * and the stored rows and outbox compared whole. Only ids are normalised, so rank, every field
 * clock value and every outbox entry must match too, which is stricter than the plan asks.
 *
 * Main's file comes from `git show` and is written beside this probe for the length of the run.
 * Its relative imports are rewritten to the shared modules, none of which this branch changed.
 */
import "fake-indexeddb/auto";

import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HlcClock } from "@/lib/hlc";
import { newId } from "@/lib/ids";
import * as branch from "@/lib/local/editing";
import { StablatureDb } from "@/lib/local/db";
import { listEvents } from "@/lib/local/queries";
import type { EventRow, PartRow } from "@/lib/model";
import { presetById } from "@/lib/tunings";

type Editing = typeof branch;
type Ctx = { db: StablatureDb; clock: HlcClock };
type Route = (lib: Editing, part: PartRow, ctx: Ctx) => Promise<unknown>;

const GENERATED = path.join(__dirname, "_main-editing.generated.ts");
let main: Editing;

beforeAll(async () => {
  const source = execFileSync("git", ["show", "main:src/lib/local/editing.ts"], { encoding: "utf8" });
  writeFileSync(
    GENERATED,
    source.replace(/from "\.\.\//g, 'from "@/lib/').replace(/from "\.\//g, 'from "@/lib/local/'),
  );
  const file = "./_main-editing.generated";
  main = (await import(/* @vite-ignore */ file)) as Editing;
});

afterAll(() => rmSync(GENERATED, { force: true }));

const ROUTES: Record<string, Route> = {
  "insert at the end": async (l, p, c) => {
    const a = await l.insertNote(p, [], null, 3, 5, c);
    await l.insertNote(p, [a], a.id, 3, 7, c);
  },
  "insert mid-part": async (l, p, c) => {
    const a = await l.insertNote(p, [], null, 3, 5, c);
    const b = await l.insertNote(p, [a], a.id, 3, 9, c);
    await l.insertNote(p, [a, b], a.id, 3, 7, c);
  },
  "insert at the start": async (l, p, c) => {
    const a = await l.insertNote(p, [], null, 3, 5, c);
    await l.insertNote(p, [a], null, 3, 7, c);
  },
  "insert after a barline": async (l, p, c) => {
    const a = await l.insertNote(p, [], null, 3, 5, c);
    const bar = await l.insertBarline(p, [a], a.id, c);
    await l.insertNote(p, [a, bar], bar.id, 3, 7, c);
  },
  "stack on a new string": async (l, p, c) => {
    const a = await l.insertNote(p, [], null, 3, 5, c);
    await l.stackNote(a, 2, 7, c);
  },
  "stack on a rest": async (l, p, c) => {
    const a = await l.insertRest(p, [], null, c);
    await l.stackNote(a, 3, 7, c);
  },
  "stack replacing a plain note": async (l, p, c) => {
    const a = await l.insertNote(p, [], null, 3, 5, c);
    await l.stackNote(a, 3, 7, c);
  },
};

/** Ids are random, so each becomes its order of first appearance. Nothing else is touched. */
function normalise(value: unknown): unknown {
  const seen = new Map<string, string>();
  const text = JSON.stringify(value).replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
    (id) => {
      if (!seen.has(id)) seen.set(id, `#${seen.size}`);
      return seen.get(id)!;
    },
  );
  return JSON.parse(text);
}

async function run(lib: Editing, route: Route) {
  const db = new StablatureDb(`main-cmp-${newId()}`);
  await db.open();
  let now = 1_000_000;
  const ctx = { db, clock: new HlcClock("probe", () => (now += 1)) };
  const band = await lib.createBand("Hollow Crown", ctx);
  const tuning = await lib.createTuningFromPreset(band.id, presetById("bass5-b")!, true, ctx);
  const song = await lib.createSong(band.id, "Dirge", tuning.id, ctx);
  const part = await lib.createPart(song, ctx);
  await route(lib, part, ctx);
  const events: EventRow[] = await listEvents(part.id, db);
  const outbox = await db.outbox.toArray();
  db.close();
  return normalise({ events, outbox });
}

describe("INV-002: this branch against main, whole rows and outbox", () => {
  for (const [name, route] of Object.entries(ROUTES)) {
    it(name, async () => {
      const ours = await run(branch, route);
      const theirs = await run(main, route);
      expect(ours).toEqual(theirs);
      expect((ours as { events: unknown[] }).events.length).toBeGreaterThan(0);
    });
  }
});
