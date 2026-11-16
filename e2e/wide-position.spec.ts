/** INV-009 / INV-020: the keys and the following walk every pass and light the right column on the drawn-once card. */
import { expect, test, type Page } from "@playwright/test";
import { FOLD, openFourString, seedFitSong, seedFold } from "./wide-helpers";
import { setStoredTempo } from "./rhythm-probe-helpers";

test.setTimeout(180_000);

interface Step {
  card: string | null;
  column: string | null;
  words: string | null;
  reading: number;
}

/** Presses a key `count` times as the app's single window listener sees it, recording what is lit after each. */
const walk = (page: Page, key: string, count: number) =>
  page.evaluate(
    ({ key, count }) => {
      const out: Step[] = [];
      const cards = [...document.querySelectorAll<HTMLElement>("ol.reading-cards > li")];
      for (let i = 0; i < count; i++) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
        const lit = document.querySelector(".tab-column-reading");
        const li = lit?.closest("li[data-card]") ?? null;
        out.push({
          card: li?.getAttribute("data-card") ?? null,
          column: lit?.getAttribute("data-column") ?? null,
          words: li?.querySelector('[data-testid="card-passes-live"]')?.textContent ?? null,
          reading: cards.filter((c) => c.hasAttribute("data-reading")).length,
        });
      }
      return out;
    },
    { key, count },
  );

const geometry = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("ol.reading-cards > li")].map((li) => {
      const r = li.getBoundingClientRect();
      return [r.left, r.top + scrollY, r.width, r.height];
    }),
  );

const cardRanges = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("ol.reading-cards > li")].map((li) => ({
      card: li.getAttribute("data-card"),
      first: Number(li.dataset.firstPass),
      last: Number(li.dataset.lastPass),
      columns: [...li.querySelectorAll('[data-testid="tab-column"]')].filter((c) => c.getAttribute("data-barline") !== "true").length,
    })),
  );

/** The staves fill in after the cards mount: wait until every card has its columns. */
const settle = (page: Page) =>
  page.waitForFunction(() => {
    const cards = [...document.querySelectorAll("ol.reading-cards > li")];
    return cards.length > 0 && cards.every((li) => li.querySelectorAll("[data-column]").length > 0);
  });

const litKey = (page: Page) => page.evaluate(() => document.querySelector(".tab-column-reading")?.getAttribute("data-column") ?? null);

for (const id of ["fit", "F5", "F8"]) {
  for (const width of [375, 1280]) {
    test(`INV-009 keys walk every pass of ${id} at ${width}`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "the viewport is set here");
      await page.setViewportSize({ width, height: 800 });
      const row = FOLD.find((r) => r.id === id);
      const seeded = row ? await seedFold(page, row) : await seedFitSong(page);
      await page.goto(seeded.playUrl);
      const first = page.locator("ol.reading-cards > li").first();
      await expect(first).toBeVisible();
      await expect(first).toHaveAttribute("data-card", /\d+/);
      if (!row) await expect(page.locator("ol.reading-cards > li")).toHaveCount(6);
      await settle(page);
      const ranges = await cardRanges(page);
      const before = await geometry(page);
      await page.evaluate(() => {
        const log: number[] = [];
        (window as unknown as { __child: number[] }).__child = log;
        for (const s of document.querySelectorAll(".tab-staff"))
          new MutationObserver((m) => log.push(...m.map(() => 1))).observe(s, { childList: true });
      });
      const total = ranges.reduce((n, r) => n + (r.last - r.first + 1) * r.columns, 0);
      const steps = await walk(page, "ArrowRight", total);
      let k = 0;
      for (const r of ranges) {
        const passes = r.last - r.first + 1;
        let from = -1;
        for (let pass = 0; pass < passes; pass++) {
          for (let c = 0; c < r.columns; c++, k++) {
            expect(steps[k].card, `step ${k}`).toBe(r.card);
            expect(steps[k].reading, `step ${k}`).toBe(1);
            if (passes > 1) {
              // The live words read `pass k of n` for the entry; k advances by one for each pass of the card.
              const m = /^pass (\d+) of (\d+)$/.exec(steps[k].words ?? "");
              expect(m, `step ${k}: ${steps[k].words}`).not.toBeNull();
              if (from < 0) from = Number(m![1]) - pass;
              expect(Number(m![1]), `step ${k}`).toBe(from + pass);
            }
          }
        }
      }
      const back = await walk(page, "ArrowLeft", total - 1);
      expect(back.at(-1)?.card).toBe(steps[0].card);
      expect(back.at(-1)?.column).toBe(steps[0].column);
      const after = await geometry(page);
      after.forEach((r, i) => r.forEach((v, j) => expect(Math.abs(v - before[i][j])).toBeLessThanOrEqual(0.5)));
      expect(await page.evaluate(() => (window as unknown as { __child: number[] }).__child.length)).toBe(0);
    });
  }
}

