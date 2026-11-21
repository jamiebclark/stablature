import { expect, test } from "@playwright/test";
import { landed } from "./reading-helpers";
import { denyCanPlay, seedMemo, seedSongM, type MemoKind } from "./memo-helpers";
import { STATE_WORDS, unplayableWords } from "../src/lib/memos/words";

/**
 * INV-011 (e2e): data-state, the memo-state text and the presence of memo-play match data-model §5 for every kind.
 * `unplayable` uses the one stated canPlayType exception; `failed-play` seeds bytes that do not decode.
 */
const WEBM = "audio/webm;codecs=opus";

const table: { kind: MemoKind; player: boolean; words: string | null }[] = [
  { kind: "deleted", player: false, words: STATE_WORDS.deleted },
  { kind: "unplayable", player: false, words: unplayableWords(WEBM) },
  { kind: "failed-play", player: false, words: STATE_WORDS["failed-play"] },
  { kind: "refused", player: true, words: "This band's recordings are full." },
  { kind: "local-signed-out", player: true, words: STATE_WORDS["local-signed-out"] },
  { kind: "ready", player: true, words: null },
  { kind: "full", player: false, words: STATE_WORDS.full },
  { kind: "fetch-failed", player: false, words: STATE_WORDS["fetch-failed"] },
  { kind: "waiting", player: false, words: STATE_WORDS.waiting },
];

test("the unplayable words name WebM", () => {
  expect(unplayableWords(WEBM)).toBe("This browser can't play WebM audio.");
});

for (const row of table) {
  test(`state ${row.kind}`, async ({ page }) => {
    if (row.kind === "unplayable") await denyCanPlay(page, WEBM);
    await seedSongM(page);
    await landed(page);
    await seedMemo(page, {
      partLabel: "B",
      state: row.kind,
      ...(row.kind === "failed-play" ? { bytes: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), format: "audio/wav" } : {}),
    });
    await page.reload();
    const memo = page.getByTestId("memo").first();
    if (row.kind === "failed-play") {
      // The bytes only fail to decode when played, so the player shows until the first try.
      await expect(memo.getByTestId("memo-play")).toHaveCount(1);
      await memo.getByTestId("memo-play").click();
    }
    await expect(memo).toHaveAttribute("data-state", row.kind);
    await expect(memo.getByTestId("memo-play")).toHaveCount(row.player ? 1 : 0);
    if (row.words) await expect(memo.getByTestId("memo-state")).toContainText(row.words);
    else await expect(memo.getByTestId("memo-state")).toHaveCount(0);
    if (row.kind === "unplayable" || row.kind === "failed-play") await expect(memo.getByTestId("memo-download")).toBeVisible();
  });
}
