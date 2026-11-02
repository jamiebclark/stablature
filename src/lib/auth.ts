/**
 * Better Auth server config.
 *
 * Identity is the one part of this app that genuinely needs the server: you
 * cannot sign in offline. Everything after sign-in reads from the local
 * mirror, so losing connectivity mid-practice costs nothing.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db, schema } from "@/db/client";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    // No SMTP on a self-hosted box, so there is nothing to verify against.
    // Access is controlled by band membership, not by proving an email.
    requireEmailVerification: false,
  },
  /*
   * Rate limiting, set explicitly rather than left on its defaults.
   *
   * Two things make the default awkward here. Limits are per IP, and every
   * member of a band on the same WiFi shares one NAT address -- so a
   * household-scale deployment has four people drawing on one budget. But
   * sign-in is also the one endpoint where a password can be guessed, and that
   * deserves a tight cap regardless.
   *
   * So: a generous global allowance, and a deliberately strict one on the
   * credential endpoints, which is still far more than a band needs and far
   * less than a brute-force attempt requires.
   *
   * STABLATURE_AUTH_RATE_LIMIT=off disables it. That exists for the end-to-end
   * suite, which signs up a dozen throwaway accounts from one address; do not
   * set it on a reachable deployment.
   */
  rateLimit:
    process.env.STABLATURE_AUTH_RATE_LIMIT === "off"
      ? { enabled: false }
      : {
          enabled: true,
          window: 60,
          max: Number(process.env.STABLATURE_AUTH_RATE_LIMIT ?? 240),
          customRules: {
            "/sign-in/email": { window: 60, max: 20 },
            "/sign-up/email": { window: 300, max: 20 },
          },
        },
  session: {
    // Long sessions on purpose: re-authenticating at band practice is exactly
    // the friction this app exists to remove.
    expiresIn: 60 * 60 * 24 * 90,
    updateAge: 60 * 60 * 24,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  /*
   * A self-hosted box gets reached by more than one name: localhost while you
   * set it up, then an IP or a .local hostname from your phone. Any origin not
   * listed here is rejected, so sign-in silently fails from the phone unless
   * its address is added. Comma-separated, e.g.
   *   STABLATURE_TRUSTED_ORIGINS=http://unraid.local:3000,http://192.168.1.20:3000
   * Left strict rather than wildcarded, because this is the CSRF boundary.
   */
  trustedOrigins: (process.env.STABLATURE_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  plugins: [
    // Must stay last: it lets server actions set the session cookie.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
