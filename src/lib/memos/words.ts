/**
 * Every sentence the memo feature says, in one place, so the recorder, the
 * card and the tests agree on the words.
 */

import { formatOf } from "./formats";

/** `m:ss` of a duration. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const s = total % 60;
  return `${Math.floor(total / 60)}:${s < 10 ? "0" : ""}${s}`;
}

export type EndingKind =
  | "stopped"
  | "limit-time"
  | "limit-size"
  | "discarded"
  | "refused"
  | "no-device"
  | "cut-short"
  | "hidden"
  | "left"
  | "recorder-error"
  | "too-short"
  | "out-of-room"
  | "recovered"
  | "unrecoverable"
  | "unsupported"
  | "save-failed";

/** `null` means no notice: the memo appearing is the feedback. `{len}` is `m:ss`. */
export const NOTICE_WORDS: Record<EndingKind, string | null> = {
  stopped: null,
  "limit-time": "Stopped at the 3-minute limit. The memo is saved.",
  "limit-size": "Stopped at the 8 MB limit. The memo is saved.",
  discarded: "Recording discarded. Nothing was saved.",
  refused:
    "The microphone was refused. To record, allow the microphone for this site in your browser's settings, then try again.",
  "no-device": "No microphone could be opened on this device.",
  "cut-short": "The recording was cut short. The first {len} was kept.",
  hidden: "Recording stopped when you left the app. The first {len} was kept.",
  left: "Recording stopped when you left the song. The first {len} was kept.",
  "recorder-error": "The recording stopped because of an error. The first {len} was kept.",
  "too-short": "Too short to keep. Recordings need at least 1 second.",
  "out-of-room":
    "This device is out of room, so the recording isn't saved yet. Try again, or download the clip.",
  recovered: "A recording was cut off when the app closed. The first {len} was recovered.",
  unrecoverable:
    "A recording was cut off when the app closed and couldn't be recovered.",
  unsupported: "This browser can't record audio here. Memos recorded elsewhere still play.",
  "save-failed": "The recording couldn't be saved. Try again, or download the clip.",
};

/** Notices that are not endings. */
export const EXTRA_NOTICE_WORDS = {
  saved: "Saved.",
  persist:
    "This browser may clear memos if the device runs short of space. Adding the app to your home screen makes that less likely.",
} as const;

/** The notice's sentence, with `{len}` filled in. */
export function noticeWords(kind: EndingKind, keptMs = 0): string | null {
  const words = NOTICE_WORDS[kind];
  return words === null ? null : words.replace("{len}", formatClock(keptMs));
}

export type MemoStateKind =
  | "deleted"
  | "unplayable"
  | "failed-play"
  | "refused"
  | "local-signed-out"
  | "local-offline"
  | "uploading"
  | "ready"
  | "downloading"
  | "full"
  | "fetch-failed"
  | "waiting";

/** Fixed sentences per derived state. `refused` shows the refusal's own message. */
export const STATE_WORDS = {
  deleted: "This memo's audio was deleted.",
  "failed-play": "This memo couldn't be played.",
  "local-signed-out": "Saved on this device.",
  "local-offline": "Will upload when online.",
  uploading: "Uploading…",
  downloading: "Downloading…",
  full: "Out of room on this device.",
  "fetch-failed": "Couldn't download.",
  waiting: "Waiting for the recording device to upload it.",
} as const;

/** "This browser can't play {Words}." for a format this browser lacks. */
export function unplayableWords(format: string): string {
  return `This browser can't play ${formatOf(format)?.words ?? "this audio"}.`;
}

export type Availability = "insecure" | "no-microphone" | "no-recorder" | "busy";

export function unavailableWords(kind: Availability, partLabel = ""): string {
  switch (kind) {
    case "insecure":
      return "Recording needs a secure (https) address. This browser only allows the microphone on https or on localhost, and this page was opened over plain http. Whoever runs your server can set up https. Memos recorded elsewhere still play here.";
    case "no-microphone":
      return "This browser can't open a microphone here. Memos recorded elsewhere still play here.";
    case "no-recorder":
      return "This browser can't record audio. Memos recorded elsewhere still play here.";
    case "busy":
      return `A recording is already running on part ${partLabel}. Stop it first.`;
  }
}

/** Lower case, `[a-z0-9]` runs joined by `-`, at most 40 characters; "memo" if empty. */
function filePiece(text: string): string {
  const piece = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return piece || "memo";
}

/** `{song}-{part label}-{label or yyyy-mm-dd-hhmm}{ext}` */
export function downloadName(input: {
  songTitle: string;
  partLabel: string;
  label: string | null;
  recordedAt: number;
  format: string;
}): string {
  const d = new Date(input.recordedAt);
  const two = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}`;
  const ext = formatOf(input.format)?.extension ?? "";
  return `${filePiece(input.songTitle)}-${filePiece(input.partLabel)}-${input.label ? filePiece(input.label) : stamp}${ext}`;
}