test("INV-009 Stop and Start leave no card reading; INV-020 a resize keeps the lit key", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "the viewport is set here");
  await page.setViewportSize({ width: 1280, height: 800 });
  const { playUrl } = await seedFitSong(page);
  await setStoredTempo(page, 300);
  await page.goto(playUrl);
  await expect(page.locator("ol.reading-cards > li[data-card]")).toHaveCount(6);
  await settle(page);
  await walk(page, "ArrowRight", 20);
  const key = await litKey(page);
  expect(key).not.toBeNull();
  for (const width of [768, 767, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    await page.waitForTimeout(400);
    expect(await litKey(page), `at ${width}`).toBe(key);
  }
  await page.getByTestId("click-start").click();
  await page.waitForTimeout(1500);
  expect(await page.locator("li[data-reading]").count()).toBeLessThanOrEqual(1);
  await page.getByTestId("click-stop").click();
  await page.waitForTimeout(300);
  expect(await page.locator("li[data-reading]").count()).toBe(0);
});

/** INV-009 / FR-013 / FR-015 (review F1): a single pass of a repeated entry keeps `pass k of n` while it is read. */
/** What a reader sees of the pass words on every card holding `card-passes`, after each "column on". */
const walkPassWords = (page: Page, count: number) =>
  page.evaluate((count) => {
    const out: { card: string | null; seen: string; rest: string; live: string }[] = [];
    for (let i = 0; i < count; i++) {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
      const li = document.querySelector(".tab-column-reading")?.closest("li[data-card]") ?? null;
      const slot = li?.querySelector('[data-testid="card-passes"]');
      if (!li || !slot) continue;
      const rest = slot.querySelector<HTMLElement>('[data-testid="card-passes-rest"]')!;
      const live = slot.querySelector<HTMLElement>('[data-testid="card-passes-live"]')!;
      const visible = (el: HTMLElement) => getComputedStyle(el).visibility !== "hidden" && getComputedStyle(el).display !== "none";
      const seen = [rest, live].filter(visible).map((el) => el.textContent ?? "").join("").trim();
      out.push({ card: li.getAttribute("data-card"), seen, rest: rest.textContent ?? "", live: live.textContent ?? "" });
    }
    return out;
  }, count);

const settleCards = (page: Page) =>
  page.waitForFunction(() => {
    const cards = [...document.querySelectorAll("ol.reading-cards > li")];
    return cards.length > 0 && cards.every((li) => li.querySelectorAll("[data-column]").length > 0);
  });

for (const id of ["fit", "F3"]) {
  for (const width of [375, 1280]) {
    test(`pass words stay readable on every card while it is read: ${id} at ${width}`, async ({ page }, info) => {
      test.skip(info.project.name !== "desktop", "keys; the viewport is set here");
      await page.setViewportSize({ width, height: 800 });
      const row = FOLD.find((r) => r.id === id);
      const seeded = row ? await seedFold(page, row) : await seedFitSong(page);
      await page.goto(seeded.playUrl);
      await settleCards(page);
      const columns = await page.evaluate(() => document.querySelectorAll("ol.reading-cards [data-column]").length);
      const steps = await walkPassWords(page, columns * 4);
      expect(steps.length).toBeGreaterThan(0);
      const blank = steps.filter((s) => s.seen === "");
      // Every card that carries pass words must show some while the reading position is on it.
      expect(blank.map((s) => `card ${s.card}: rest "${s.rest}" hidden, live "${s.live}"`).slice(0, 3)).toEqual([]);
    });
  }
}

// --- review F7: the click following and the bar steps (adopted from INV-009-020 probe) ---
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
