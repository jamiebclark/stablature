import { describe, expect, it } from "vitest";
import type { MemoFetchEntry, MemoUploadEntry } from "../../local/db";
import type { MemoRow } from "../../model";
import { memoState } from "../state";
import { STATE_WORDS, unplayableWords } from "../words";

/** INV-011, unit half: every input has exactly one state, and the player follows the table. */
const row = { format: "audio/webm;codecs=opus" } as MemoRow;
const bool = [false, true];
const uploads: (MemoUploadEntry | null)[] = [
  null,
  { memoId: "m", bandId: "b", attempts: 0, nextAt: 0, refusal: null, account: null },
  { memoId: "m", bandId: "b", attempts: 0, nextAt: 0, refusal: { code: "band_full", message: "Full." }, account: "u" },
];
const fetches: (MemoFetchEntry | null)[] = [
  null,
  ...(["waiting", "failed", "full", "erased"] as const).map((status) => ({ memoId: "m", status, attempts: 0, nextAt: 0 })),
];

describe("memoState", () => {
  it("over the whole input product", () => {
    let count = 0;
    for (const hasAudio of bool)
      for (const upload of uploads)
        for (const fetch of fetches)
          for (const downloading of bool)
            for (const signedIn of bool)
              for (const online of bool)
                for (const canPlay of bool)
                  for (const decodeFailed of bool)
                    {
                      count++;
                      const s = memoState({ row, hasAudio, upload, fetch, downloading, recordedHere: true, signedIn, online, canPlay, decodeFailed });
                      const playerKinds = ["refused", "local-signed-out", "local-offline", "uploading", "ready"];
                      expect(s.player).toBe(playerKinds.includes(s.kind) && hasAudio);
                      switch (s.kind) {
                        case "deleted":
                          expect(fetch?.status).toBe("erased");
                          expect(s.words).toBe(STATE_WORDS.deleted);
                          break;
                        case "unplayable":
                          expect(s.words).toBe(unplayableWords(row.format));
                          break;
                        case "refused":
                          expect(s.words).toBe(upload?.refusal?.message);
                          break;
                        case "ready":
                          expect(s.words).toBeNull();
                          break;
                        case "waiting":
                          expect(s.words).toBe(STATE_WORDS.waiting);
                          expect(hasAudio).toBe(false);
                          break;
                        default:
                          expect(s.words).toBe(STATE_WORDS[s.kind]);
                      }
                    }
    expect(count).toBe(960);
  });

  it("a clip that cannot play beats everything but a deleted one", () => {
    const s = memoState({
      row, hasAudio: true, upload: null, fetch: null, downloading: false, recordedHere: true,
      signedIn: true, online: true, canPlay: false, decodeFailed: true,
    });
    expect(s.kind).toBe("unplayable");
    expect(s.action).toBe("download");
  });
});
