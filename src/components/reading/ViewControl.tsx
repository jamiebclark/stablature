"use client";

import { STAFF_VIEWS } from "@/lib/reading/view";
import { useStaffView } from "./useStaffView";

/**
 * Which way the staves read: frets, notes or intervals. One choice for every staff on the device.
 * The chosen button is underlined and bold as well as filled, so it never relies on colour alone.
 */
export function ViewControl({ className = "" }: { className?: string }) {
  const [view, setView] = useStaffView();
  return (
    <div
      role="group"
      aria-label="Staff shows"
      data-testid="staff-view"
      className={`flex overflow-hidden rounded-md border border-border-subtle no-print ${className}`.trim()}
    >
      {STAFF_VIEWS.map((option) => (
        <button
          key={option}
          type="button"
          data-testid={`staff-view-${option}`}
          aria-pressed={view === option}
          onClick={() => setView(option)}
          className={`px-2.5 py-1.5 text-xs ${
            view === option ? "bg-accent font-semibold text-accent-text underline" : "text-text-dim"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
