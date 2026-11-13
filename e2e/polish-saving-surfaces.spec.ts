/**
 * Adopted from the round-1 review probe, spec 008 INV-018: a user known to be signed out is never shown `unsynced` or a count, and a user who
 * may be signed in is never invited to sign in. Enumerates plan.md **Sess** (all seven) × **Pend** {0, 1, 14, 99} ×
 * **Surf** (top bar on bands, band, song, play, tunings; the capture header) × {375, 1280}. The implementation's own
 * spec covers four sessions, one pending count and two surfaces.
 */
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { idb } from "./reading-helpers";
import { startWith, TUNINGS } from "./probe-helpers";

test.setTimeout(600_000);

const NAME = "Saved on this device. Sign in to sync with your band.";
const SIGNED_IN = {
  session: { id: "s1", token: "t", userId: "u1", expiresAt: "2099-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  user: { id: "u1", email: "a@b.c", name: "A", emailVerified: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
};

type Sess = "never signed in" | "session 401" | "session aborted" | "session held pending" | "signed in" | "signed in, push 401" | "signed in, offline";
const EXPECT: Record<Sess, "saved-here" | "count"> = {
  "never signed in": "saved-here",
  "session 401": "saved-here",
  "session aborted": "count",
  "session held pending": "count",
  "signed in": "count",
  "signed in, push 401": "saved-here",
  "signed in, offline": "count",
};

async function route(context: BrowserContext, sess: Sess) {
  await context.route("**/api/auth/get-session*", (r) => {
    if (sess === "session aborted") return r.abort();
    if (sess === "session held pending") return; // never answered
    if (sess === "session 401") return r.fulfill({ status: 401, contentType: "application/json", body: "{}" });
    const signedIn = sess.startsWith("signed in");
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(signedIn ? SIGNED_IN : null) });
  });
  // A server that refuses the push refuses the pull too; an aborted pull would overwrite `signed-out` with `error`.
  await context.route("**/api/sync/pull*", (r) =>
    sess === "signed in, push 401" ? r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthorised" }) }) : r.abort(),
  );
  await context.route("**/api/sync/push*", (r) => {
    if (sess === "signed in, push 401") return r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "unauthorised" }) });
    return; // held: sync stays `syncing`, the outbox keeps its rows, and no error outranks the words
  });
}

async function setPending(page: Page, n: number, template: unknown) {
  await idb(
    page,
    `const { n, template } = arg;
     await write("outbox", (s) => {
       s.clear();
       for (let i = 0; i < n; i++) { const { seq, ...rest } = template; void seq; s.add({ ...rest, rowId: crypto.randomUUID() }); }
     });`,
    { n, template },
  );
}

const PEND = [0, 1, 14, 99];
const WIDTHS = [375, 1280];

for (const sess of Object.keys(EXPECT) as Sess[]) {
  test(`INV-018 ${sess}: every surface x every pending count x 375 and 1280`, async ({ page, context }, info) => {
    test.skip(info.project.name !== "mobile", "phone project; widths are set per check");
    await route(context, sess);
    const { songUrl, partUrl } = await startWith(page, TUNINGS[2], `Band ${sess}`);
    const bandId = await idb<string>(page, `return (await all("bands"))[0].id;`);
    const surfaces: [string, string][] = [
      ["bands", "/"],
      ["band", `/bands/${bandId}`],
      ["song", songUrl],
      ["play", `${songUrl}/play`],
      ["tunings", `/bands/${bandId}/tunings`],
      ["capture header", partUrl],
    ];
    const template = await idb<unknown>(page, `return (await all("outbox"))[0];`);
    expect(template, "an outbox row to copy").toBeTruthy();
    const bad: string[] = [];
    let checks = 0;
    for (const n of PEND) {
      await setPending(page, n, template);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: width > 1000 ? 800 : 667 });
        for (const [surface, url] of surfaces) {
          if (sess === "signed in, offline") await context.setOffline(false);
          await page.goto(url);
          await page.waitForTimeout(sess === "signed in, push 401" ? 1200 : 700);
          if (sess === "signed in, offline") {
            await context.setOffline(true);
            await page.evaluate(() => window.dispatchEvent(new Event("offline")));
            await page.waitForTimeout(600);
          }
          const label = `${sess} | pending ${n} | ${surface} | ${width}`;
          checks++;
          const text = await page.evaluate(() => document.body.innerText);
          const link = await page.getByRole("link", { name: NAME }).count();
          const hasCount = new RegExp(`\\b${n} unsynced\\b`).test(text);
          const unsynced = /unsynced/.test(text);
          const local = /\d+ local\b/.test(text);
          const savedLong = text.includes("Saved on this device");
          const savedShort = text.includes("saved · sign in");
          const want = n === 0 ? "none" : EXPECT[sess];
          if (local) bad.push(`${label}: shows "N local"`);
          if (want === "none") {
            if (unsynced || savedLong || savedShort) bad.push(`${label}: words shown with nothing pending (unsynced ${unsynced}, saved ${savedLong || savedShort})`);
          } else if (want === "saved-here") {
            if (unsynced) bad.push(`${label}: known signed out but shows "unsynced"`);
            if (surface === "capture header" ? !(savedShort && link === 1) : !savedLong) bad.push(`${label}: saved words missing`);
          } else {
            if (savedLong || savedShort || link) bad.push(`${label}: may be signed in but is invited to sign in`);
            if (!hasCount) bad.push(`${label}: count missing`);
          }
        }
      }
    }
    if (sess === "signed in, offline") await context.setOffline(false);
    console.log(`  ${sess}: ${checks} checks, ${bad.length} bad`);
    for (const b of bad) console.log(`    BAD ${b}`);
    expect(bad).toEqual([]);
  });
}
