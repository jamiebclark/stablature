/** Shared drivers for the click specs: an audio recorder and a seeded, playable song. */
import { expect, type Page } from "@playwright/test";
import { fret, startCapturing } from "./capture-surface-helpers";

export interface Recorded {
  contexts: { at: number }[];
  starts: { when: number; hz: number; at: number }[];
  stops: { when: number | null; at: number }[];
  closes: number;
  states: string[];
  audioSessionWrites: number;
  mediaPlays: number;
  newAudios: number;
  wakeRequests: number;
  wakeReleases: number;
}

/** Installed before any navigation. It must `goto` a real URL: init scripts do not run under setContent. */
export async function installRecorder(
  page: Page,
  opts: { audio?: "ok" | "absent" | "throws" | "never-resumes"; wakeLock?: "ok" | "rejects" } = {},
) {
  await page.addInitScript((o) => {
    const rec: Recorded = {
      contexts: [],
      starts: [],
      stops: [],
      closes: 0,
      states: [],
      audioSessionWrites: 0,
      mediaPlays: 0,
      newAudios: 0,
      wakeRequests: 0,
      wakeReleases: 0,
    };
    (window as unknown as { __rec: Recorded }).__rec = rec;
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
          rec.contexts.push({ at: performance.now() });
          ((window as unknown as { __ctxs?: AudioContext[] }).__ctxs ??= []).push(this);
          if (o.audio === "never-resumes") {
            this.resume = () => new Promise(() => {});
          }
          this.addEventListener("statechange", () => rec.states.push(this.state));
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
      rec.starts.push({ when: when ?? 0, hz, at: performance.now() });
      return start.call(this, when);
    };
    proto.stop = function (this: AudioScheduledSourceNode, when?: number) {
      rec.stops.push({ when: when ?? null, at: performance.now() });
      return stop.call(this, when);
    };
    Object.defineProperty(navigator, "audioSession", {
      configurable: true,
      value: new Proxy(
        {},
        {
          set() {
            rec.audioSessionWrites++;
            return true;
          },
        },
      ),
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
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: () => {
          rec.wakeRequests++;
          if (o.wakeLock === "rejects") return Promise.reject(new Error("denied"));
          return Promise.resolve({
            release: () => {
              rec.wakeReleases++;
              return Promise.resolve();
            },
          });
        },
      },
    });
  }, opts);
}

export const recorded = (page: Page) =>
  page.evaluate(() => (window as unknown as { __rec: Recorded }).__rec);

/** Every store of the app database as one JSON string, for before/after identity checks. */
export const dumpDb = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open("stablature");
        open.onerror = () => reject(open.error);
        open.onsuccess = async () => {
          const db = open.result;
          const out: Record<string, unknown[]> = {};
          for (const name of Array.from(db.objectStoreNames).sort()) {
            out[name] = await new Promise<unknown[]>((res) => {
              const r = db.transaction(name).objectStore(name).getAll();
              r.onsuccess = () => res(r.result);
            });
          }
          db.close();
          resolve(JSON.stringify(out));
        };
      }),
  );

/** Dispatch a tempo tap sequence at 120 bpm through the tempo sheet, then set it. */
export async function setTempo120(page: Page) {
  await page.getByTestId("tempo-control").click();
  await page.getByTestId("tap-pad").evaluate((pad) => {
    for (const t of [1000, 1500, 2000]) {
      const e = new PointerEvent("pointerdown", { bubbles: true, cancelable: true, pointerType: "touch", isPrimary: true });
      Object.defineProperty(e, "timeStamp", { value: t });
      pad.dispatchEvent(e);
    }
  });
  await page.getByTestId("tempo-set").click();
  await expect(page.getByTestId("tempo-control")).toHaveText("120 bpm");
}

/** The repeats stored on the arrangement's live entries, summed. */
const arrangedPasses = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((resolve, reject) => {
        const open = indexedDB.open("stablature");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const r = db.transaction("arrangementEntries").objectStore("arrangementEntries").getAll();
          r.onsuccess = () => {
            db.close();
            resolve(
              (r.result as { deletedAt?: unknown; repeat?: number }[])
                .filter((e) => !e.deletedAt)
                .reduce((n, e) => n + (e.repeat ?? 1), 0),
            );
          };
        };
      }),
  );

/**
 * A song with a tempo of 120 and one part with two notes, arranged `passes` times when more than one.
 * Ends on the play view.
 */
export async function seedPlayable(
  page: Page,
  opts: { passes?: number; tempo?: boolean; durations?: (number | null)[] } = {},
) {
  const { songUrl } = await startCapturing(page);
  await fret(page, "E", 7).click();
  await fret(page, "A", 5).click();
  // A duration is a button index in the inspector's row: 0 whole, 1 half, 2 quarter, 3 eighth.
  for (const [i, d] of (opts.durations ?? []).entries()) {
    if (d === null) continue;
    await page.getByTestId("tab-column").nth(i).click();
    await page.getByRole("button", { name: "Open column details" }).click();
    const button = page.getByTestId("duration-row").getByRole("button").nth(d);
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  }
  if (opts.tempo !== false) await setTempo120(page);
  await page.goto(songUrl);
  await page.getByRole("button", { name: "Each part once" }).click();
  // Each write must land before the page is left, or `page.goto` can drop it.
  await expect.poll(() => arrangedPasses(page)).toBe(1);
  const passes = opts.passes ?? 1;
  if (passes > 1) {
    await page.getByRole("button", { name: "One more repeat" }).waitFor({ state: "attached", timeout: 2000 }).catch(async () => {
      await page.getByTestId("roadmap-chip").first().click();
    });
    for (let i = 1; i < passes; i++) {
      await page.getByRole("button", { name: "One more repeat" }).click();
      await expect.poll(() => arrangedPasses(page)).toBe(i + 1);
    }
  }
  await page.goto(`${songUrl}/play`);
  await expect(page.getByTestId("click-bar")).toBeVisible();
  return { songUrl };
}
