/**
 * Aligns two sequences of interned column contents. Integers in, matched pairs out; it knows nothing
 * about music. The cost of a change, an addition and a removal is one each, and a barline may never
 * stand in for a non-barline. The work is a bounded furthest-reaching edit-distance walk, counted in
 * edits and never in time, so the result depends only on the two arrays.
 */

export const MAX_EDITS = 512;

export interface Alignment {
  /** Pairs of equal columns, (parent index, variant index), strictly increasing in both. */
  matches: readonly (readonly [number, number])[];
  /** True when the search ran out of budget and the trimmed middle was left as one run. */
  coarse: boolean;
}

const NEG = -0x3fffffff;

export function alignColumns(
  parent: Int32Array,
  variant: Int32Array,
  isBarline: (content: number) => boolean,
): Alignment {
  const n = parent.length;
  const m = variant.length;
  let lo = 0;
  while (lo < n && lo < m && parent[lo] === variant[lo]) lo += 1;
  let hn = n;
  let hm = m;
  while (hn > lo && hm > lo && parent[hn - 1] === variant[hm - 1]) {
    hn -= 1;
    hm -= 1;
  }

  const matches: [number, number][] = [];
  for (let i = 0; i < lo; i += 1) matches.push([i, i]);

  const N = hn - lo;
  const M = hm - lo;
  let coarse = false;
  if (N > 0 && M > 0) {
    const middle = walk(parent, variant, lo, N, M, isBarline);
    if (middle === null) coarse = true;
    else for (const pair of middle) matches.push(pair);
  }

  for (let t = 0; hn + t < n; t += 1) matches.push([hn + t, hm + t]);
  return { matches, coarse };
}

/** Matches within the trimmed middle, or null when more than `MAX_EDITS` edits are needed. */
function walk(
  parent: Int32Array,
  variant: Int32Array,
  offset: number,
  N: number,
  M: number,
  isBarline: (content: number) => boolean,
): [number, number][] | null {
  const a = (i: number) => parent[offset + i];
  const b = (j: number) => variant[offset + j];
  const levels: Int32Array[] = [];
  const get = (d: number, k: number): number =>
    d < 0 || k < -d || k > d ? NEG : levels[d][k + d];

  /** Where the walk starts on diagonal `k` at `d` edits, before sliding, and the diagonal it came from. */
  const start = (d: number, k: number): { i: number; from: number } | null => {
    let best = NEG;
    let from = 0;
    const sub = get(d - 1, k);
    if (sub > NEG) {
      const j = sub - k;
      if (sub < N && j < M && isBarline(a(sub)) === isBarline(b(j)) && sub + 1 > best) {
        best = sub + 1;
        from = k;
      }
    }
    const del = get(d - 1, k - 1);
    if (del > NEG && del < N && del + 1 > best) {
      best = del + 1;
      from = k - 1;
    }
    const ins = get(d - 1, k + 1);
    if (ins > NEG && ins - (k + 1) < M && ins > best) {
      best = ins;
      from = k + 1;
    }
    return best === NEG ? null : { i: best, from };
  };

  const target = N - M;
  for (let d = 0; d <= MAX_EDITS; d += 1) {
    const level = new Int32Array(2 * d + 1).fill(NEG);
    levels.push(level);
    for (let k = -d; k <= d; k += 1) {
      let i: number;
      if (d === 0) i = 0;
      else {
        const s = start(d, k);
        if (s === null) continue;
        i = s.i;
      }
      let j = i - k;
      if (j < 0 || j > M || i > N) continue;
      while (i < N && j < M && a(i) === b(j)) {
        i += 1;
        j += 1;
      }
      level[k + d] = i;
      if (k === target && i >= N) return trace(levels, start, d, k, offset);
    }
  }
  return null;
}

function trace(
  levels: Int32Array[],
  start: (d: number, k: number) => { i: number; from: number } | null,
  endD: number,
  endK: number,
  offset: number,
): [number, number][] {
  const out: [number, number][] = [];
  let d = endD;
  let k = endK;
  let i = levels[d][k + d];
  while (d >= 0) {
    const s = d === 0 ? { i: 0, from: 0 } : start(d, k)!;
    for (let t = i - 1; t >= s.i; t -= 1) out.push([offset + t, offset + t - k]);
    if (d === 0) break;
    d -= 1;
    k = s.from;
    i = levels[d][k + d];
  }
  return out.reverse();
}
