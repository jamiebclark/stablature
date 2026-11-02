"use client";

import { createAuthClient } from "better-auth/react";

/**
 * No baseURL on purpose, so requests go to the origin the page was actually
 * served from.
 *
 * Pinning it to NEXT_PUBLIC_APP_URL looks tidier and breaks in exactly the
 * situation this app is built for: you self-host on a box, open it from your
 * phone at http://unraid.local:3000, and every auth call still goes to
 * whatever "localhost" meant at build time. The current origin is always
 * right in a browser, which is the only place this client runs.
 */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
