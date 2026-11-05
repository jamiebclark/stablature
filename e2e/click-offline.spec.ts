import { execSync } from "node:child_process";
import { expect, test } from "@playwright/test";
import { installRecorder, seedPlayable } from "./click-helpers";

test("a run makes no requests once the page is in", async ({ page, context }) => {
  await installRecorder(page);
  await seedPlayable(page);
  // Let the page's own arrival prefetching finish: the claim is about the run.
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await context.setOffline(true);
  await page.getByTestId("click-start").click();
  await page.waitForTimeout(1500);
  await page.getByTestId("click-stop").click();
  await context.setOffline(false);
  expect(requests.filter((u) => !u.startsWith("data:") && !u.startsWith("blob:"))).toEqual([]);
});

test("the rhythm code never loads anything lazily", () => {
  const hits = execSync(
    'git grep -nE "next/dynamic|React\\.lazy|[^a-zA-Z.]import\\(" -- src/lib/rhythm src/components/rhythm ":!*__tests__*" || true',
  ).toString();
  expect(hits.trim()).toBe("");
});
