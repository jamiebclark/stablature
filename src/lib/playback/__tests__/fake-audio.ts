/**
 * A recording stand-in for the Web Audio nodes `src/lib/playback/synth.ts` uses. Every source keeps the times it
 * was started and stopped, and every AudioParam keeps its automation, so a probe can ask "is this voice still
 * sounding at t?" from what the real synth asked of the graph.
 */
export interface ParamCall {
  op: "set" | "ramp" | "target" | "cancel";
  value: number;
  when: number;
  tau?: number;
}

export class FakeParam {
  value = 0;
  calls: ParamCall[] = [];
  setValueAtTime(value: number, when: number) {
    this.calls.push({ op: "set", value, when });
    return this;
  }
  exponentialRampToValueAtTime(value: number, when: number) {
    this.calls.push({ op: "ramp", value, when });
    return this;
  }
  linearRampToValueAtTime(value: number, when: number) {
    this.calls.push({ op: "ramp", value, when });
    return this;
  }
  setTargetAtTime(value: number, when: number, tau: number) {
    this.calls.push({ op: "target", value, when, tau });
    return this;
  }
  cancelScheduledValues(when: number) {
    this.calls.push({ op: "cancel", value: 0, when });
    return this;
  }
}

let serial = 0;

export class FakeNode {
  readonly id = ++serial;
  readonly outputs: unknown[] = [];
  connect(target: unknown) {
    this.outputs.push(target);
    return target;
  }
  disconnect() {}
}

export class FakeSource extends FakeNode {
  kind: "osc" | "buffer";
  startAt: number | null = null;
  stops: number[] = [];
  onended: (() => void) | null = null;
  readonly frequency = new FakeParam();
  type = "sine";
  buffer: unknown = null;
  private listeners: (() => void)[] = [];
  constructor(kind: "osc" | "buffer") {
    super();
    this.kind = kind;
  }
  setPeriodicWave() {
    this.type = "custom";
  }
  start(when = 0) {
    this.startAt = when;
  }
  stop(when = 0) {
    this.stops.push(when);
  }
  addEventListener(_: string, fn: () => void) {
    this.listeners.push(fn);
  }
  /** The time the source stops, by the Web Audio rule that the last stop() call wins. */
  get stopAt(): number {
    return this.stops.length ? this.stops[this.stops.length - 1] : Number.POSITIVE_INFINITY;
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

export class FakeFilter extends FakeNode {
  type = "lowpass";
  readonly frequency = new FakeParam();
}

export class FakeContext {
  sampleRate = 48000;
  currentTime = 0;
  readonly destination = new FakeNode();
  readonly oscillators: FakeSource[] = [];
  readonly buffers: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  createOscillator() {
    const o = new FakeSource("osc");
    this.oscillators.push(o);
    return o;
  }
  createBufferSource() {
    const b = new FakeSource("buffer");
    this.buffers.push(b);
    return b;
  }
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createBiquadFilter() {
    return new FakeFilter();
  }
  createPeriodicWave() {
    return {};
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
}
