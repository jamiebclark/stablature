/**
 * INV-004 / FR-018 (round 4): `npm run test:e2e` went red on 1 run in 4, on the two "chord clear"
 * parity tests, with the sheet's `set` disabled for 30 s. This pins why.
 *
 * TextControl drops its draft as soon as the commit resolves
 * (src/components/capture/ColumnInspector.tsx:112), but `current` comes from a live query that
 * lands later. In the gap the field shows the OLD value and `set` is disabled. Typing the old
 * value during the gap is a no-op to React, which is how a test's `fill("")` vanishes: the
 * field then fills in with "Am" and `set` never enables.
 *
 * Member 1 records every value the field holds across a `set`, sampled on every task and on
 * every frame. Member 2 replays the failing tests' clear, deterministically, in the gap.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, inspector, mouseHold, openDialog, startCapturing } from "./helpers";

async function openSheet(page: Page) {
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await expect(columns(page)).toHaveCount(1);
  await mouseHold(page, columns(page).first());
  await expect(openDialog(page)).toHaveCount(1);
  await inspector(page).getByLabel("chord symbol").fill("Am");
  await expect(inspector(page).getByRole("button", { name: "set" })).toBeEnabled();
}

/** Clicks `set`, samples the field for 400 ms, and optionally types the old value in the gap. */
const across = (typeInGap: string | null) => {
  const root = document.querySelector('[data-testid="column-inspector"]')!;
  const input = root.querySelector<HTMLInputElement>('input[aria-label="chord symbol"]')!;
  const set = [...root.querySelectorAll("button")].find((b) => b.textContent?.trim() === "set")!;
  const write = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  const seen: string[] = [input.value];
  const frames: string[] = [];
  let typed = false;
  return new Promise<{
    seen: string[];
    frames: string[];
    typed: boolean;
    end: string;
    disabled: boolean;
  }>((resolve) => {
    const channel = new MessageChannel();
    const start = performance.now();
    const frame = () => {
      frames.push(input.value);
      if (performance.now() - start < 400) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
    channel.port1.onmessage = () => {
      if (input.value !== seen.at(-1)) seen.push(input.value);
      if (typeInGap !== null && !typed && input.value === typeInGap) {
        typed = true;
        // What Playwright's fill() does.
        write.call(input, typeInGap);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      if (performance.now() - start < 400) channel.port2.postMessage(0);
      else {
        resolve({ seen, frames: [...new Set(frames)], typed, end: input.value, disabled: set.disabled });
      }
    };
    set.click();
    channel.port2.postMessage(0);
  });
};

test("the field never falls back to the old value across a set", async ({ page }) => {
  await openSheet(page);
  const r = await page.evaluate(across, null);
  console.log(`MEASURE gap ${JSON.stringify(r)}`);
  expect(r.seen, "the field holds what was typed").toEqual(["Am"]);
});

test("a clear typed in the gap is not lost", async ({ page }) => {
  await openSheet(page);
  const r = await page.evaluate(across, "");
  console.log(`MEASURE clear-in-gap ${JSON.stringify(r)}`);
  expect(r.typed, "there is no gap to type in").toBe(false);
});
