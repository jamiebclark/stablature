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
import { signOut, useSession } from "@/lib/auth-client";
import { usePendingWrites } from "@/lib/local/hooks";
import { useSyncStatus } from "@/lib/sync/hooks";
import { HelpOpen } from "@/components/keys/HelpOpen";
import { Logo } from "./Logo";

export function TopBar() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const pending = usePendingWrites();
  const status = useSyncStatus();

  if (pathname?.endsWith("/capture") || pathname?.includes("/capture/")) return null;

  return (
    <div
      className="border-b border-border-subtle bg-bg-raised no-print"
      style={{ paddingTop: "var(--safe-top)", paddingLeft: "var(--safe-left)", paddingRight: "var(--safe-right)" }}
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-1">
        <Link href="/" className="inline-flex min-h-(--control) items-center text-sm hover:text-accent" aria-label="stablature, home">
          <Logo />
        </Link>

        <div className="flex items-center gap-3 text-xs">
          <HelpOpen />
          <SyncBadge pending={pending ?? 0} state={status?.state} message={status?.message} />

          {isPending ? null : session ? (
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex min-h-(--control) items-center px-2 text-text-dim hover:text-accent"
            >
              Sign out
            </button>
          ) : (
            <Link href="/sign-in" className="inline-flex min-h-(--control) items-center px-2 text-text-dim hover:text-accent">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Says what is actually true rather than showing a spinner.
 *
 * "3 unsynced" is useful; an indeterminate spinner that means "something might
 * be happening" is not, especially when the honest answer is that you are in a
 * basement with no signal and nothing is wrong.
 */
function SyncBadge({
  pending,
  state,
  message,
}: {
  pending: number;
  state: string | undefined;
  message: string | null | undefined;
}) {
  if (state === "error" && message) {
    return (
      <span className="max-w-56 truncate text-danger" title={message}>
        {message}
      </span>
    );
  }

  if (state === "signed-out" && pending > 0) {
    return (
      <span className="text-text-faint" title="Sign in to sync these to your band">
        {pending} local
      </span>
    );
  }

  if (pending > 0) {
    return (
      <span className="font-mono text-text-faint" title="Not pushed yet">
        {pending} unsynced
      </span>
    );
  }

  if (state === "offline") return <span className="text-text-faint">offline</span>;
  if (state === "syncing") return <span className="text-text-faint">syncing…</span>;
  return null;
}
