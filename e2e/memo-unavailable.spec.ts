import { expect, test } from "@playwright/test";
import { landed } from "./reading-helpers";
import { seedMemo, seedSongM, startRecording, withFakeMicrophone, withoutMediaRecorder } from "./memo-helpers";
import { unavailableWords } from "../src/lib/memos/words";

/**
 * INV-020 (e2e): the Record item says why it can't. The `insecure` project is a real plain-http origin; `desktop`
 * covers a browser without MediaRecorder and the one-recording-at-a-time case.
 */
withFakeMicrophone();

const menu = (page: import("@playwright/test").Page, label: string) =>
  page.getByRole("button", { name: new RegExp(`^Actions for part ${label}(,|$)`) });

test("insecure: unavailable with the https words, and a seeded memo still plays", async ({ page }, info) => {
  test.skip(info.project.name !== "insecure", "needs the plain-http origin");
  await seedSongM(page);
  await seedMemo(page, { partLabel: "B", state: "local-signed-out" });
  await landed(page);
  await page.reload();

  await menu(page, "A").click();
  const item = page.getByRole("menuitem", { name: /^Record a memo on part A/ });
  await expect(item).toHaveAttribute("aria-disabled", "true");
  await expect(item).toContainText("(unavailable)");
  await item.click({ force: true }); // aria-disabled: still chooseable by design
  await expect(page.getByTestId("record-unavailable")).toContainText(unavailableWords("insecure"));
  await expect(page.getByTestId("record-panel")).toHaveCount(0);

  const memo = page.getByTestId("memo").first();
  await expect(memo.getByTestId("memo-play")).toBeEnabled();
  await memo.getByTestId("memo-play").click();
  await expect(memo.getByTestId("memo-play")).toHaveAttribute("aria-pressed", "true");
});

test("no MediaRecorder: the no-recorder words", async ({ page }, info) => {
  test.skip(info.project.name === "insecure", "secure origin only");
  await withoutMediaRecorder(page);
  await seedSongM(page);
  await landed(page);
  await menu(page, "A").click();
  const item = page.getByRole("menuitem", { name: /^Record a memo on part A/ });
  await expect(item).toHaveAttribute("aria-disabled", "true");
  await item.click({ force: true }); // aria-disabled: still chooseable by design
  await expect(page.getByTestId("record-unavailable")).toContainText(unavailableWords("no-recorder"));
  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("record-unavailable")).toHaveCount(0);
});

test("one part recording: every other part's item reads busy", async ({ page }, info) => {
  test.skip(info.project.name === "insecure", "secure origin only");
  await seedSongM(page);
  await landed(page);
  await startRecording(page, "A");
  await menu(page, "B").click();
  const item = page.getByRole("menuitem", { name: /^Record a memo on part B/ });
  await expect(item).toHaveAttribute("aria-disabled", "true");
  await item.click({ force: true }); // aria-disabled: still chooseable by design
  await expect(page.getByTestId("record-unavailable")).toContainText(unavailableWords("busy", "B"));
});
