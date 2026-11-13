/**
 * Review probe, spec 008 INV-020: a sync error keeps its place ahead of the saving words, over Error × **Sess** (the
 * states in which sync runs and can fail: signed in; and a persisted `error` left behind when the user is then signed
 * out or unknown) × **Pend** {1, 14, 99}. The oracle is the stored status message itself, not a loose /error/ match.
 */
import { expect, test, type BrowserContext } from "@playwright/test";
import { idb } from "../../../e2e/reading-helpers";
import { startWith, TUNINGS } from "../../../e2e/probe-helpers";

test.setTimeout(300_000);

const SIGNED_IN = {
  session: { id: "s1", token: "t", userId: "u1", expiresAt: "2099-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  user: { id: "u1", email: "a@b.c", name: "A", emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
};

type Sess = "signed in" | "never signed in" | "session aborted";

async function route(context: BrowserContext, sess: Sess) {
  await context.unrouteAll({ behavior: "ignoreErrors" });
  await context.route("**/api/auth/get-session*", (r) => {
    if (sess === "session aborted") return r.abort();
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(sess === "signed in" ? SIGNED_IN : null) });
  });
  await context.route("**/api/sync/pull*", (r) => r.abort());
  await context.route("**/api/sync/push*", (r) => r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "push broke" }) }));
}

for (const pend of [1, 14, 99]) {
  test(`INV-020 the error message outranks the saving words, ${pend} pending`, async ({ page, context }, info) => {
    test.skip(info.project.name !== "mobile", "phone");
    await route(context, "signed in");
    const { songUrl } = await startWith(page, TUNINGS[2], `Band err ${pend}`);
    const template = await idb<unknown>(page, `return (await all("outbox"))[0];`);
    await idb(page, `const { n, template } = arg; await write("outbox", (s) => { s.clear(); for (let i = 0; i < n; i++) { const { seq, ...rest } = template; void seq; s.add({ ...rest, rowId: crypto.randomUUID() }); } });`, { n: pend, template });
    const bad: string[] = [];
    for (const sess of ["signed in", "never signed in", "session aborted"] as Sess[]) {
      // Signed in first, so the push fails and the error is stored; then the session shape under test.
      await route(context, "signed in");
      await page.goto(songUrl);
      await expect.poll(() => idb<string | null>(page, `const s = (await all("meta")).find((m) => m.value && m.value.state); return s ? s.value.state : null;`), { timeout: 20_000 }).toBe("error");
      await route(context, sess);
      await page.goto(songUrl);
      await page.waitForTimeout(800);
      const stored = await idb<{ state: string; message: string | null } | null>(page, `const s = (await all("meta")).find((m) => m.value && m.value.state); return s ? s.value : null;`);
      const text = await page.evaluate(() => document.body.innerText);
      const label = `${sess}, ${pend} pending, stored ${stored?.state}`;
      if (stored?.state === "error" && stored.message) {
        if (!text.includes(stored.message)) bad.push(`${label}: the message "${stored.message}" is not shown (header: ${text.replace(/\n/g, " | ")})`);
        if (/unsynced|Saved on this device/.test(text)) bad.push(`${label}: saving words shown beside the error`);
      } else if (sess === "signed in") bad.push(`${label}: no error stored to test`);
    }
    expect(bad).toEqual([]);
  });
}
