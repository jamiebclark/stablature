/**
 * Ask the browser to keep this device's memos (FR-070). At most one `persist()` per device, ever; a notice only
 * when the end state is "not persisted", and only once.
 */

import { EXTRA_NOTICE_WORDS } from "./words";
import { markPersistAsked, markPersistNoticeShown, persistAsked, persistNoticeShown } from "./prefs";

export interface StorageManagerLike {
  persisted(): Promise<boolean>;
  persist(): Promise<boolean>;
}

export interface PersistDeps {
  storage: StorageManagerLike | null;
  asked(): boolean;
  markAsked(): void;
  noticeShown(): boolean;
  markNoticeShown(): void;
}

function realDeps(): PersistDeps {
  const storage =
    typeof navigator !== "undefined" && navigator.storage && typeof navigator.storage.persist === "function"
      ? navigator.storage
      : null;
  return {
    storage,
    asked: persistAsked,
    markAsked: markPersistAsked,
    noticeShown: persistNoticeShown,
    markNoticeShown: markPersistNoticeShown,
  };
}

/** `notice` is called with the persistence words when the browser will not promise to keep memos. */
export async function ensurePersisted(
  notice: (words: string) => Promise<void>,
  deps: PersistDeps = realDeps(),
): Promise<void> {
  let persisted = false;
  if (deps.storage) {
    try {
      persisted = await deps.storage.persisted();
    } catch {
      persisted = false;
    }
    if (!persisted && !deps.asked()) {
      deps.markAsked();
      try {
        persisted = await deps.storage.persist();
      } catch {
        persisted = false;
      }
    }
  }
  if (persisted || deps.noticeShown()) return;
  deps.markNoticeShown();
  await notice(EXTRA_NOTICE_WORDS.persist);
}
