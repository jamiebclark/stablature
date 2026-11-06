export type Screen = "play" | "capture" | "other";
export type ActionId =
  | "toggle-click" | "restart" | "column-back" | "column-on" | "bar-back" | "bar-on"
  | "start" | "end" | "part-back" | "part-on" | "string-up" | "string-down"
  | "enter" | "dead-note" | "help";

export interface Shortcut {
  readonly id: ActionId;
  readonly keys: readonly string[];
  readonly label: string;
  readonly words: string;
  readonly screens: readonly Screen[];
}

const ALL: readonly Screen[] = ["play", "capture", "other"];
const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Every row of FR-057 and nothing else. Dispatch and the help both read this. */
export const SHORTCUTS: readonly Shortcut[] = [
  { id: "toggle-click", keys: [" "], label: "Space", words: "Start or stop the click", screens: ["play"] },
  { id: "restart", keys: ["r"], label: "r", words: "Start again from the top, with the count-in", screens: ["play"] },
  { id: "column-back", keys: ["ArrowLeft"], label: "Left", words: "Back a column", screens: ["play", "capture"] },
  { id: "column-on", keys: ["ArrowRight"], label: "Right", words: "On a column", screens: ["play", "capture"] },
  { id: "bar-back", keys: ["["], label: "[", words: "Back a bar", screens: ["play", "capture"] },
  { id: "bar-on", keys: ["]"], label: "]", words: "On a bar", screens: ["play", "capture"] },
  { id: "start", keys: ["Home"], label: "Home", words: "Cursor to the start", screens: ["capture"] },
  { id: "end", keys: ["End"], label: "End", words: "Cursor to the end", screens: ["capture"] },
  { id: "part-back", keys: [","], label: ",", words: "Previous part", screens: ["capture"] },
  { id: "part-on", keys: ["."], label: ".", words: "Next part", screens: ["capture"] },
  { id: "string-up", keys: ["ArrowUp"], label: "Up", words: "Choose the string above to type on", screens: ["capture"] },
  { id: "string-down", keys: ["ArrowDown"], label: "Down", words: "Choose the string below to type on", screens: ["capture"] },
  { id: "enter", keys: [...DIGITS, "Enter"], label: "0 to 9, then Enter if needed", words: "Enter a fret on that string", screens: ["capture"] },
  { id: "dead-note", keys: ["x"], label: "x", words: "Dead note on that string", screens: ["capture"] },
  { id: "help", keys: ["?"], label: "?", words: "Open or close this help", screens: ALL },
];

export function screenFor(pathname: string): Screen {
  if (/^\/songs\/[^/]+\/capture(\/|$)/.test(pathname)) return "capture";
  if (/^\/songs\/[^/]+\/play(\/|$)/.test(pathname) || /^\/play(\/|$)/.test(pathname)) return "play";
  return "other";
}

export function shortcutFor(key: string, screen: Screen): Shortcut | null {
  return SHORTCUTS.find((s) => s.screens.includes(screen) && s.keys.includes(key)) ?? null;
}

export interface KeyEventLike {
  key: string;
  target: EventTarget | null;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
  keyCode?: number;
  repeat?: boolean;
}

const EDITABLE = "input, select, textarea, [contenteditable]:not([contenteditable=false]), [role=textbox]";
const OWN_KEYS = "button, a, summary, [role=button]";

export function acceptsShortcut(event: KeyEventLike, doc: Document): boolean {
  const target = event.target as Element | null;
  const closest = typeof target?.closest === "function" ? target : null;
  if (closest?.closest(EDITABLE)) return false;
  if (event.isComposing || event.keyCode === 229) return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  if (doc.querySelector("dialog[open]")) return false;
  if ((event.key === " " || event.key === "Enter") && closest?.closest(OWN_KEYS)) return false;
  if (event.repeat && (event.key === "x" || /^[0-9]$/.test(event.key))) return false;
  return true;
}
