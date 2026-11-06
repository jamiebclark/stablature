"use client";

import { OPEN_HELP_EVENT } from "./useScreenKeys";

/** Visible on a fine pointer only; `?` opens the help anywhere. */
export function HelpOpen({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      data-testid="help-open"
      aria-label="Help"
      onClick={() => window.dispatchEvent(new Event(OPEN_HELP_EVENT))}
      className={`hidden min-h-(--control) min-w-(--control) items-center justify-center rounded px-2 font-mono text-sm text-text-dim hover:text-accent [@media(pointer:fine)]:inline-flex ${className}`}
    >
      ?
    </button>
  );
}
