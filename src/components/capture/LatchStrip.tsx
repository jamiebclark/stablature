"use client";

/**
 * The next-note modifier strip: one chip per `Latch`, rendered in declaration
 * order with no branching on `id` (FR-008, FR-009, INV-015). See
 * contracts/components.md.
 */

import type { Latch, LatchId } from "@/lib/capture/latches";
import { appliesTo, type CursorTarget } from "@/lib/capture/target";

export interface LatchStripProps {
  latches: readonly Latch[];
  lit: ReadonlySet<LatchId>;
  target: CursorTarget;
  onToggle: (id: LatchId) => void;
  disabled?: boolean;
}

export function LatchStrip({ latches, lit, target, onToggle, disabled = false }: LatchStripProps) {
  return (
    <div
      data-testid="latch-strip"
      className="grid gap-1 p-1"
      style={{ gridAutoFlow: "column", gridAutoColumns: "minmax(0, 1fr)" }}
    >
      {latches.map((latch) => {
        const armed = lit.has(latch.id);
        const applicable = appliesTo(latch.scope, target);
        return (
          <button
            key={latch.id}
            type="button"
            disabled={disabled || !applicable}
            onClick={() => onToggle(latch.id)}
            aria-pressed={armed}
            aria-label={latch.ariaLabel}
            title={latch.title}
            className={`whitespace-nowrap rounded px-1 py-1.5 ${latch.transition ? "font-mono text-sm leading-[1.05rem]" : "text-[0.7rem]"} font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              armed
                ? "border border-accent bg-accent text-accent-text"
                : "border border-border-subtle bg-bg-raised text-text"
            }`}
          >
            {latch.label}
          </button>
        );
      })}
    </div>
  );
}
