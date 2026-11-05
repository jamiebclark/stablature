/** Shared drivers for the spec 004 unit probes: a real store, real writes, real reads. */
import "fake-indexeddb/auto";

import { HlcClock } from "@/lib/hlc";
import { newId } from "@/lib/ids";
import { StablatureDb } from "@/lib/local/db";
import { createBand, createPart, createSong, createTuningFromPreset } from "@/lib/local/editing";
import { importTab } from "@/lib/local/importing";
import { insertRow } from "@/lib/local/mutate";
import { listEventsBySong, listSongs, listTunings, resolveTuning } from "@/lib/local/queries";
import type { EventRow, SongRow, TuningRow } from "@/lib/model";
import { parseTab } from "@/lib/tab/parse";
import { othersOnNull, readTab, type ReadingContext, type TabReading } from "@/lib/tab/reading";
import { presetById, type Tuning } from "@/lib/tunings";

let tick = 1_000_000;

/** A clock that throws on the Nth send, or never. */
export class Clock extends HlcClock {
  sends = 0;
  constructor(private readonly failAt: number | null = null) {
    super("probe", () => (tick += 1));
  }
  override send() {
    this.sends += 1;
    if (this.sends === this.failAt) throw new Error("probe clock failed");
    return super.send();
  }
}

export interface World {
  db: StablatureDb;
  ctx: { db: StablatureDb; clock: Clock };
  bandId: string;
  song: SongRow;
  tuning: TuningRow | null;
}

/** A band and one song. The song's `tuningId` is null when `onSong` is false. */
export async function world(
  presetId: string | null = "bass4-e",
  options: { onSong?: boolean; isDefault?: boolean } = {},
): Promise<World> {
  const db = new StablatureDb(`probe-${newId()}`);
  await db.open();
  const ctx = { db, clock: new Clock() };
  const band = await createBand("Hollow Crown", ctx);
  const tuning = presetId
    ? await createTuningFromPreset(band.id, presetById(presetId)!, options.isDefault ?? true, ctx)
    : null;
  const song = await createSong(
    band.id,
    "Dirge",
    options.onSong === false ? null : (tuning?.id ?? null),
    ctx,
  );
  return { db, ctx, bandId: band.id, song, tuning };
}

/** A band tuning from raw strings, for tunings no preset spells this way. */
export async function customTuning(w: World, tuning: Tuning, name = "Custom", isDefault = false) {
  return insertRow(
    "tunings",
    { id: newId(), bandId: w.bandId, name, strings: tuning.strings, isDefault },
    w.ctx,
  );
}

export async function contextOf(
  w: World,
  song?: Pick<SongRow, "id" | "bandId" | "tuningId">,
): Promise<ReadingContext> {
  const target = song ?? (await w.db.songs.get(w.song.id))!;
  return {
    tuning: (await resolveTuning(target, w.db)) ?? null,
    bandTunings: await listTunings(target.bandId, w.db),
    songEvents: Object.values(await listEventsBySong(target.id, w.db)).flat(),
    othersOnNull: othersOnNull(
      target,
      await listSongs(target.bandId, w.db),
      await listTunings(target.bandId, w.db),
    ),
  };
}

export async function reading(w: World, text: string): Promise<TabReading> {
  return readTab(text, await contextOf(w));
}

/** Read then write, the way the panel does. Throws if there is nothing to import. */
export async function imported(w: World, text: string) {
  const r = await reading(w, text);
  if (r.kind !== "ready") throw new Error(`not ready: ${JSON.stringify(r)}`);
  const result = await importTab(w.song, text, r.fitKey, w.ctx);
  if (result.kind !== "imported") throw new Error("not imported");
  return { reading: r, part: result.part };
}

/** A part holding one note on each listed string. */
export async function holdNotes(w: World, strings: number[], fret: number | "x" = 3) {
  const part = await createPart(w.song, w.ctx);
  for (const [i, s] of strings.entries()) {
    await insertRow(
      "events",
      {
        id: newId(),
        bandId: w.bandId,
        partId: part.id,
        rank: `a${i}`,
        kind: "notes",
        frets: { [String(s)]: fret },
        techniques: {},
        repeat: 1,
        durationHint: null,
        tupletId: null,
        tupletCount: null,
        groupKind: null,
      } as never,
      w.ctx,
    );
  }
  return part;
}

const TABLES = [
  "bands",
  "tunings",
  "songs",
  "parts",
  "events",
  "annotations",
  "arrangementEntries",
  "outbox",
  "meta",
] as const;

/** Every table, `meta` and the outbox included. */
export async function dump(w: Pick<World, "db">): Promise<string> {
  const store = w.db as unknown as Record<string, { toArray(): Promise<unknown[]> }>;
  return JSON.stringify(await Promise.all(TABLES.map((t) => store[t].toArray())));
}

/** A labelled staff, one body per row, in the app's shape. */
export const staff = (names: string, bodies: string[]) =>
  bodies.map((b, i) => `${names[i]} |${b}|`).join("\n");

export const rails = (width: number) => "-".repeat(width);

/** `body` with everything but its barlines turned to rails. */
export const emptied = (body: string) => body.replace(/[^|]/g, "-");

/** Four rows G D A E with `top` on the G row and rails on the others, barlines carried across. */
export const four = (top: string) =>
  staff("GDAE", [top, emptied(top), emptied(top), emptied(top)]);

export function clip(text: string) {
  const parsed = parseTab(text);
  if (!parsed.ok) throw new Error(parsed.refusals.map((r) => `${r.line}:${r.code}`).join(","));
  return parsed;
}

export function codes(text: string) {
  const parsed = parseTab(text);
  return parsed.ok ? [] : parsed.refusals.map((r) => r.code);
}

export const eventsOf = (w: World, partId: string): Promise<EventRow[]> =>
  w.db.events.where("partId").equals(partId).sortBy("rank");
