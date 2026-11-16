/**
 * INV-009 and INV-020 (review round 1), the members wide-position.spec.ts does not reach: the click following
 * (its spec only counts `li[data-reading]` after 1.5s), the bar steps, the exact column key at every step, and
 * INV-020 at 768 during a click run.
 *
 * The expected list is built from the DOM the way `readingStops` builds it: card by card, each pass of the card in
 * turn, every non-barline `data-column` of the card. Live words are `pass {a + i} of {n}` on a folded card, where
 * `a` and `n` come from the card's rest words.
 */
import { expect, test, type Page } from "@playwright/test";
import { FOLD, openFourString, seedFitSong, seedFold } from "../../../e2e/wide-helpers";
import { setStoredTempo } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(240_000);

interface Lit {
  card: string | null;
  key: string | null;
  live: string;
}

const expected = (page: Page) =>
  page.evaluate(() => {
    const out: { card: string; key: string; live: string; bar: number }[] = [];
    for (const li of document.querySelectorAll<HTMLElement>("ol.reading-cards > li")) {
      const first = Number(li.dataset.firstPass);
      const last = Number(li.dataset.lastPass);
      const rest = li.querySelector('[data-testid="card-passes-rest"]')?.textContent ?? "";
      const m = /passes (\d+)–\d+ of (\d+)/.exec(rest);
      const keys: { key: string; bar: number }[] = [];
      let bar = 0;
      for (const c of li.querySelectorAll<HTMLElement>("[data-column]")) {
        if (c.getAttribute("data-barline") === "true") {
          bar += 1;
          continue;
        }
        keys.push({ key: c.getAttribute("data-column")!, bar });
      }
      for (let p = first; p <= last; p++) {
        const live = m ? `pass ${Number(m[1]) + (p - first)} of ${m[2]}` : "";
        for (const k of keys) out.push({ card: li.dataset.card!, key: k.key, live, bar: k.bar + 1000 * p });
      }
    }
    return out;
  });

const lit = (page: Page): Promise<Lit> =>
  page.evaluate(() => {
    const el = document.querySelector(".tab-column-reading");
    const li = el?.closest("li[data-card]") ?? null;
    return {
      card: li?.getAttribute("data-card") ?? null,
      key: el?.getAttribute("data-column") ?? null,
      live: li?.querySelector('[data-testid="card-passes-live"]')?.textContent ?? "",
    };
  });

const press = async (page: Page, key: string) => {
  await page.evaluate((key) => window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })), key);
  return lit(page);
};

const settle = (page: Page) =>
  page.waitForFunction(() => {
    const cards = [...document.querySelectorAll("ol.reading-cards > li")];
    return cards.length > 0 && cards.every((li) => li.querySelectorAll("[data-column]").length > 0);
  });

const rects = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("ol.reading-cards > li")].map((li) => {
      const r = li.getBoundingClientRect();
      return [r.left, r.top + scrollY, r.width, r.height];
    }),
  );

