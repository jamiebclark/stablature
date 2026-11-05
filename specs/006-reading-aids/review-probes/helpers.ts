/** Shared drivers for the 006 browser probes: raw seeding of parts, variants, chords and arrangements. */
import { expect, type Page } from "@playwright/test";
import { generateNKeysBetween } from "fractional-indexing";
import { fret, startCapturing } from "../../../e2e/capture-surface-helpers";

export const VIEWS = ["frets", "notes", "intervals"] as const;
export type View = (typeof VIEWS)[number];
export const SIZES = [
  { name: "phone", width: 375, height: 667 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

export interface Col {
  kind?: "notes" | "rest" | "barline";
  d?: string | null;
  repeat?: number;
  frets?: Record<string, number | "x">;
  techniques?: Record<string, string[]>;
  tupletId?: string | null;
  tupletCount?: number | null;
  groupKind?: "tuplet" | "plain" | null;
  chord?: string;
}
export interface PartSpec {
  key: string;
  label: string;
  name?: string | null;
  variantOf?: string;
  columns: Col[];
}
export interface EntrySpec {
  part?: string;
  kind?: "part" | "text";
  repeat?: number;
  fromBar?: number | null;
  toBar?: number | null;
  last?: string | null;
  label?: string | null;
}

export const n = (fret: number, over: Col = {}): Col => ({ frets: { 2: fret }, ...over });
export const bar = (): Col => ({ kind: "barline" });
export const g = (id: string, fret: number, over: Col = {}): Col => n(fret, { tupletId: id, tupletCount: 3, groupKind: "tuplet", ...over });

const STORE = `
  const all = (name) => new Promise((res, rej) => {
    const r = db.transaction(name).objectStore(name).getAll();
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const write = (name, fn) => new Promise((res, rej) => {
    const tx = db.transaction(name, "readwrite");
    fn(tx.objectStore(name));
    tx.oncomplete = () => res(undefined);
    tx.onerror = () => rej(tx.error);
  });
`;

/** One raw run against the app's database. Dexie cannot see it: reload, or call `landed`. */
export const idb = <T>(page: Page, body: string, arg?: unknown) =>
  page.evaluate(
    ([source, a]) =>
      new Promise<T>((resolve, reject) => {
        const open = indexedDB.open("stablature");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const run = new Function("db", "arg", `return (async () => { ${source} })()`) as (d: IDBDatabase, x: unknown) => Promise<T>;
          run(db, a).then(
            (v) => (db.close(), resolve(v)),
            (e) => (db.close(), reject(e)),
          );
        };
      }),
    [`${STORE} ${body}`, arg] as const,
  );

/** What a sync landing looks like to the screen: every live query runs again. */
export const landed = (page: Page) =>
  page.evaluate(() => {
    const channel = new BroadcastChannel("x-storagemutated-1");
    channel.postMessage({ all: {} });
    channel.close();
  });

export const dump = (page: Page) =>
  idb<string>(page, `const out = {}; for (const name of Array.from(db.objectStoreNames).sort()) out[name] = await all(name); return JSON.stringify(out);`);

const idsFrom = (partUrl: string) => /\/songs\/([0-9a-f-]+)\/capture\/([0-9a-f-]+)/.exec(partUrl)!;

/** A band and a song holding exactly `parts` and `entries`, on the seeded B Standard (G D A E B). */
export async function seedSong(page: Page, parts: PartSpec[], entries: EntrySpec[] = []) {
  const { songUrl, partUrl } = await startCapturing(page);
  const songId = idsFrom(partUrl)[1];
  await fret(page, "E", 7).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(1);
  await page.goto(songUrl);
  await page.getByRole("button", { name: "Each part once" }).click();
  await expect(page.getByTestId("roadmap-chip")).toHaveCount(1);
  await page.waitForTimeout(150);

  const partRanks = generateNKeysBetween(null, null, parts.length);
  const entryRanks = generateNKeysBetween(null, null, Math.max(1, entries.length));
  const columnRanks = Object.fromEntries(parts.map((p) => [p.key, generateNKeysBetween(null, null, p.columns.length)]));
  const ids = await idb<{ parts: Record<string, string>; events: Record<string, string[]> }>(
    page,
    `
    const { parts, entries, partRanks, entryRanks, columnRanks, songId } = arg;
    const [templatePart] = (await all("parts")).filter((r) => r.songId === songId);
    const [templateEvent] = (await all("events")).filter((r) => r.partId === templatePart.id);
    const [templateEntry] = (await all("arrangementEntries")).filter((r) => r.songId === songId);
    const meta = { updatedAt: templateEvent.updatedAt, deletedAt: null, fieldClocks: {}, serverSeq: templateEvent.serverSeq };
    const partIds = {};
    parts.forEach((p) => { partIds[p.key] = crypto.randomUUID(); });
    const eventIds = {};
    await write("events", (s) => {
      s.delete(templateEvent.id);
      for (const p of parts) {
        eventIds[p.key] = [];
        p.columns.forEach((c, i) => {
          const id = crypto.randomUUID();
          eventIds[p.key].push(id);
          s.put({
            ...templateEvent, id, partId: partIds[p.key], rank: columnRanks[p.key][i], kind: c.kind ?? "notes",
            frets: c.kind === "barline" || c.kind === "rest" ? {} : (c.frets ?? { 2: 5 }),
            techniques: c.techniques ?? {}, repeat: c.repeat ?? 1, durationHint: c.d ?? null,
            tupletId: c.tupletId ?? null, tupletCount: c.tupletCount ?? null, groupKind: c.groupKind ?? null,
          });
        });
      }
    });
    await write("annotations", (s) => {
      for (const p of parts) p.columns.forEach((c, i) => {
        if (c.chord === undefined) return;
        s.put({ ...meta, id: crypto.randomUUID(), bandId: templateEvent.bandId, partId: partIds[p.key], anchorEventId: eventIds[p.key][i], kind: "chord", value: c.chord });
      });
    });
    await write("parts", (s) => {
      s.delete(templatePart.id);
      parts.forEach((p, i) => s.put({
        ...templatePart, id: partIds[p.key], label: p.label, name: p.name ?? null, rank: partRanks[i],
        variantOfPartId: p.variantOf ? (partIds[p.variantOf] ?? p.variantOf) : null,
      }));
    });
    await write("arrangementEntries", (s) => {
      s.delete(templateEntry.id);
      entries.forEach((e, i) => s.put({
        ...templateEntry, id: crypto.randomUUID(), rank: entryRanks[i], kind: e.kind ?? "part",
        partId: e.part ? partIds[e.part] : null, repeat: e.repeat ?? 1, fromBar: e.fromBar ?? null, toBar: e.toBar ?? null,
        lastRepeatPartId: e.last ? partIds[e.last] : null, label: e.label ?? null,
      }));
    });
    return { parts: partIds, events: eventIds };
    `,
    { parts, entries, partRanks, entryRanks, columnRanks, songId },
  );
  await page.goto(songUrl);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible();
  return { songUrl, playUrl: `${songUrl}/play`, songId, ...ids };
}

export const choose = async (page: Page, view: View) => {
  await page.getByTestId(`staff-view-${view}`).click();
  await expect(page.getByTestId(`staff-view-${view}`)).toHaveAttribute("aria-pressed", "true");
};

export const remember = (page: Page, view: string) =>
  page.evaluate((v) => localStorage.setItem("stablature.staffView", v), view);

/** WCAG contrast of two `rgb(...)` strings. */
export function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const [r, g2, bl] = (c.match(/[\d.]+/g) ?? []).map(Number).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g2 + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
