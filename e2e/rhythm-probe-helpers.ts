/** Shared drivers for the 005 browser probes: a fuller recorder, and raw seeding of notated songs. */
import { expect, type Page } from "@playwright/test";
import { generateNKeysBetween } from "fractional-indexing";
import { fret, startCapturing } from "./capture-surface-helpers";

export interface Rec {
  contexts: number;
  resumes: { inTap: boolean }[];
  madeInTap: boolean[];
  starts: { when: number; hz: number; at: number; now: number }[];
  stops: { when: number | null; at: number }[];
  closes: number;
  audioSessionWrites: number;
  mediaPlays: number;
  newAudios: number;
  wakeRequests: number;
  wakeResolved: number;
  wakeReleases: number;
}

export interface RecorderOptions {
  audio?: "ok" | "absent" | "throws" | "never-resumes" | "slow-resume";
  wakeLock?: "ok" | "rejects" | "absent" | "late";
}

type Win = Window & {
  __rec: Rec;
  __ctxs: AudioContext[];
  __wake: (() => void)[];
};

/** Installed before navigation. Counts constructions, because `state` proves nothing in headless. */
export async function recorder(page: Page, opts: RecorderOptions = {}) {
  await page.addInitScript((o) => {
    const w = window as unknown as Win;
    const rec: Rec = {
      contexts: 0,
      resumes: [],
      madeInTap: [],
      starts: [],
      stops: [],
      closes: 0,
      audioSessionWrites: 0,
      mediaPlays: 0,
      newAudios: 0,
      wakeRequests: 0,
      wakeResolved: 0,
      wakeReleases: 0,
    };
    w.__rec = rec;
    w.__ctxs = [];
    w.__wake = [];
    // True from the click's capture phase until the next task.
    let inTap = false;
    document.addEventListener(
      "click",
      () => {
        inTap = true;
        setTimeout(() => (inTap = false), 0);
      },
      true,
    );
    const Base = window.AudioContext;
    if (o.audio === "absent") {
      // @ts-expect-error removing the constructor on purpose
      delete window.AudioContext;
      // @ts-expect-error webkit alias
      delete window.webkitAudioContext;
    } else if (o.audio === "throws") {
      window.AudioContext = class {
        constructor() {
          throw new Error("no audio here");
        }
      } as unknown as typeof AudioContext;
    } else {
      window.AudioContext = class extends Base {
        constructor(...args: ConstructorParameters<typeof AudioContext>) {
          super(...args);
          rec.contexts++;
          rec.madeInTap.push(inTap);
          w.__ctxs.push(this);
        }
        resume() {
          rec.resumes.push({ inTap });
          if (o.audio === "never-resumes") return new Promise<void>(() => {});
          if (o.audio === "slow-resume") {
            return new Promise<void>((done) => setTimeout(done, 400)).then(() => super.resume());
          }
          return super.resume();
        }
        close() {
          rec.closes++;
          return super.close();
        }
      };
    }
    const proto = AudioScheduledSourceNode.prototype;
    const start = proto.start;
    const stop = proto.stop;
    proto.start = function (this: AudioScheduledSourceNode, when?: number) {
      const hz = (this as OscillatorNode).frequency?.value ?? 0;
      const now = this.context.currentTime;
      rec.starts.push({ when: when ?? 0, hz, at: performance.now(), now });
      return start.call(this, when);
    };
    proto.stop = function (this: AudioScheduledSourceNode, when?: number) {
      rec.stops.push({ when: when ?? null, at: performance.now() });
      return stop.call(this, when);
    };
    Object.defineProperty(navigator, "audioSession", {
      configurable: true,
      value: new Proxy({}, { set: () => (rec.audioSessionWrites++, true) }),
    });
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      rec.mediaPlays++;
      return play.call(this);
    };
    const NativeAudio = window.Audio;
    window.Audio = function (...args: ConstructorParameters<typeof Audio>) {
      rec.newAudios++;
      return new NativeAudio(...args);
    } as unknown as typeof Audio;
    if (o.wakeLock === "absent") {
      Object.defineProperty(navigator, "wakeLock", { configurable: true, value: undefined });
    } else {
      const sentinel = () => ({
        release: () => {
          rec.wakeReleases++;
          return Promise.resolve();
        },
      });
      Object.defineProperty(navigator, "wakeLock", {
        configurable: true,
        value: {
          request: () => {
            rec.wakeRequests++;
            if (o.wakeLock === "rejects") return Promise.reject(new Error("denied"));
            if (o.wakeLock === "late") {
              return new Promise((done) =>
                w.__wake.push(() => {
                  rec.wakeResolved++;
                  done(sentinel());
                }),
              );
            }
            rec.wakeResolved++;
            return Promise.resolve(sentinel());
          },
        },
      });
    }
  }, opts);
}

