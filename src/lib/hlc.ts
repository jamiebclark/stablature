/**
 * Hybrid logical clocks.
 *
 * Every synced row carries an HLC in `updatedAt`, and merges resolve field by
 * field by keeping the larger one. That only works if HLCs minted on different
 * devices compare correctly as plain strings -- in Postgres, in IndexedDB, and
 * in JS -- so the encoding is fixed-width and lexicographic order *is* causal
 * order:
 *
 *     000001762051200000:0000:k3f9a1b2c7de
 *     |----- wall ------|:|cnt|:|- node -|
 *
 * The counter breaks ties inside a single millisecond. The node id breaks ties
 * between devices that are genuinely concurrent, which is what makes the order
 * total without any coordination between them.
 *
 * Wall time is advisory only: a device with a skewed clock cannot lose writes,
 * it can only appear to have made them later than it did.
 */

const WALL_DIGITS = 15;
const COUNTER_DIGITS = 4;

/** Counter is 4 hex digits, so this many writes per millisecond per device. */
export const MAX_COUNTER = 0xffff;

/** Node ids share the separator-free alphabet so they can never break parsing. */
const NODE_ID_PATTERN = /^[0-9a-z]{1,32}$/;

export type Hlc = string;

export interface HlcParts {
  wallMs: number;
  counter: number;
  nodeId: string;
}

/** Sorts below every real timestamp; used as the "never written" floor. */
export const ZERO_HLC: Hlc = encodeHlc({ wallMs: 0, counter: 0, nodeId: "0" });

export function encodeHlc({ wallMs, counter, nodeId }: HlcParts): Hlc {
  if (!Number.isInteger(wallMs) || wallMs < 0) {
    throw new RangeError(`HLC wallMs must be a non-negative integer, got ${wallMs}`);
  }
  if (!Number.isInteger(counter) || counter < 0 || counter > MAX_COUNTER) {
    throw new RangeError(`HLC counter must be 0..${MAX_COUNTER}, got ${counter}`);
  }
  if (!NODE_ID_PATTERN.test(nodeId)) {
    throw new RangeError(`HLC nodeId must match ${NODE_ID_PATTERN}, got ${JSON.stringify(nodeId)}`);
  }
  const wall = String(wallMs).padStart(WALL_DIGITS, "0");
  if (wall.length > WALL_DIGITS) {
    throw new RangeError(`HLC wallMs exceeds ${WALL_DIGITS} digits and would break ordering`);
  }
  const count = counter.toString(16).padStart(COUNTER_DIGITS, "0");
  return `${wall}:${count}:${nodeId}`;
}

export function decodeHlc(hlc: Hlc): HlcParts {
  const parts = hlc.split(":");
  if (parts.length !== 3) {
    throw new SyntaxError(`Malformed HLC: ${JSON.stringify(hlc)}`);
  }
  const [wall, count, nodeId] = parts;
  if (wall.length !== WALL_DIGITS || count.length !== COUNTER_DIGITS) {
    throw new SyntaxError(`Malformed HLC field widths: ${JSON.stringify(hlc)}`);
  }
  const wallMs = Number.parseInt(wall, 10);
  const counter = Number.parseInt(count, 16);
  if (!Number.isInteger(wallMs) || !Number.isInteger(counter)) {
    throw new SyntaxError(`Non-numeric HLC fields: ${JSON.stringify(hlc)}`);
  }
  return { wallMs, counter, nodeId };
}

/** Total order over HLCs. Plain string comparison, which is the whole point. */
export function compareHlc(a: Hlc, b: Hlc): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function maxHlc(a: Hlc, b: Hlc): Hlc {
  return compareHlc(a, b) >= 0 ? a : b;
}

/**
 * Per-device clock. One instance per browser tab is fine -- `nodeId` only has
 * to be unique per *device*, because two tabs on one device write through the
 * same local store and so are never concurrent with each other.
 */
export class HlcClock {
  private lastWall = 0;
  private counter = 0;

  constructor(
    readonly nodeId: string,
    private readonly physicalNow: () => number = Date.now,
  ) {
    if (!NODE_ID_PATTERN.test(nodeId)) {
      throw new RangeError(`HLC nodeId must match ${NODE_ID_PATTERN}, got ${JSON.stringify(nodeId)}`);
    }
  }

  /** Mint a timestamp for a local write. Strictly increasing, always. */
  send(): Hlc {
    const physical = Math.max(0, Math.floor(this.physicalNow()));
    const wall = Math.max(this.lastWall, physical);
    this.counter = wall === this.lastWall ? this.counter + 1 : 0;
    this.lastWall = wall;
    this.assertCounterInRange();
    return encodeHlc({ wallMs: wall, counter: this.counter, nodeId: this.nodeId });
  }

  /**
   * Fold a remote timestamp in, then mint one that is greater than both it and
   * anything minted locally. Call this on every row received from sync so that
   * later local edits are correctly ordered *after* what we just learned about.
   */
  recv(remote: Hlc): Hlc {
    const { wallMs: remoteWall, counter: remoteCounter } = decodeHlc(remote);
    const physical = Math.max(0, Math.floor(this.physicalNow()));
    const wall = Math.max(this.lastWall, remoteWall, physical);

    if (wall === this.lastWall && wall === remoteWall) {
      this.counter = Math.max(this.counter, remoteCounter) + 1;
    } else if (wall === this.lastWall) {
      this.counter += 1;
    } else if (wall === remoteWall) {
      this.counter = remoteCounter + 1;
    } else {
      this.counter = 0;
    }

    this.lastWall = wall;
    this.assertCounterInRange();
    return encodeHlc({ wallMs: wall, counter: this.counter, nodeId: this.nodeId });
  }

  private assertCounterInRange(): void {
    if (this.counter > MAX_COUNTER) {
      // Only reachable if a device's clock is frozen while it writes 65k times,
      // which means something is badly wrong rather than merely busy.
      throw new RangeError("HLC counter overflow: physical clock is not advancing");
    }
  }
}

/** Random, stable-per-device node id in the HLC alphabet. */
export function randomNodeId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
}
