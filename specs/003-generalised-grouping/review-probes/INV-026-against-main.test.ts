/**
 * INV-026 / SC-010 / US4 scenario 6: the previous entry's 7 nothing-armed routes through this
 * branch's editing.ts and through main's, same clock, whole rows and outbox compared. The only
 * permitted difference is the new field: `groupKind: null` and its clock.
 *
 * Main's file comes from `git show` and sits beside this probe for the length of the run.
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
  const source = execFileSync("git", ["show", "HEAD:src/lib/local/editing.ts"], {
    encoding: "utf8",
  });
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

/**
 * Remove the one permitted difference, having first proved it is exactly that. Both sides share
 * this branch's MERGEABLE_FIELDS, so main's rows are stamped with the clock too; only the value
 * is ours alone.
 */
function withoutTheField(row: EventRow, ours: boolean): Record<string, unknown> {
  if (ours) expect(row.groupKind).toBeNull();
  else expect('groupKind' in row).toBe(false);
  const rest: Partial<EventRow> = { ...row };
  delete rest.groupKind;
  const clocks: Record<string, string> = { ...row.fieldClocks };
  delete clocks.groupKind;
  return { ...rest, fieldClocks: clocks };
}

async function run(lib: Editing, route: Route, ours: boolean) {
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
  const shape = (r: EventRow) => withoutTheField(r, ours);
  return normalise({
    events: events.map(shape),
    outbox: outbox.map((e) => ({
      ...e,
      row: e.table === "events" ? shape(e.row as EventRow) : e.row,
    })),
  });
}

describe("INV-026: this branch against main", () => {
  for (const [name, route] of Object.entries(ROUTES)) {
    it(name, async () => {
      const ours = await run(branch, route, true);
      const theirs = await run(main, route, false);
      expect((ours as { events: unknown[] }).events.length).toBeGreaterThan(0);
      expect(ours).toEqual(theirs);
    });
  }
});
