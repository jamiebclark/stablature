/**
 * Review probe, spec 008 INV-019 over the plan's set: {1, 5, 12 parts} × {a short title, a 120-character title}
 * × **Th** × {375, 390}, signed out with work pending. The short form is no wider than a `99 unsynced` span with
 * today's classes in the same header; the back button keeps 8ch; the open chip is inside the chip strip's visible
 * rect; the link is at least 44 tall and named SAVED_HERE_NAME; nothing overflows the row.
 * The implementation's spec covers one part, a short title and one theme.
 */
import { expect, test, type Page } from "@playwright/test";
import { startWith, TUNINGS } from "../../../e2e/probe-helpers";

test.setTimeout(300_000);

const NAME = "Saved on this device. Sign in to sync with your band.";
const LONG = "A very long song title that keeps going well past any width a phone header could hold, so that it must be cut short.".slice(0, 120);

async function songWithParts(page: Page, title: string, parts: number) {
  const { songUrl } = await startWith(page, TUNINGS[2], `Band ${parts} ${title.length}`);
  if (title !== "Dirge") {
    await page.goto(songUrl);
    // Rename through IndexedDB: the title is plain data, and a reload shows it.
    await page.evaluate(async (t) => {
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open("stablature");
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction("songs", "readwrite");
          const store = tx.objectStore("songs");
          const all = store.getAll();
          all.onsuccess = () => all.result.forEach((s) => store.put({ ...s, title: t }));
          tx.oncomplete = () => (db.close(), resolve());
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      });
    }, title);
  }
  await page.goto(`${songUrl}/capture`);
  for (let i = 1; i < parts; i++) {
    const before = page.url();
    await page.getByRole("button", { name: "Add a part" }).click();
    await expect(page).not.toHaveURL(before);
  }
  return page.url();
}

for (const parts of [1, 5, 12]) {
  for (const title of ["Dirge", LONG]) {
    test(`INV-019 ${parts} part(s), ${title.length}-character title`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "phone header");
      const partUrl = await songWithParts(page, title, parts);
      const bad: string[] = [];
      for (const theme of ["dark", "light"] as const) {
        for (const width of [375, 390]) {
          await page.emulateMedia({ colorScheme: theme });
          await page.setViewportSize({ width, height: 667 });
          await page.goto(partUrl);
          const link = page.getByRole("link", { name: NAME });
          await expect(link).toBeVisible({ timeout: 15_000 });
          await expect(link).toHaveText("saved · sign in");
          const m = await page.evaluate(() => {
            const row = document.querySelector<HTMLElement>('[data-testid="capture-title-row"]')!;
            const a = [...row.querySelectorAll("a")].find((x) => x.getAttribute("aria-label")?.startsWith("Saved on this device"))!;
            const probe = document.createElement("span");
            probe.className = "shrink-0 font-mono text-[0.7rem] text-text-faint";
            probe.textContent = "99 unsynced";
            a.parentElement!.append(probe);
            const budget = probe.getBoundingClientRect().width;
            probe.remove();
            const back = row.querySelector<HTMLElement>('button[aria-label^="Back to"]')!;
            const ch = document.createElement("span");
            ch.style.cssText = "display:inline-block;width:8ch;position:absolute;visibility:hidden";
            back.append(ch);
            const eight = ch.getBoundingClientRect().width;
            ch.remove();
            const open = row.querySelector<HTMLElement>("a.bg-accent")!;
            const strip = open.parentElement!.getBoundingClientRect();
            const chip = open.getBoundingClientRect();
            const r = a.getBoundingClientRect();
            return {
              link: { w: r.width, h: r.height },
              budget,
              back: back.getBoundingClientRect().width,
              eight,
              chipInStrip: chip.left >= strip.left - 0.5 && chip.right <= strip.right + 0.5,
              over: row.scrollWidth - row.clientWidth,
            };
          });
          const label = `${theme} ${width}`;
          if (m.link.w > m.budget + 0.5) bad.push(`${label}: link ${m.link.w.toFixed(1)} wider than 99 unsynced ${m.budget.toFixed(1)}`);
          if (m.link.h < 43.5) bad.push(`${label}: link ${m.link.h} tall`);
          if (m.back < m.eight - 0.5) bad.push(`${label}: back ${m.back.toFixed(1)} under 8ch ${m.eight.toFixed(1)}`);
          if (!m.chipInStrip) bad.push(`${label}: open chip out of the strip's view`);
          if (m.over > 0.5) bad.push(`${label}: row overflows by ${m.over}`);
        }
      }
      expect(bad).toEqual([]);
    });
  }
}