export const rec = (page: Page) => page.evaluate(() => (window as unknown as Win).__rec);

/** Resolve every wake lock request held back by `wakeLock: "late"`. */
export const resolveWake = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as Win;
    for (const done of w.__wake.splice(0)) done();
  });

/** The device takes the audio: the context reports `state` and fires `statechange`. */
export const deviceSets = (page: Page, state: "suspended" | "interrupted" | "closed") =>
  page.evaluate(async (s) => {
    const ctx = (window as unknown as Win).__ctxs.at(-1)!;
    if (s === "suspended") return void (await ctx.suspend());
    if (s === "closed") return void (await ctx.close());
    Object.defineProperty(ctx, "state", { configurable: true, get: () => s });
    ctx.dispatchEvent(new Event("statechange"));
  }, state);

/** One raw store write, for rows the UI cannot make. Reload afterwards: Dexie cannot see it. */
export const idb = <T>(page: Page, body: string, arg?: unknown) =>
  page.evaluate(
    ([source, a]) =>
      new Promise<T>((resolve, reject) => {
        const open = indexedDB.open("stablature");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const run = new Function("db", "arg", `return (async () => { ${source} })()`) as (
            d: IDBDatabase,
            x: unknown,
          ) => Promise<T>;
          run(db, a).then(
            (v) => (db.close(), resolve(v)),
            (e) => (db.close(), reject(e)),
          );
        };
      }),
    [body, arg] as const,
  );

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

/**
 * What a sync landing looks like to the screen: every live query runs again. Dexie cannot see a raw
 * write, so a probe writes the row and then says so on the channel Dexie itself listens to.
 */
export const landed = (page: Page) =>
  page.evaluate(() => {
    const channel = new BroadcastChannel("x-storagemutated-1");
    channel.postMessage({ all: {} });
    channel.close();
  });

/** A write from "another device": the raw row, then the live queries run again. */
export async function fromAnotherDevice(page: Page, body: string, arg?: unknown) {
  await idb(page, `${STORE} ${body}`, arg);
  await landed(page);
}

export const patchEvent = (page: Page, index: number, patch: Record<string, unknown>) =>
  fromAnotherDevice(
    page,
    `const rows = (await all("events")).filter((r) => !r.deletedAt).sort((a, b) => (a.rank < b.rank ? -1 : 1));
     await write("events", (s) => s.put({ ...rows[arg.index], ...arg.patch }));`,
    { index, patch },
  );

export const patchSong = (page: Page, patch: Record<string, unknown>) =>
  fromAnotherDevice(
    page,
    `const rows = await all("songs");
     await write("songs", (s) => { for (const r of rows) s.put({ ...r, ...arg.patch }); });`,
    { patch },
  );

export const outbox = (page: Page) =>
  idb<{ table: string; rowId: string; row: Record<string, unknown> }[]>(
    page,
    `${STORE} return all("outbox");`,
  );

export const eventRows = (page: Page) =>
  idb<Record<string, unknown>[]>(page, `${STORE} return all("events");`);

export const songRows = (page: Page) =>
  idb<Record<string, unknown>[]>(page, `${STORE} return all("songs");`);

/** Every store as one JSON string, for before/after identity. */
export const dump = (page: Page) =>
  idb<string>(
    page,
    `${STORE}
     const out = {};
     for (const name of Array.from(db.objectStoreNames).sort()) out[name] = await all(name);
     return JSON.stringify(out);`,
  );

export const setStoredTempo = (page: Page, bpm: unknown) =>
  idb(
    page,
    `${STORE}
     const rows = await all("songs");
     await write("songs", (s) => { for (const r of rows) s.put({ ...r, bpm: arg.bpm }); });`,
    { bpm },
  );

export interface Col {
  kind?: "notes" | "rest" | "barline";
  /** The stored duration, anything at all. `__absent__` removes the field. */
  d?: unknown;
  repeat?: number;
  frets?: Record<string, number | "x">;
  techniques?: Record<string, string[]>;
  tupletId?: string | null;
  tupletCount?: number | null;
  groupKind?: "tuplet" | "plain" | null;
}

