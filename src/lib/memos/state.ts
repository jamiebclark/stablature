/**
 * What a memo says on this device (FR-039, FR-048). Pure; the UI calls it, nothing stores it.
 * The first matching row of data-model §5 wins.
 */

import type { MemoFetchEntry, MemoUploadEntry } from "../local/db";
import type { MemoRow } from "../model";
import { STATE_WORDS, unplayableWords, type MemoStateKind } from "./words";

export interface MemoStateInput {
  row: MemoRow;
  hasAudio: boolean;
  upload: MemoUploadEntry | null;
  fetch: MemoFetchEntry | null;
  downloading: boolean;
  recordedHere: boolean;
  signedIn: boolean;
  online: boolean;
  canPlay: boolean;
  decodeFailed: boolean;
}

export interface MemoState {
  kind: MemoStateKind;
  /** The play controls are drawn. */
  player: boolean;
  words: string | null;
  action: "download" | "retry" | null;
}

export function memoState(i: MemoStateInput): MemoState {
  const say = (
    kind: MemoStateKind,
    player: boolean,
    words: string | null,
    action: MemoState["action"] = null,
  ): MemoState => ({ kind, player, words, action });
  if (i.fetch?.status === "erased") return say("deleted", false, STATE_WORDS.deleted);
  if (i.hasAudio && !i.canPlay) return say("unplayable", false, unplayableWords(i.row.format), "download");
  if (i.hasAudio && i.decodeFailed) return say("failed-play", false, STATE_WORDS["failed-play"], "download");
  if (i.hasAudio && i.upload?.refusal) return say("refused", true, i.upload.refusal.message, "retry");
  if (i.hasAudio && i.upload && !i.signedIn) return say("local-signed-out", true, STATE_WORDS["local-signed-out"]);
  if (i.hasAudio && i.upload && !i.online) return say("local-offline", true, STATE_WORDS["local-offline"]);
  if (i.hasAudio && i.upload) return say("uploading", true, STATE_WORDS.uploading);
  if (i.hasAudio) return say("ready", true, null);
  if (i.downloading) return say("downloading", false, STATE_WORDS.downloading);
  if (i.fetch?.status === "full") return say("full", false, STATE_WORDS.full, "retry");
  if (i.fetch?.status === "failed") return say("fetch-failed", false, STATE_WORDS["fetch-failed"], "retry");
  return say("waiting", false, STATE_WORDS.waiting);
}
