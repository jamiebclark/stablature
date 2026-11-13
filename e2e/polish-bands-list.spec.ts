import { expect, test, type Page } from "@playwright/test";

/**
 * Spec 008 US6, INV-017: the bands list shows a live song count, never the slug, and makes no request to count.
 * Phone only.
 */
test.setTimeout(120_000);

async function addBand(page: Page, name: string) {
  await page.goto("/");
  await page.getByLabel("Band name").fill(name);
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  return page.url();
}

async function addSongs(page: Page, bandUrl: string, titles: string[]) {
  for (const title of titles) {
    await page.goto(bandUrl);
    await page.getByLabel("Song title").fill(title);
    await page.getByRole("button", { name: "Add song" }).click();
    await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  }
}

const row = (page: Page, name: string) => page.getByRole("link", { name: new RegExp(`^${name}`) });

test("INV-017: the count line is right, there is no slug, and no request counts", async ({ page, browser }, info) => {
  test.skip(info.project.name !== "mobile", "phone only");
  await page.setViewportSize({ width: 375, height: 667 });
  const empty = await addBand(page, "Zero Band");
  const one = await addBand(page, "Solo Band");
  const three = await addBand(page, "Trio Band");
  await addSongs(page, one, ["A"]);
  await addSongs(page, three, ["B", "C", "D"]);
  expect(empty).not.toBe(one);

  // Delete one of the trio's songs straight in IndexedDB (tombstone), as sync would.
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/");
  await expect(row(page, "Trio Band")).toContainText("3 songs");
  await expect(row(page, "Solo Band")).toContainText("1 song");
  await expect(row(page, "Solo Band")).not.toContainText("1 songs");
  await expect(row(page, "Zero Band")).toContainText("No songs yet");
  for (const slug of ["zero-band", "solo-band", "trio-band"]) {
    await expect(page.locator("main")).not.toContainText(slug);
  }

  await page.evaluate(async () => {
    const dbs = await indexedDB.databases();
    const name = dbs.find((d) => d.name)!.name!;
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open(name);
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("songs", "readwrite");
        const store = tx.objectStore("songs");
        const all = store.getAll();
        all.onsuccess = () => {
          const song = all.result.find((s: { title: string }) => s.title === "B");
          store.put({ ...song, deletedAt: new Date().toISOString() });
        };
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.reload(); // a raw write bypasses Dexie's change notice
  await expect(row(page, "Trio Band")).toContainText("2 songs");

  // A song arriving in a second context's sync is the same write path; here, the first context's own
  // later write must update the open list live.
  const second = await page.context().newPage();
  await second.setViewportSize({ width: 375, height: 667 });
  await addSongs(second, empty, ["E"]);
  await expect(row(page, "Zero Band")).toContainText("1 song");

  expect(requests.filter((u) => /\/api\//.test(u) && !/sync|auth/.test(u)), "no counting request").toEqual([]);
  void browser;
});
