/**
 * Spec 011 drivers: a recorder for pitched playback (contracts/transport.md §7) and the playback song
 * (data-model.md §5). It wraps `installRecorder` from click-helpers without editing it.
 */
import type { Page } from "@playwright/test";
import { installRecorder, type Recorded } from "./click-helpers";
import { bar, seedSong, type Col, type EntrySpec, type PartSpec } from "./reading-helpers";
import { setStoredTempo } from "./rhythm-probe-helpers";
import { FIT_PARTS, openFourString, section, sectionEnd } from "./wide-helpers";

export interface PlayRecord {
  osc: { when: number; hz: number; type: string }[];
  thuds: { when: number }[];
  freq: { when: number; value: number; kind: "set" | "ramp" }[];
  /** Calls to fetch, XHR open or `new Request` after `markRequests()`. */
  requests: string[];
  counting: boolean;
}

interface OutlineEntry {
  card: string | null;
  column: string | null;
  at: number;
}

export async function installPlayRecorder(page: Page, opts: Parameters<typeof installRecorder>[1] = {}) {
  await installRecorder(page, opts);
  await page.addInitScript(() => {
    const play: PlayRecord = { osc: [], thuds: [], freq: [], requests: [], counting: false };
    const w = window as unknown as { __play: PlayRecord; __analysers?: AnalyserNode[] };
    w.__play = play;

    const osc = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (this: OscillatorNode, when?: number) {
      play.osc.push({ when: when ?? 0, hz: this.frequency.value, type: this.type });
      return osc.call(this, when);
    };
    const buf = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (this: AudioBufferSourceNode, when?: number) {
      play.thuds.push({ when: when ?? 0 });
      return buf.call(this, when);
    };
    // Only an oscillator's own frequency is recorded: gains and filter cutoffs are other AudioParams.
    const oscFreq = new WeakSet<AudioParam>();
    const getter = Object.getOwnPropertyDescriptor(OscillatorNode.prototype, "frequency")!.get!;
    Object.defineProperty(OscillatorNode.prototype, "frequency", {
      configurable: true,
      get(this: OscillatorNode) {
        const param = getter.call(this) as AudioParam;
        oscFreq.add(param);
        return param;
      },
    });
    const set = AudioParam.prototype.setValueAtTime;
    AudioParam.prototype.setValueAtTime = function (this: AudioParam, value: number, when: number) {
      if (oscFreq.has(this)) play.freq.push({ when, value, kind: "set" });
      return set.call(this, value, when);
    };
    const ramp = AudioParam.prototype.exponentialRampToValueAtTime;
    AudioParam.prototype.exponentialRampToValueAtTime = function (this: AudioParam, value: number, when: number) {
      if (oscFreq.has(this)) play.freq.push({ when, value, kind: "ramp" });
      return ramp.call(this, value, when);
    };

    // Everything that reaches a context's destination goes through one analyser, which is then connected on with the
    // saved original `connect`, so this patch does not recurse.
    const connect = AudioNode.prototype.connect as (this: AudioNode, ...a: unknown[]) => unknown;
    const tapped = new WeakMap<BaseAudioContext, AnalyserNode>();
    (AudioNode.prototype as unknown as { connect: typeof connect }).connect = function (this: AudioNode, ...args: unknown[]) {
      const target = args[0];
      const ctx = this.context;
      if (target && target === ctx.destination && !(this instanceof AnalyserNode)) {
        let a = tapped.get(ctx);
        if (!a) {
          a = ctx.createAnalyser();
          a.fftSize = 2048;
          tapped.set(ctx, a);
          (w.__analysers ??= []).push(a);
          connect.call(a, ctx.destination);
        }
        return connect.call(this, a, ...args.slice(1));
      }
      return connect.apply(this, args);
    };

    const count = (what: string) => {
      if (play.counting) play.requests.push(what);
    };
    const fetch0 = window.fetch;
    window.fetch = function (...a: Parameters<typeof fetch>) {
      count(`fetch ${String(a[0])}`);
      return fetch0.apply(this, a);
    };
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (this: XMLHttpRequest, ...a: unknown[]) {
      count(`xhr ${String(a[1])}`);
      return (open as (...x: unknown[]) => void).apply(this, a);
    };
    const Req = window.Request;
    window.Request = new Proxy(Req, {
      construct(target, a) {
        count(`request ${String(a[0])}`);
        return Reflect.construct(target, a);
      },
    });
  });
}

/** From here, network calls are counted into `__play.requests` (INV-016). */
export const markRequests = (page: Page) =>
  page.evaluate(() => void ((window as unknown as { __play: PlayRecord }).__play.counting = true));

export const playRecord = (page: Page) =>
  page.evaluate(() => (window as unknown as { __play: PlayRecord }).__play);

