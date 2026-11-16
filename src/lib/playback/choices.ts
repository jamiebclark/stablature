/**
 * Playback's own choices, React-free (data-model §4). Only `notes` is kept on this device, in
 * `localStorage["stablature.play"]`, shaped like `reading/panels.ts`: storage is untrusted, memory wins once
 * set, anything unparseable reads as off and is left where it is. `click`, `loop` and `speed` live in memory for
 * the app session and write nothing anywhere.
 */

export const PLAY_KEY = "stablature.play";

type Store = Pick<Storage, "getItem" | "setItem">;

let override: Store | null | undefined;
let notesMemory: boolean | undefined;
let click = true;
let loop = false;
const speeds = new Map<string, number>();
const listeners = new Set<() => void>();

/** Test seam: inject storage, and forget what this visit set. */
export function setPlayStorage(store: Store | null | undefined): void {
  override = store;
  notesMemory = undefined;
  click = true;
  loop = false;
  speeds.clear();
  notify();
}

function store(): Store | null {
  if (override !== undefined) return override;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function readAll(): Record<string, unknown> {
  try {
    const raw = store()?.getItem(PLAY_KEY);
    if (typeof raw !== "string") return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function notify() {
  for (const l of [...listeners]) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

export const getNotes = (): boolean => notesMemory ?? readAll().notes === true;

export function setNotes(on: boolean): void {
  notesMemory = on;
  try {
    store()?.setItem(PLAY_KEY, JSON.stringify({ ...readAll(), notes: on }));
  } catch {
    // Refused: the choice holds for this visit and is not remembered.
  }
  notify();
}

export const getClick = (): boolean => click;
export function setClick(on: boolean): void {
  click = on;
  notify();
}

export const getLoop = (): boolean => loop;
export function setLoop(on: boolean): void {
  loop = on;
  notify();
}

export const SPEED_MIN = 50;
export const SPEED_MAX = 100;
export const SPEED_STEP = 5;

export const getSpeed = (songId: string): number => speeds.get(songId) ?? SPEED_MAX;

/** Clamps to [50, 100] and rounds to a multiple of 5. */
export function setSpeed(songId: string, value: number): void {
  const rounded = Math.round(value / SPEED_STEP) * SPEED_STEP;
  speeds.set(songId, Math.min(SPEED_MAX, Math.max(SPEED_MIN, rounded)));
  notify();
}

/** The tempo every part of a run uses: the usable stored tempo times the speed, unrounded. Notes on or off. */
export const effective = (usableBpm: number, speed: number): number => (usableBpm * speed) / 100;
