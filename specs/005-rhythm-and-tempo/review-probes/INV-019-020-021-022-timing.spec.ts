/**
 * INV-019, INV-020, INV-021, INV-022, SC-005 through the recorder. When audio starts, the count-in at
 * 40, 120 and 240 bpm with what the screen numbers, a stop during each count, a real 60-second run,
 * and a 200ms stall and a landing of 500 rows in each stage.
 */
import { expect, test, type Page } from "@playwright/test";
import { cols, idb, landed, level, rec, recorder, seed } from "./helpers";

test("INV-019 no context before the tap; made and resumed inside it", async ({ page }) => {
  await recorder(page);
  const { songUrl, playUrl } = await seed(page, cols(null, null), { bpm: 120 });
  await page.goto(playUrl);
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.mouse.wheel(0, 300);
  await page.getByTestId("tempo-control").click();
  await page.keyboard.press("Escape");
  expect((await rec(page)).contexts).toBe(0);

  const inside = await page.getByTestId("click-start").evaluate((b) => {
    const w = window as unknown as { __rec: { contexts: number; resumes: unknown[] } };
    (b as HTMLButtonElement).click();
    return { made: w.__rec.contexts, resumed: w.__rec.resumes.length };
  });
  expect(inside).toEqual({ made: 1, resumed: 1 });
  const r = await rec(page);
  expect(r.madeInTap).toEqual([true]);
  expect(r.resumes.map((x) => x.inTap)).toEqual([true]);

  await page.getByTestId("click-stop").click();
  await page.getByRole("link", { name: "Song" }).click();
  await expect(page).toHaveURL(songUrl);
  await page.getByRole("link", { name: "Play view" }).click();
  await expect(page.getByTestId("click-start")).toBeEnabled();
  await page.waitForTimeout(300);
  expect((await rec(page)).contexts, "returning made a context").toBe(1);
});

for (const shape of [
  { name: "no tempo", bpm: null, arrange: true },
  { name: "no arrangement", bpm: 120, arrange: false },
]) {
  test(`INV-019 ${shape.name}: nothing made by opening the screen`, async ({ page }) => {
    await recorder(page);
    const { playUrl } = await seed(page, cols(null), { bpm: shape.bpm, arrange: shape.arrange });
    await page.goto(playUrl);
    await expect(page.getByTestId("click-bar")).toBeVisible();
    await page.waitForTimeout(300);
    expect((await rec(page)).contexts).toBe(0);
  });
}

/** Everything the count element shows, as it shows it. */
const watchCount = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __count: string[] };
    w.__count = [];
    new MutationObserver(() => {
      const el = document.querySelector("[data-role=count]");
      const t = el?.textContent ?? "";
      if (t && w.__count.at(-1) !== t) w.__count.push(t);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });

for (const bpm of [40, 120, 240]) {
  test(`INV-020 four clicks a beat apart at ${bpm}, numbered, the next one beat later; five starts`, async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    test.setTimeout(120_000);
    await recorder(page);
    const { playUrl } = await seed(page, cols(null), { bpm });
    await page.goto(playUrl);
    await watchCount(page);
    const beat = 60 / bpm;
    for (let run = 0; run < (bpm === 40 ? 2 : 5); run++) {
      const before = (await rec(page)).starts.length;
      await page.evaluate(() => ((window as unknown as { __count: string[] }).__count = []));
      await page.getByTestId("click-start").click();
      await expect
        .poll(async () => (await rec(page)).starts.length - before, { timeout: 15_000 })
        .toBeGreaterThanOrEqual(5);
      const five = (await rec(page)).starts.slice(before, before + 5);
      five.forEach((s, i) => {
        expect(s.hz).toBe(1300);
        if (i) expect(Math.abs(s.when - five[i - 1].when - beat)).toBeLessThan(0.001);
      });
      await expect
        .poll(() => page.evaluate(() => (window as unknown as { __count: string[] }).__count.length), {
          timeout: 15_000,
        })
        .toBeGreaterThanOrEqual(4);
      expect(await page.evaluate(() => (window as unknown as { __count: string[] }).__count.slice(0, 4))).toEqual([
        "1",
        "2",
        "3",
        "4",
      ]);
      await page.getByTestId("click-stop").click();
    }
  });
}

for (const stopAt of [1, 2, 3, 4]) {
  test(`INV-020 stop during count ${stopAt}, then start: it counts from one`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    await recorder(page);
    const { playUrl } = await seed(page, cols("q", "q"), { bpm: 60 });
    await page.goto(playUrl);
    await watchCount(page);
    await page.getByTestId("click-start").click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __count: string[] }).__count.at(-1)), {
        timeout: 8000,
      })
      .toBe(String(stopAt));
    await page.getByTestId("click-stop").click();
    await page.evaluate(() => ((window as unknown as { __count: string[] }).__count = []));
    await page.getByTestId("click-start").click();
    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __count: string[] }).__count[0]), { timeout: 4000 })
      .toBe("1");
  });
}