/** Shorthand: `cols("q", "q", null, "|", "8")`, where `|` is a barline. */
export const cols = (...items: (string | null)[]): Col[] =>
  items.map((i) => (i === "|" ? { kind: "barline" } : { d: i }));

/** Replaces a part's columns with raw rows. The caller reloads. */
export async function writeColumns(page: Page, partId: string, list: Col[]) {
  const ranks = generateNKeysBetween(null, null, list.length);
  await idb(
    page,
    `${STORE}
     const rows = await all("events");
     const template = rows.find((r) => r.partId === arg.partId) ?? rows[0];
     const old = rows.filter((r) => r.partId === arg.partId);
     await write("events", (s) => {
       for (const r of old) s.delete(r.id);
       arg.list.forEach((c, i) => {
         const row = {
           ...template,
           id: crypto.randomUUID(),
           partId: arg.partId,
           rank: arg.ranks[i],
           kind: c.kind ?? "notes",
           frets: c.kind === "barline" ? {} : (c.frets ?? { 0: 5 }),
           techniques: c.techniques ?? {},
           repeat: c.repeat ?? 1,
           durationHint: null,
           tupletId: c.tupletId ?? null,
           tupletCount: c.tupletCount ?? null,
           groupKind: c.groupKind ?? null,
         };
         if ("d" in c) {
           if (c.d === "__absent__") delete row.durationHint;
           else row.durationHint = c.d;
         }
         s.put(row);
       });
     });`,
    { partId, list, ranks },
  );
}

const idsFrom = (partUrl: string) => {
  const m = /\/songs\/([0-9a-f-]+)\/capture\/([0-9a-f-]+)/.exec(partUrl)!;
  return { songId: m[1], partId: m[2] };
};

/** A band, a song and a part, with `list` as its columns, and an arrangement of one pass. */
export async function seed(
  page: Page,
  list: Col[],
  opts: { bpm?: unknown; arrange?: boolean; passes?: number } = {},
) {
  const { songUrl, partUrl } = await startCapturing(page);
  const { songId, partId } = idsFrom(partUrl);
  await fret(page, "E", 7).click();
  await expect(page.getByTestId("tab-column")).toHaveCount(1);
  if (opts.arrange !== false) {
    await page.goto(songUrl);
    await page.getByRole("button", { name: "Each part once" }).click();
    await page.waitForTimeout(150);
  }
  await writeColumns(page, partId, list);
  if ("bpm" in opts) await setStoredTempo(page, opts.bpm);
  if ((opts.passes ?? 1) > 1) {
    await idb(
      page,
      `${STORE}
       const rows = await all("arrangementEntries");
       await write("arrangementEntries", (s) => { for (const r of rows) s.put({ ...r, repeat: arg.passes }); });`,
      { passes: opts.passes },
    );
  }
  return { songUrl, partUrl, songId, partId, playUrl: `${songUrl}/play` };
}

/** Tap the sheet's pad with synthetic pointer events carrying exact times. */
export async function tapAt(page: Page, times: number[]) {
  await page.getByTestId("tap-pad").evaluate((pad, ts) => {
    for (const t of ts) {
      const e = new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        pointerType: "touch",
        isPrimary: true,
      });
      Object.defineProperty(e, "timeStamp", { value: t });
      pad.dispatchEvent(e);
    }
  }, times);
}

/** Three taps that read `bpm`. */
export const tapsFor = (bpm: number) => {
  const gap = 60000 / bpm;
  return [1000, 1000 + gap, 1000 + 2 * gap];
};

export async function setTempoBySheet(page: Page, bpm: number) {
  await page.getByTestId("tempo-control").click();
  await tapAt(page, tapsFor(bpm));
  await expect(page.getByTestId("tempo-reading")).toHaveText(String(bpm));
  await page.getByTestId("tempo-set").click();
  await expect(page.locator("dialog[open]")).toHaveCount(0);
}

/** Levels by frequency, as the voices in `audio.ts` are. */
export const level = (hz: number) =>
  hz === 2000 ? "accent" : hz === 1300 ? "beat" : hz === 800 ? "soft" : `?${hz}`;

/** WCAG contrast of two `rgb(...)` strings. */
export function contrast(a: string, b: string) {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/[\d.]+/g) ?? []).map(Number).map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
