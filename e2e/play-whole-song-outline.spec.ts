/**
 * INV-010 / INV-006 (e2e) over the member `e2e/play-outline.spec.ts` leaves out (its T042 note says so): the WHOLE
 * song with Notes on, through the drawn-once cards of entry wide-reading-layout and their live `pass k of n` words.
 *
 * The playback song (11 passes, every length unset, so every hit is one beat) at 600 bpm. The expected outline is
 * read from the page itself: every non-barline `[data-column]` of each `li[data-card]` in document order, once per
 * pass the card stands for (`data-first-pass`..`data-last-pass`). Each change is logged with the audio clock; hit k
 * is due at the first count-in click + (4 + k) beats, and must be outlined no earlier than 5 ms before that and no
 * later than 50 ms after (FR-040). On a drawn-once card the live words must step `pass j of n` with the passes.
 */
import { expect, test } from "@playwright/test";
import { setStoredTempo } from "./rhythm-probe-helpers";
import { openCluster } from "./usability-helpers";
import { clickStarts, installPlayRecorder, playRecord, seedPlaybackSong } from "./play-helpers";

const BPM = 600;
const BEAT = 60 / BPM;

interface Seen {
  card: string | null;
  key: string | null;
  words: string;
  at: number;
}

test("whole song, Notes on: the outline visits every drawn column of every pass, on time, with the pass words", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await installPlayRecorder(page);
  const s = await seedPlaybackSong(page);
  await setStoredTempo(page, BPM);
  await page.goto(s.playUrl);
  await openCluster(page);
  await page.getByTestId("play-notes").click();
  await page.getByTestId("play-loop").getAttribute("aria-pressed").then(async (on) => {
    if (on === "true") await page.getByTestId("play-loop").click();
  });
  await expect(page.getByTestId("click-start")).toHaveText("Play");
  await page.getByTestId("panel-play-cluster").click();

  const expected = await page.evaluate(() =>
    [...document.querySelectorAll("li[data-card]")].flatMap((li) => {
      const first = Number(li.getAttribute("data-first-pass"));
      const last = Number(li.getAttribute("data-last-pass"));
      const keys = [...li.querySelectorAll('[data-column]:not([data-barline="true"])')].map((c) => c.getAttribute("data-column")!);
      const out: { card: string; key: string; pass: number; of: number; count: number }[] = [];
      for (let p = first; p <= last; p++)
        for (const key of keys) out.push({ card: li.getAttribute("data-card")!, key, pass: p - first, of: last - first + 1, count: last - first + 1 });
      return out;
    }),
  );
  expect(expected.length).toBeGreaterThan(200);

  await page.evaluate(() => {
    const w = window as unknown as { __seen: Seen[]; __ctxs?: AudioContext[] };
    w.__seen = [];
    let last = "";
    new MutationObserver(() => {
      const el = document.querySelector(".tab-column-reading");
      const li = el?.closest("li[data-card]");
      const now = `${li?.getAttribute("data-card")}|${el?.getAttribute("data-column")}`;
      if (now === last) return;
      last = now;
      w.__seen.push({
        card: li?.getAttribute("data-card") ?? null,
        key: el?.getAttribute("data-column") ?? null,
        words: li?.querySelector('[data-testid="card-passes-live"]')?.textContent ?? "",
        at: w.__ctxs?.at(-1)?.currentTime ?? -1,
      });
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"], characterData: true, childList: true });
  });

  await page.getByTestId("click-start").click();
  // The run ends by itself (Loop off): the start button comes back.
  await expect(page.getByTestId("click-start")).toBeVisible({ timeout: 90_000 });
  const seen = (await page.evaluate(() => (window as unknown as { __seen: Seen[] }).__seen)).filter((e) => e.key !== null);
  const first = clickStarts(await playRecord(page))[0].when;

  const order = seen.map((e) => `${e.card}|${e.key}`);
  expect(order, "the outline's order is the drawn page's order").toEqual(expected.map((e) => `${e.card}|${e.key}`));

  const late: string[] = [];
  const words: string[] = [];
  seen.forEach((e, k) => {
    const due = first + (4 + k) * BEAT;
    if (e.at < due - 0.005 || e.at > due + 0.05) late.push(`hit ${k} at ${(e.at - due).toFixed(3)} s`);
    const want = expected[k];
    if (want && want.count > 1 && !new RegExp(`^pass \\d+ of \\d+$`).test(e.words)) words.push(`hit ${k} card ${e.card}: "${e.words}"`);
  });
  expect(late, "outline changes later than 50 ms after the note").toEqual([]);
  expect(words, "drawn-once cards show their live pass words").toEqual([]);

  // The pass words step through the passes of each drawn-once card.
  const byCard = new Map<string, string[]>();
  seen.forEach((e, k) => {
    if (expected[k]?.count > 1) {
      const list = byCard.get(e.card!) ?? [];
      if (list[list.length - 1] !== e.words) list.push(e.words);
      byCard.set(e.card!, list);
    }
  });
  for (const [card, list] of byCard) {
    const ks = list.map((w) => Number(/^pass (\d+)/.exec(w)?.[1]));
    for (let i = 1; i < ks.length; i++) expect(ks[i], `card ${card} words ${list.join(", ")}`).toBe(ks[i - 1] + 1);
  }
  await expect(page.locator(".tab-column-reading")).toHaveCount(0);
});
