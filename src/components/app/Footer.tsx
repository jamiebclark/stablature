"use client";

/**
 * Hidden on the capture screen, which owns the full viewport height, and on
 * print, where it is noise.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Footer() {
  const pathname = usePathname();
  if (pathname?.includes("/capture")) return null;

  return (
    <footer
      className="mx-auto mt-12 max-w-3xl px-4 text-xs text-text-faint no-print"
      style={{ paddingBottom: "calc(2rem + var(--safe-bottom))" }}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border-subtle pt-4">
        <span>stablature &middot; self-hosted</span>
        <Link href="/privacy" className="inline-flex min-h-(--control) items-center hover:text-accent">
          Privacy
        </Link>
        <Link href="/terms" className="inline-flex min-h-(--control) items-center hover:text-accent">
          Terms
        </Link>
      </div>
    </footer>
  );
}
