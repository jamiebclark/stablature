/**
 * Diagnostic shared by INV-005/INV-006 and story 3: what a real TOUCH long press
 * does on the capture staff. The project suite only ever long-presses with
 * page.mouse, so on the `mobile` project its holds are pointerType "mouse".
 *
 * Records, in page order, every pointer/contextmenu/click event on the pressed
 * column and every open/close of the dialog, then asserts the story-3 outcome:
 * a touch hold opens the inspector and it is still open after the finger lifts.
 */
import { expect, test } from "@playwright/test";
import { columns, fret, openDialog, startCapturing, touchHold } from "./helpers";

test("a touch long press opens the inspector and it stays open after release", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "touch needs a touch device");
  await startCapturing(page);
  await fret(page, "E", 7).click();
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(2);

  await page.evaluate(() => {
    const log: string[] = [];
    (window as unknown as { __log: string[] }).__log = log;
    const t0 = performance.now();
    const stamp = (s: string) => log.push(`${Math.round(performance.now() - t0)} ${s}`);
    for (const type of [
      "pointerdown", "pointermove", "pointerup", "pointercancel",
      "contextmenu", "click", "touchstart", "touchend", "touchcancel",
    ]) {
      document.addEventListener(type, (e) => {
        const tgt = e.target as Element;
        const p = e as PointerEvent;
        stamp(`${type}${p.pointerType ? `(${p.pointerType})` : ""} on ${tgt.tagName}${tgt.getAttribute?.("data-testid") ? `#${tgt.getAttribute("data-testid")}` : ""}${e.defaultPrevented ? " prevented" : ""}`);
      }, { capture: true });
    }
    new MutationObserver(() => {
      const d = document.querySelector("dialog");
      stamp(`dialog open=${d?.open}`);
    }).observe(document.body, { subtree: true, attributes: true, attributeFilter: ["open"] });
  });

  await touchHold(page, columns(page).nth(0), 900);
  await page.waitForTimeout(300);
  const log = await page.evaluate(() => (window as unknown as { __log: string[] }).__log);
  console.log(`touch long-press trace [${info.project.name}]:\n  ${log.join("\n  ")}`);

  await expect(openDialog(page), `trace:\n${log.join("\n")}`).toHaveCount(1);
});
