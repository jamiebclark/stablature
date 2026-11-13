import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { startWith, TUNINGS } from "./probe-helpers";

/**
 * Spec 008 US3: what the app says about saving. INV-018 (the words per session shape), INV-019 (the capture
 * header's short form fits and stays tappable), INV-020 (a sync error outranks the saving words). Phone only.
 */
test.setTimeout(120_000);

const SIX = TUNINGS[2];
const NAME = "Saved on this device. Sign in to sync with your band.";
const SIGNED_IN = {
  session: { id: "s1", token: "t", userId: "u1", expiresAt: "2099-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  user: { id: "u1", email: "a@b.c", name: "A", emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
};

type Sess = "signed-out" | "401" | "network" | "signed-in";
const EXPECT: Record<Sess, "saved-here" | "count"> = {
  "signed-out": "saved-here",
  "401": "saved-here",
  network: "count",
  "signed-in": "count",
};

async function route(context: BrowserContext, sess: Sess, push: "abort" | "500" = "abort") {
  await context.route("**/api/auth/get-session", (r) => {
    if (sess === "network") return r.abort();
    if (sess === "401") return r.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sess === "signed-in" ? SIGNED_IN : null) });
  });
  // Pull would reach the real server, answer 401 and write `signed-out`; keep it offline.
  await context.route("**/api/sync/pull*", (r) => r.abort());
  // Signed in, a push that fails shows the error ahead of the count (INV-020), so hold it: sync stays `syncing`,
  // the outbox keeps its rows, and the count is what the surfaces show.
  await context.route("**/api/sync/push", (r) =>
    sess === "signed-in" && push === "abort"
      ? undefined
      : push === "500" ? r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "push broke" }) }) : r.abort(),
  );
}

const words = (page: Page) => ({
  count: page.getByText(/^\d+ unsynced$/),
  here: page.getByText("Saved on this device", { exact: true }),
  short: page.getByRole("link", { name: NAME }),
});

for (const sess of Object.keys(EXPECT) as Sess[]) {
  test(`INV-018 ${sess}: the top bar and the capture header say the same thing`, async ({ page, context }, info) => {
    test.skip(info.project.name !== "mobile", "phone only");
    await route(context, sess);
    const { songUrl, partUrl } = await startWith(page, SIX);
    // Something is pending: the writes above were queued.
    for (const [url, surface] of [[songUrl, "top bar"], [partUrl, "header"]] as const) {
      await page.goto(url);
      const w = words(page);
      if (EXPECT[sess] === "saved-here") {
        await expect(surface === "top bar" ? w.here : w.short, `${sess} ${surface}`).toBeVisible({ timeout: 15_000 });
        await expect(w.count).toHaveCount(0);
      } else {
        await expect(w.count.first(), `${sess} ${surface}`).toBeVisible({ timeout: 15_000 });
        await expect(w.here).toHaveCount(0);
        await expect(w.short).toHaveCount(0);
      }
    }
  });
}

for (const width of [375, 390]) {
  test(`INV-019 the short form is no wider than 99 unsynced, and tappable, at ${width}`, async ({ page, context }, info) => {
    test.skip(info.project.name !== "mobile", "phone only");
    await route(context, "signed-out");
    const { partUrl } = await startWith(page, SIX);
    await page.setViewportSize({ width, height: 667 });
    await page.goto(partUrl);
    const link = page.getByRole("link", { name: NAME });
    await expect(link).toBeVisible({ timeout: 15_000 });
    const r = await page.evaluate(() => {
      const a = [...document.querySelectorAll("a")].find((x) => x.getAttribute("aria-label")?.startsWith("Saved on this device"))!;
      const probe = document.createElement("span");
      probe.className = "shrink-0 font-mono text-[0.7rem] text-text-faint";
      probe.textContent = "99 unsynced";
      a.parentElement!.append(probe);
      const old = probe.getBoundingClientRect().width;
      probe.remove();
      const row = document.querySelector<HTMLElement>('[data-testid="capture-title-row"]')!;
      return { link: a.getBoundingClientRect(), old, over: row.scrollWidth - row.clientWidth };
    });
    expect(r.link.width).toBeLessThanOrEqual(r.old + 0.5);
    expect(r.link.height).toBeGreaterThanOrEqual(44);
    expect(r.over).toBeLessThanOrEqual(0.5);
  });
}

test("INV-020 a sync error shows its message, not the saving words or a count", async ({ page, context }, info) => {
  test.skip(info.project.name !== "mobile", "phone only");
  await route(context, "signed-in", "500");
  const { songUrl } = await startWith(page, SIX);
  await page.goto(songUrl);
  const w = words(page);
  await expect(page.getByText(/push|500|error|failed/i).first()).toBeVisible({ timeout: 30_000 });
  await expect(w.here).toHaveCount(0);
  await expect(w.count).toHaveCount(0);
});