test("SC-005 the first click is within 200ms of the tap", async ({ page }) => {
  await recorder(page);
  const { playUrl } = await seed(page, cols(null), { bpm: 120 });
  await page.goto(playUrl);
  for (let i = 0; i < 5; i++) {
    const tapped = await page.getByTestId("click-start").evaluate((b) => {
      const t = performance.now();
      (b as HTMLButtonElement).click();
      return t;
    });
    await expect
      .poll(async () => (await rec(page)).starts.length, { timeout: 3000 })
      .toBeGreaterThan(0);
    const r = await rec(page);
    const first = r.starts.at(i === 0 ? 0 : -1)!;
    const firstOfRun = r.starts.filter((s) => s.at >= tapped)[0] ?? first;
    const sounds = firstOfRun.at + (firstOfRun.when - firstOfRun.now) * 1000;
    expect(sounds - tapped).toBeLessThan(200);
    await page.getByTestId("click-stop").click();
  }
});

test("INV-021 a real 60-second run: every click within 1ms of ideal, no growth", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "one clock, one run");
  test.setTimeout(120_000);
  await recorder(page);
  const { playUrl } = await seed(page, cols("8", "8", "8", "8", "|", "q", "q"), { bpm: 240 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await page.waitForTimeout(60_000);
  const starts = (await rec(page)).starts;
  await page.getByTestId("click-stop").click();
  expect(starts.length).toBeGreaterThan(230);
  const t0 = starts[0].when;
  starts.forEach((s, k) => {
    // Count-in, then eight beats' worth of score at most, then one a beat: all on the eighth grid.
    const eighths = (s.when - t0) / 0.125;
    expect(Math.abs(eighths - Math.round(eighths)) * 125, `click ${k}`).toBeLessThan(1);
  });
  expect(new Set(starts.map((s) => s.when)).size).toBe(starts.length);
  expect(starts.every((s) => s.when >= s.now), "scheduled in the past").toBe(true);
});

const STALL = (ms: number) => `(() => { const end = performance.now() + ${ms}; while (performance.now() < end); })()`;

for (const stage of ["count-in", "following", "plain"] as const) {
  test(`INV-022 a 200ms stall during ${stage} moves and drops nothing`, async ({ page }, info) => {
    test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
    await recorder(page);
    const { playUrl } = await seed(page, cols("q", "q", "q", "q", "q", "q", "q", "q"), { bpm: 120 });
    await page.goto(playUrl);
    await page.getByTestId("click-start").click();
    if (stage === "following") await expect(page.getByTestId("click-state")).toHaveText("Following the notation.");
    if (stage === "plain") await expect(page.getByTestId("click-state")).toHaveText("Plain beat.", { timeout: 9000 });
    await page.evaluate(STALL(200));
    await page.waitForTimeout(100);
    await page.evaluate(STALL(200));
    await page.waitForTimeout(1500);
    await expect(page.getByTestId("click-stop")).toBeVisible();
    const starts = (await rec(page)).starts;
    await page.getByTestId("click-stop").click();
    starts.forEach((s, i) => {
      if (i) expect(Math.abs(s.when - starts[i - 1].when - 0.5), `click ${i}`).toBeLessThan(0.001);
    });
  });
}

test("INV-022 500 rows landing mid-run, and the whole play view drawn again, move and drop nothing", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "the engine and hook do not differ by device");
  await recorder(page);
  const { playUrl, partId } = await seed(page, cols(null), { bpm: 120, passes: 8 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").click();
  await expect(page.getByTestId("click-state")).toHaveText("Plain beat.", { timeout: 5000 });
  await idb(
    page,
    `const tx = db.transaction("events", "readwrite");
     const s = tx.objectStore("events");
     const r = s.getAll();
     r.onsuccess = () => {
       const template = r.result.find((x) => x.partId === arg.partId);
       for (let i = 0; i < 500; i++) {
         s.put({ ...template, id: crypto.randomUUID(), rank: template.rank + "V" + String(i).padStart(4, "0") });
       }
     };
     await new Promise((res) => (tx.oncomplete = res));`,
    { partId },
  );
  await landed(page);
  await expect(page.getByTestId("tab-column")).toHaveCount(8 * 501, { timeout: 15_000 });
  await page.waitForTimeout(1000);
  await expect(page.getByTestId("click-stop")).toBeVisible();
  const starts = (await rec(page)).starts;
  await page.getByTestId("click-stop").click();
  starts.forEach((s, i) => {
    if (i) expect(Math.abs(s.when - starts[i - 1].when - 0.5), `click ${i}`).toBeLessThan(0.001);
  });
  expect(starts.map((s) => level(s.hz)).every((l) => l === "beat")).toBe(true);
});
