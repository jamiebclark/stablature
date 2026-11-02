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
