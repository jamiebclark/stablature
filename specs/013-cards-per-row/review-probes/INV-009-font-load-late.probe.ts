/**
 * Review probe (round 4), INV-009's trigger "`document.fonts` load completes": `cards-follow.spec.ts:61` asks for
 * `document.fonts.load("1em monospace")` after the fonts are already in, which re-measures nothing. Here the web fonts
 * (`/_next/static/media/*.woff2`) are held back, so `useCardTrack` first measures the fallback faces. Then they are
 * released. After `document.fonts.ready` and two frames, INV-002 (drawn rows = greedy rows of own widths measured now)
 * and INV-006 (no card under its measured minimum) must hold again, with no reload.
 *
 * It also logs what a reader sees right after `document.fonts.ready` resolves, before any frame runs. That is the
 * window `wide-order.spec.ts:44-47` reads in (it polls only for `--own-head` being present), so it explains a flake
 * seen there under load in round 4.
 */
import { expect, test } from "@playwright/test";
import { seedFitSong, seedWideSong } from "../../../e2e/wide-helpers";
import { drawn, greedy, measure, own } from "./measure";

test.setTimeout(300_000);
test.use({ serviceWorkers: "block" });
type Urls = { songUrl: string; playUrl: string };

for (const song of ["fit", "short"] as const) {
  for (const width of [768, 1280]) {
    test(`INV-009 a late web font re-measures every card: ${song} @${width}`, async ({ page }, info) => {
      test.skip(info.project.name === "probe-mobile", "viewport is set here; desktop and firefox only");
      const urls = (song === "fit" ? await seedFitSong(page) : await seedWideSong(page, "short")) as unknown as Urls;
      const bad: string[] = [];
      for (const [pg, url] of [["song", urls.songUrl], ["play", urls.playUrl]] as const) {
        let release!: () => void;
        const gate = new Promise<void>((r) => (release = r));
        await page.route("**/_next/static/media/**", async (route) => {
          await gate;
          await route.continue();
        });
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url, { waitUntil: "commit" });
        await expect(page.locator(".reading-cards > li").first()).toBeAttached();
        await expect
          .poll(() => page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".reading-cards > li")].every((li) => li.style.getPropertyValue("--own-head") !== "")))
          .toBe(true);
        await page.waitForTimeout(500);
        const early = await page.evaluate(() => ({
          fonts: [...document.fonts].filter((f) => f.status === "loaded").length,
          heads: [...document.querySelectorAll<HTMLElement>(".reading-cards > li")].map((li) => li.style.getPropertyValue("--own-head")),
        }));
        release();
        // What a test reading right after fonts.ready sees, before a frame runs.
        const atReady = await page.evaluate(async () => {
          await document.fonts.ready;
          return [...document.querySelectorAll<HTMLElement>(".reading-cards > li")].map((li) => Math.round(li.getBoundingClientRect().width));
        });
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        });
        await page.waitForTimeout(300);
        await page.unroute("**/_next/static/media/**");
        const m = await measure(page);
        const where = `${song} ${pg} @${width}`;
        const heads = m.cards.map((c) => c.ownHeadVar);
        console.log(
          `${where}: fonts loaded while held ${early.fonts}; --own-head held ${early.heads.join(",")} → after ${heads.join(",")}; ` +
            `widths at fonts.ready ${atReady.join(",")} → settled ${m.cards.map((c) => Math.round(c.width)).join(",")}`,
        );
        if (m.display !== "flex") {
          bad.push(`${where}: list display ${m.display}`);
          continue;
        }
        const w = own(m);
        const g = greedy(w, m.row, m.gap);
        if (!g.tie && JSON.stringify(drawn(m.cards)) !== JSON.stringify(g.rows)) bad.push(`${where}: rows ${JSON.stringify(drawn(m.cards))} vs greedy ${JSON.stringify(g.rows)}`);
        const chrome = 2 * m.tok.padX + 2;
        m.cards.forEach((c, i) => {
          const least = c.memo ? Math.max(m.tok.floor, m.tok.min) : Math.max(m.tok.min, Math.min(c.head + chrome, m.tok.floor));
          if (c.width < Math.min(least, m.row) - 0.5) bad.push(`${where}: card ${i + 1} ${c.width.toFixed(1)} under its minimum ${least.toFixed(1)}`);
          if (Math.abs(parseFloat(c.ownHeadVar) - Math.ceil(c.head)) > 1) bad.push(`${where}: card ${i + 1} --own-head ${c.ownHeadVar} stale against its head ${c.head.toFixed(1)}`);
        });
      }
      expect(bad).toEqual([]);
    });
  }
}
