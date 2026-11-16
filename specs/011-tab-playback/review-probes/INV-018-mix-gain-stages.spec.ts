/**
 * Round 2, diagnostic for INV-018-mix-seven-string-chord (which reads 1.12 to 1.17 in the app on a six- or
 * seven-note let-ring chord): what in the notes graph lets a chord through above 1.0. Rendered offline in the browser
 * with no app code, but with the app's own numbers: `waveFor("plain", hz)`'s partials (1/n, lifted below 400 Hz by
 * (f/400)^6, up to 64 partials, normalised by createPeriodicWave as synth.ts:128 does), the lowpass 2500 -> 1200 Hz,
 * PEAK.plain 0.45 reached with a 1 ms time constant, ring decay 1.5 s, the notes limiter as src/lib/rhythm/audio.ts
 * sets it (threshold -12, knee 0, ratio 20, attack 0, release 0.1), then `out`, a DynamicsCompressorNode at defaults.
 *
 * Two envelope orders:
 *   - "app": synth.ts's order for a new voice: `gain.setValueAtTime(FLOOR, t)` (synth.ts:133), then shape()'s
 *     `cancelScheduledValues(t)` (synth.ts:66), which removes that FLOOR event, then `setTargetAtTime(PEAK, t, 1 ms)`.
 *     The ramp therefore starts from the GainNode's default value, 1.0, not from FLOOR.
 *   - "floor": the FLOOR event kept, so the ramp starts from 0.0001.
 * Reads: one voice on the bus (its onset), and an open E chord of 4, 6 and 7 voices after the limiter and `out`.
 *
 * This models the graph; it does not run app code, so it cannot regress with the app. It asserts what a fix relies
 * on (with the FLOOR start kept, seven voices stay at or under 1.0 through the limiter and `out`) and prints the
 * "app" order numbers beside it. Round 2: app order 6 voices 1.098, 7 voices 1.126, one onset 0.735; FLOOR kept
 * 0.847, 0.877, 0.442. The in-app reads of INV-018-mix-seven-string-chord (1.10 to 1.17) match the app order.
 */
import { expect, test } from "@playwright/test";

test("peak sample of the notes graph, app envelope order vs FLOOR kept", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "once, on desktop");
  await page.goto("about:blank");
  const out = await page.evaluate(async () => {
    const E = [329.63, 246.94, 207.65, 164.81, 123.47, 82.41, 61.74];
    const wave = (ctx: BaseAudioContext, hz: number) => {
      const count = Math.max(1, Math.min(64, Math.floor(18000 / hz)));
      const real = new Float32Array(count + 1);
      const imag = new Float32Array(count + 1);
      for (let n = 1; n <= count; n++) {
        const f = n * hz;
        imag[n] = (1 / n) * (f >= 400 ? 1 : (f / 400) ** 6);
      }
      return ctx.createPeriodicWave(real, imag);
    };
    const render = async (voices: number, graph: "bus" | "limiter+out", order: "app" | "floor") => {
      const sr = 48000;
      const ctx = new OfflineAudioContext(1, sr * 3, sr);
      const bus = ctx.createGain();
      if (graph === "bus") bus.connect(ctx.destination);
      else {
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.knee.value = 0;
        limiter.ratio.value = 20;
        limiter.attack.value = 0;
        limiter.release.value = 0.1;
        const master = ctx.createGain();
        const o = ctx.createDynamicsCompressor();
        bus.connect(limiter);
        limiter.connect(master);
        master.connect(o);
        o.connect(ctx.destination);
      }
      for (let chord = 0; chord < 5; chord++) {
        const t = 0.1 + chord * 0.5;
        for (let v = 0; v < voices; v++) {
          const osc = ctx.createOscillator();
          osc.setPeriodicWave(wave(ctx, E[v]));
          osc.frequency.setValueAtTime(E[v], t);
          const f = ctx.createBiquadFilter();
          f.type = "lowpass";
          f.frequency.setValueAtTime(2500, t);
          f.frequency.setTargetAtTime(1200, t, 0.35);
          const g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, t);
          if (order === "app") g.gain.cancelScheduledValues(t);
          g.gain.setTargetAtTime(0.45, t, 0.001);
          g.gain.setTargetAtTime(0.0001, t + 0.003, 1.5);
          g.gain.setTargetAtTime(0.0001, t + 0.5, 0.005);
          osc.connect(f);
          f.connect(g);
          g.connect(bus);
          osc.start(t);
          osc.stop(t + 0.55);
        }
      }
      const d = (await ctx.startRendering()).getChannelData(0);
      let m = 0;
      for (const x of d) m = Math.max(m, Math.abs(x));
      return Number(m.toFixed(3));
    };
    const rows: Record<string, Record<string, number>> = {};
    for (const order of ["app", "floor"] as const) {
      rows[order] = {
        "1 voice E4, bus": await render(1, "bus", order),
        "4 voices, limiter+out": await render(4, "limiter+out", order),
        "6 voices, limiter+out": await render(6, "limiter+out", order),
        "7 voices, limiter+out": await render(7, "limiter+out", order),
      };
    }
    return rows;
  });
  console.log(`STAGES ${JSON.stringify(out)}`);
  expect(out.floor["7 voices, limiter+out"], "with the FLOOR start kept, 7 voices stay at or under 1.0").toBeLessThanOrEqual(1);
  expect(out.floor["1 voice E4, bus"], "with the FLOOR start kept, one onset stays at PEAK.plain").toBeLessThanOrEqual(0.45);
});