export const recordedAudio = (page: Page): Promise<Recorded> =>
  page.evaluate(() => (window as unknown as { __rec: Recorded }).__rec);

/** The `custom` (pitched notes) oscillators, and the `square` (click) ones. */
export const noteStarts = (rec: PlayRecord) => rec.osc.filter((o) => o.type === "custom");
export const clickStarts = (rec: PlayRecord) => rec.osc.filter((o) => o.type === "square");

/** The analyser's current peak sample and the share of its energy above `hz`. */
export const analyse = (page: Page, hz = 200) =>
  page.evaluate((cut) => {
    const a = ((window as unknown as { __analysers?: AnalyserNode[] }).__analysers ?? [])[0];
    if (!a) return null;
    const t = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(t);
    const f = new Float32Array(a.frequencyBinCount);
    a.getFloatFrequencyData(f);
    const binHz = a.context.sampleRate / a.fftSize;
    let total = 0;
    let high = 0;
    f.forEach((db, i) => {
      const p = 10 ** (db / 10);
      total += p;
      if (i * binHz >= cut) high += p;
    });
    return { peak: Math.max(...t.map(Math.abs)), above: total ? high / total : 0 };
  }, hz);

/** Part T as text (data-model.md §5). */
export const partT = [
  "3:5 3:7[hammer_on] |",
  "3:7 3:9[slide_up] |",
  "2:5[slide_up] 1:7[slide_down] |",
  "3:5[pull_off] 3:3[pull_off] |",
  "2:7[vibrato] |",
  "3:5[palm_mute] 3:5[palm_mute] 3:x 3:x[palm_mute] |",
  "0:2[let_ring]+1:2[let_ring]+2:4[let_ring] 3:0 |",
  "3:12[harmonic] 2:7[harmonic] 1:5[harmonic] 0:4[harmonic] 2:3[harmonic] |",
  "3:7[bend] 3:7[tap] 3:7[tap] 3:5[pull_off] |",
  "3:x[slide_up] 3:5[dead_note] 9:3 |",
  "rest",
].join(" ");

/** Text to seeder columns; the unit twin in `src/lib/playback/__tests__/fixtures.ts` reads the same text. */
export function textToCols(text: string): Col[] {
  return text.trim().split(/\s+/).map((tok): Col => {
    if (tok === "|") return bar();
    if (tok === "rest") return { kind: "rest" };
    const frets: Record<string, number | "x"> = {};
    const techniques: Record<string, string[]> = {};
    for (const piece of tok.split("+")) {
      const m = /^([^:]+):([^[]+)(?:\[([^\]]*)\])?$/.exec(piece)!;
      frets[m[1]] = m[2] === "x" ? "x" : Number(m[2]);
      if (m[3]) techniques[m[1]] = m[3].split(",");
    }
    return { frets, ...(Object.keys(techniques).length ? { techniques } : {}) };
  });
}

/** The fit song with every duration unset, plus part T and an arrangement entry for it: 11 passes, 120 bpm. */
export async function seedPlaybackSong(page: Page) {
  const parts: PartSpec[] = [
    ...FIT_PARTS.map((p) => ({ ...p, columns: p.columns.map((c) => ({ ...c, d: null })) })),
    { key: "t", label: "T", columns: textToCols(partT) },
  ];
  const entries: EntrySpec[] = [
    section("Verse"),
    { part: "a", repeat: 4, last: "a2" },
    sectionEnd,
    { part: "b", repeat: 2 },
    { part: "a", repeat: 2 },
    section("Outro"),
    { part: "c" },
    sectionEnd,
    { part: "b" },
    { part: "t" },
  ];
  const seeded = await seedSong(page, parts, entries);
  await setStoredTempo(page, 120);
  await openFourString(page, seeded.songUrl);
  return seeded;
}

/**
 * Logs `(card, column, ctx.currentTime)` each time the outline moves (INV-010). Call it once the play view has
 * loaded, then read the log with `outlineEntries`.
 */
export const outlineLog = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __outline: OutlineEntry[]; __ctxs?: AudioContext[] };
    w.__outline = [];
    const seen = (el: Element) => {
      const card = el.closest("[data-card]")?.getAttribute("data-card") ?? el.getAttribute("data-card");
      w.__outline.push({ card, column: el.getAttribute("data-column"), at: w.__ctxs?.at(-1)?.currentTime ?? -1 });
    };
    new MutationObserver((records) => {
      for (const r of records) if (r.target instanceof Element) seen(r.target);
    }).observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-current", "data-column", "data-active"],
    });
  });

export const outlineEntries = (page: Page) =>
  page.evaluate(() => (window as unknown as { __outline: OutlineEntry[] }).__outline);
