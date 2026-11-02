"use client";

/**
 * Global chrome.
 *
 * Hidden on the capture screen, which is a full-height app surface where every
 * vertical pixel is either staff or fretboard.
 *
 * Signing in gates *syncing*, not *using*: the app reads from the local mirror,
 * so capture has to keep working in a rehearsal room with no signal, where
 * verifying a session is impossible by definition.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePendingWrites } from "@/lib/local/hooks";
import { signOut, useSession } from "@/lib/auth-client";

export function TopBar() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const pending = usePendingWrites();

  if (pathname?.endsWith("/capture")) return null;

  return (
    <div className="border-b border-border-subtle bg-bg-raised no-print">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-2.5">
        <Link href="/" className="font-mono text-sm font-semibold tracking-tight">
          stablature
        </Link>

        <div className="flex items-center gap-3 text-xs">
          {pending ? (
            <span className="font-mono text-text-faint" title="Local changes not yet pushed">
              {pending} unsynced
            </span>
          ) : null}

          {isPending ? null : session ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="text-text-dim hover:text-accent"
            >
              Sign out
            </button>
          ) : (
            <Link href="/sign-in" className="text-text-dim hover:text-accent">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
