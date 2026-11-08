"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button, Sheet } from "@/components/ui";
import { acceptsShortcut, screenFor, shortcutFor, SHORTCUTS } from "@/lib/keys/shortcuts";
import { OPEN_HELP_EVENT, runScreenAction } from "./useScreenKeys";

/** The one `keydown` listener, and the overlay it opens. Mounted once, in the root layout. */
export function KeyboardHelp() {
  const pathname = usePathname() ?? "";
  const screen = screenFor(pathname);
  const [open, setOpen] = useState(false);
  const state = useRef({ screen, open });
  useEffect(() => {
    state.current = { screen, open };
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const { screen: current, open: isOpen } = state.current;
      if (event.defaultPrevented) return;
      // While the overlay is open every other shortcut rests, but `?` still closes it.
      if (isOpen) {
        const t = event.target as Element | null;
        if (event.key === "?" && !event.ctrlKey && !event.metaKey && !event.altKey && !t?.closest?.("input, select, textarea")) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      }
      if (!acceptsShortcut(event, document)) return;
      const shortcut = shortcutFor(event.key, current);
      if (!shortcut) return;
      if (shortcut.id === "help") {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (runScreenAction(shortcut.id, current, event)) event.preventDefault();
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_HELP_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_HELP_EVENT, onOpen);
    };
  }, []);

  const rows = SHORTCUTS.filter((s) => s.screens.includes(screen));

  return (
    <Sheet open={open} onClose={() => setOpen(false)} label="Keyboard shortcuts">
      <div data-testid="help-overlay" className="flex flex-col gap-3 p-4">
        <h2 className="text-base font-semibold">Keyboard shortcuts</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
          {rows.map((row) => (
            <div key={row.id} data-testid="help-row" data-action={row.id} className="contents">
              <dt className="font-mono text-accent">{row.label}</dt>
              <dd className="text-text-dim">{row.words}</dd>
            </div>
          ))}
        </dl>
        <Button onClick={() => setOpen(false)}>Close</Button>
      </div>
    </Sheet>
  );
}
