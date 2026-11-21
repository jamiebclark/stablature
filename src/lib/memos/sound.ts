/**
 * One sound at a time (FR-040): a memo playing, or the recorder listening, never both, and never two memos.
 * React-free. `claim` stops the previous owner synchronously, so the earlier sound has stopped before the
 * later one starts.
 */

let owner: string | null = null;
let stopOwner: (() => void) | null = null;

export function claim(next: string, stop: () => void): void {
  const previous = stopOwner;
  const was = owner;
  owner = next;
  stopOwner = stop;
  if (previous && was !== next) previous();
}

/** Only the current owner can let go. */
export function release(who: string): void {
  if (owner !== who) return;
  owner = null;
  stopOwner = null;
}

export function current(): string | null {
  return owner;
}

/** Test seam. */
export function resetSound(): void {
  owner = null;
  stopOwner = null;
}
