import { openCluster } from "./usability-helpers";
import { expect, test } from "@playwright/test";
import { installRecorder, recorded, seedPlayable } from "./click-helpers";
import { cols, seed } from "./rhythm-probe-helpers";

const HELP = "Can't hear it? Check the silent switch and volume.";

test.describe("the click", () => {
  test("makes no audio context until the tap, and then makes one in the tap's task", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    await page.mouse.wheel(0, 400);
    await page.getByTestId("tempo-control").click();
    await page.keyboard.press("Escape");
    expect((await recorded(page)).contexts).toHaveLength(0);

    const made = await page.getByTestId("click-start").evaluate((btn) => {
      const rec = (window as unknown as { __rec: { contexts: unknown[] } }).__rec;
      (btn as HTMLButtonElement).click();
      return rec.contexts.length;
    });
    expect(made).toBe(1);
    await expect(page.getByTestId("click-stop")).toBeFocused();
    await expect(page.getByTestId("click-beat")).toHaveAttribute("aria-hidden", "true");
  });

  test("counts in at the tempo, then keeps a steady beat; stop closes at once", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-state")).toHaveText("Counting in.");
    await expect(page.getByTestId("click-help")).toHaveText(HELP);
    await expect
      .poll(async () => (await recorded(page)).starts.length, { timeout: 8000 })
      .toBeGreaterThanOrEqual(6);
    const starts = (await recorded(page)).starts.slice(0, 6);
    starts.forEach((s, i) => {
      expect(s.hz).toBe(1300);
      if (i > 0) expect(Math.abs(s.when - starts[i - 1].when - 0.5)).toBeLessThan(0.001);
    });
    await expect(page.getByTestId("click-state")).toHaveText("Plain beat.");

    const closes = await page.getByTestId("click-stop").evaluate((btn) => {
      const rec = (window as unknown as { __rec: { closes: number } }).__rec;
      (btn as HTMLButtonElement).click();
      return rec.closes;
    });
    expect(closes).toBe(1);
    await expect(page.getByTestId("click-start")).toBeVisible();
  });

  test("shows the beat in step with the clicks, with nothing animated", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    await page.getByTestId("click-start").click();
    const beat = page.getByTestId("click-beat");
    await expect(beat).toHaveAttribute("data-level", "beat", { timeout: 3000 });
    expect(await beat.evaluate((el) => el.getAnimations({ subtree: true }).length)).toBe(0);
    expect(
      await beat.evaluate((el) => getComputedStyle(el.firstElementChild!).transitionDuration),
    ).toBe("0s");
  });

  test("50 start/stop cycles leave nothing running", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    for (let i = 0; i < 50; i++) {
      await page.getByTestId("click-start").click();
      await page.getByTestId("click-stop").click();
    }
    const rec = await recorded(page);
    expect(rec.contexts).toHaveLength(50);
    expect(rec.closes).toBe(50);
    await expect(page.getByTestId("click-start")).toBeVisible();
  });

  test("leaving the play view closes the context", async ({ page }) => {
    await installRecorder(page);
    const { songUrl } = await seedPlayable(page);
    await page.getByTestId("click-start").click();
    await page.getByRole("link", { name: "Song" }).click();
    await expect(page).toHaveURL(songUrl);
    expect((await recorded(page)).closes).toBe(1);
  });

  test("a hidden page stops the click with a line, and does not restart", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    await page.getByTestId("click-start").click();
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByTestId("click-state")).toHaveText(
      "Stopped because the screen was hidden. Start again when you are ready.",
    );
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByTestId("click-start")).toBeVisible();
    expect((await recorded(page)).contexts).toHaveLength(1);
  });

  for (const audio of ["absent", "throws", "never-resumes"] as const) {
    test(`audio ${audio}: the beat is still shown and the help says so`, async ({ page }) => {
      await installRecorder(page, { audio });
      await seedPlayable(page);
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-help")).toHaveText(
        "No sound on this device. The beat is still shown.",
        { timeout: 4000 },
      );
      await expect(page.getByTestId("click-beat")).toHaveAttribute("data-level", /.+/, {
        timeout: 4000,
      });
    });
  }

  test("never sets the audio session or plays a media element", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    await page.getByTestId("click-start").click();
    await page.getByTestId("click-stop").click();
    const rec = await recorded(page);
    expect([rec.audioSessionWrites, rec.mediaPlays, rec.newAudios]).toEqual([0, 0, 0]);
  });

  test("holds a wake lock only while running, and releases it on every ending", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    expect((await recorded(page)).wakeRequests).toBe(0);
    await page.getByTestId("click-start").click();
    await expect.poll(async () => (await recorded(page)).wakeRequests).toBe(1);
    await page.getByTestId("click-stop").click();
    await expect.poll(async () => (await recorded(page)).wakeReleases).toBe(1);
  });

  test("a rejected wake lock does not stop the click", async ({ page }) => {
    await installRecorder(page, { wakeLock: "rejects" });
    await seedPlayable(page);
    await page.getByTestId("click-start").click();
    await page.waitForTimeout(500);
    await expect(page.getByTestId("click-stop")).toBeVisible();
  });

  test("the status text changes only on a state change", async ({ page }) => {
    await installRecorder(page);
    await seedPlayable(page);
    await page.getByTestId("click-start").click();
    await page.evaluate(() => {
      const w = window as unknown as { __mut: number };
      w.__mut = 0;
      const el = document.querySelector("[data-testid=click-state]")!;
      new MutationObserver((m) => (w.__mut += m.length)).observe(el, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
    await expect(page.getByTestId("click-state")).toHaveText("Plain beat.", { timeout: 8000 });
    await page.waitForTimeout(2000);
    expect(await page.evaluate(() => (window as unknown as { __mut: number }).__mut)).toBeLessThanOrEqual(2);
  });

  test.describe("following the notation", () => {
    test("with no durations there is no follow toggle and the beat is plain", async ({ page }) => {
      await installRecorder(page);
      await seedPlayable(page);
      await expect(page.getByTestId("click-follow")).toHaveCount(0);
      await expect(page.getByTestId("click-state")).toHaveText("Click is a plain beat.");
    });

    test("a real leading empty bar is offered the choice (INV-038)", async ({ page }) => {
      await installRecorder(page);
      const { playUrl } = await seed(page, cols("|", "q", "q"), { bpm: 120 });
      await page.goto(playUrl);
      await expect(page.getByTestId("click-start")).toBeEnabled();
      await expect(page.getByTestId("click-follow")).toHaveCount(1);
    });

    test("a partly noted first bar is not offered the choice (INV-038)", async ({ page }) => {
      await installRecorder(page);
      await seedPlayable(page, { durations: [2, null] });
      await expect(page.getByTestId("click-follow")).toHaveCount(0);
    });

    test("follows two quarters, accent first, then falls to the plain beat", async ({ page }) => {
      await installRecorder(page);
      await seedPlayable(page, { durations: [2, 2] });
      await expect(page.getByTestId("click-follow")).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByTestId("click-state")).toHaveText("Click follows the notation.");
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-state")).toHaveText("Counting in.");
      await expect
        .poll(async () => (await recorded(page)).starts.length, { timeout: 10000 })
        .toBeGreaterThanOrEqual(8);
      const starts = (await recorded(page)).starts.slice(0, 8);
      // Count-in, then the bar's accent and beat, then the plain beat from the end of the score.
      expect(starts.map((s) => s.hz)).toEqual([1300, 1300, 1300, 1300, 2000, 1300, 1300, 1300]);
      starts.forEach((s, i) => {
        if (i > 0) expect(Math.abs(s.when - starts[i - 1].when - 0.5)).toBeLessThan(0.001);
      });
      await expect(page.getByTestId("click-state")).toHaveText("Plain beat.");
    });

    test("the status runs starting/counting in, following, then plain after the end", async ({ page }) => {
      await installRecorder(page);
      await seedPlayable(page, { durations: [2, 2] });
      const seen: string[] = [];
      await page.getByTestId("click-start").click();
      await expect
        .poll(
          async () => {
            const t = (await page.getByTestId("click-state").textContent()) ?? "";
            if (seen[seen.length - 1] !== t) seen.push(t);
            return t;
          },
          { timeout: 10000, intervals: [50] },
        )
        .toBe("Plain beat.");
      expect(seen).toContain("Counting in.");
      expect(seen).toContain("Following the notation.");
      expect(seen.indexOf("Following the notation.")).toBeLessThan(seen.indexOf("Plain beat."));
    });

    test("each pass of a part with no barline is one bar, accented once", async ({ page }) => {
      await installRecorder(page);
      await seedPlayable(page, { durations: [2, 2], passes: 2 });
      await page.getByTestId("click-start").click();
      await expect
        .poll(async () => (await recorded(page)).starts.length, { timeout: 12000 })
        .toBeGreaterThanOrEqual(12);
      const hz = (await recorded(page)).starts.slice(0, 12).map((s) => s.hz);
      // Four count-in, then two passes of one two-beat bar each, then plain.
      expect(hz.slice(4, 8)).toEqual([2000, 1300, 2000, 1300]);
      expect(hz.slice(8).every((h) => h === 1300)).toBe(true);
    });

    test("follow off gives the plain beat from the first click; the choice resets on returning", async ({ page }) => {
      await installRecorder(page);
      const { songUrl } = await seedPlayable(page, { durations: [2, 2] });
      await openCluster(page);
      await page.getByTestId("click-follow").click();
      await expect(page.getByTestId("click-follow")).toHaveAttribute("aria-pressed", "false");
      await expect(page.getByTestId("click-state")).toHaveText("Click is a plain beat.");
      await page.getByTestId("click-start").click();
      await expect
        .poll(async () => (await recorded(page)).starts.length, { timeout: 10000 })
        .toBeGreaterThanOrEqual(6);
      expect((await recorded(page)).starts.slice(0, 6).every((s) => s.hz === 1300)).toBe(true);
      await page.getByTestId("click-stop").click();
      await page.goto(songUrl);
      await page.goto(`${songUrl}/play`);
      await openCluster(page);
      await expect(page.getByTestId("click-follow")).toHaveAttribute("aria-pressed", "true");
    });
  });
});