for (const width of [375, 768, 1280]) {
  test(`INV-009 bar on and bar back land on the right card and pass at ${width}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "keys; the viewport is set here");
    await page.setViewportSize({ width, height: 800 });
    const { playUrl } = await seedFitSong(page);
    await page.goto(playUrl);
    await settle(page);
    const stops = await expected(page);
    const before = await rects(page);
    // INV-020 for the keys: the walk below must not rebuild a staff or move a card.
    await page.evaluate(() => {
      const w = window as unknown as { __kchild: number };
      w.__kchild = 0;
      for (const s of document.querySelectorAll(".tab-staff")) new MutationObserver((m) => (w.__kchild += m.length)).observe(s, { childList: true, subtree: true });
    });
    // The first stop of each bar, in order: what "bar on" visits.
    const starts = stops.filter((s, i) => i === 0 || s.bar !== stops[i - 1].bar);
    const bad: string[] = [];
    for (let k = 0; k < starts.length; k++) {
      const got = await press(page, "]");
      const want = starts[k];
      if (got.card !== want.card || got.key !== want.key || got.live !== want.live) bad.push(`bar on ${k}: ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    }
    for (let k = starts.length - 2; k >= 0; k--) {
      const got = await press(page, "[");
      const want = starts[k];
      if (got.card !== want.card || got.key !== want.key || got.live !== want.live) bad.push(`bar back ${k}: ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
    }
    expect(starts.length).toBe(38);
    expect(bad.slice(0, 5)).toEqual([]);
    const after = await rects(page);
    after.forEach((r, i) => r.forEach((v, j) => expect(Math.abs(v - before[i][j]), `card ${i} rect ${j}`).toBeLessThanOrEqual(0.5)));
    expect(await page.evaluate(() => (window as unknown as { __kchild: number }).__kchild), "staff DOM rebuilt by the keys").toBe(0);
  });
}

const RUNS: [string, number][] = [["fit", 375], ["fit", 768], ["fit", 1280], ["F5", 375], ["F5", 1280], ["F8", 375], ["F8", 1280]];
for (const [id, width] of RUNS) {
  test(`INV-009/INV-020 the click following walks every column of every pass: ${id} at ${width}`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine does not differ by device");
    await page.setViewportSize({ width, height: 800 });
    const row = FOLD.find((r) => r.id === id);
    const seeded = row ? await seedFold(page, row) : await seedFitSong(page);
    if (row) await openFourString(page, seeded.songUrl);
    const { playUrl } = seeded;
    await setStoredTempo(page, 300);
    await page.goto(playUrl);
    await settle(page);
    const stops = await expected(page);
    const before = await page.evaluate(() =>
      [...document.querySelectorAll("ol.reading-cards > li")].map((li) => {
        const r = li.getBoundingClientRect();
        return [r.left, r.top + scrollY, r.width, r.height];
      }),
    );
    await page.evaluate(() => {
      const w = window as unknown as { __seq: Lit[]; __child: number };
      w.__seq = [];
      w.__child = 0;
      const record = () => {
        const el = document.querySelector(".tab-column-reading");
        const li = el?.closest("li[data-card]") ?? null;
        const now = {
          card: li?.getAttribute("data-card") ?? null,
          key: el?.getAttribute("data-column") ?? null,
          live: li?.querySelector('[data-testid="card-passes-live"]')?.textContent ?? "",
        };
        const prev = w.__seq[w.__seq.length - 1];
        if (now.key && (!prev || prev.key !== now.key || prev.card !== now.card || prev.live !== now.live)) w.__seq.push(now);
      };
      const list = document.querySelector("ol.reading-cards")!;
      new MutationObserver(record).observe(list, { attributes: true, subtree: true, attributeFilter: ["class"], characterData: true, childList: true });
      for (const s of document.querySelectorAll(".tab-staff")) new MutationObserver((m) => (w.__child += m.length)).observe(s, { childList: true, subtree: true });
    });
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-state")).toHaveText("Plain beat.", { timeout: 90_000 });
    const seq = await page.evaluate(() => (window as unknown as { __seq: Lit[] }).__seq);
    const child = await page.evaluate(() => (window as unknown as { __child: number }).__child);
    await page.getByTestId("click-stop").click();
    const after = await page.evaluate(() =>
      [...document.querySelectorAll("ol.reading-cards > li")].map((li) => {
        const r = li.getBoundingClientRect();
        return [r.left, r.top + scrollY, r.width, r.height];
      }),
    );
    // The live words settle one write after the class; keep the last state seen for each (card, key) step.
    const steps: Lit[] = [];
    for (const s of seq) {
      const prev = steps[steps.length - 1];
      if (prev && prev.card === s.card && prev.key === s.key) steps[steps.length - 1] = s;
      else steps.push(s);
    }
    const want = stops.map(({ card, key, live }) => ({ card, key, live }));
    const firstBad = want.findIndex((w, i) => !steps[i] || steps[i].card !== w.card || steps[i].key !== w.key || steps[i].live !== w.live);
    expect(firstBad === -1 ? null : { at: firstBad, got: steps[firstBad] ?? null, want: want[firstBad] }).toBeNull();
    expect(steps.length).toBe(want.length);
    expect(child, "staff DOM rebuilt during the run").toBe(0);
    after.forEach((r, i) => r.forEach((v, j) => expect(Math.abs(v - before[i][j]), `card ${i} rect ${j}`).toBeLessThanOrEqual(0.5)));
    expect(await page.locator("li[data-reading]").count(), "no card reading after Stop").toBe(0);
  });
}
