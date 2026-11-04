"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Input } from "@/components/ui";
import type { ColumnProperty, PropertyContext } from "@/lib/capture/properties";

export interface ColumnInspectorProps {
  /** Ordered. Rendered as given; never sorted, filtered or branched on by id. */
  properties: readonly ColumnProperty[];
  ctx: PropertyContext;
  /** Named in the sheet's heading, e.g. "Column 4" or "Barline". */
  title: string;
  onClose: () => void;
  /** Fired after an action row's commit resolves, just before the sheet closes. */
  onActionDone?: (property: ColumnProperty) => void;
}

export function ColumnInspector({ properties, ctx, title, onClose, onActionDone }: ColumnInspectorProps) {
  return (
    <div data-testid="column-inspector" className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onClose}>
          close
        </Button>
      </div>
      {properties.map((property) => (
        <div
          key={property.id}
          data-property-row
          className="flex items-center justify-between gap-3 border-b border-border-subtle pb-3"
        >
          <span className="text-sm text-text-dim">{property.label}</span>
          <Control property={property} ctx={ctx} onClose={onClose} onActionDone={onActionDone} />
        </div>
      ))}
    </div>
  );
}

function Control({
  property,
  ctx,
  onClose,
  onActionDone,
}: {
  property: ColumnProperty;
  ctx: PropertyContext;
  onClose: () => void;
  onActionDone?: (property: ColumnProperty) => void;
}) {
  switch (property.control) {
    case "stepper":
      return (
        <div className="flex items-center overflow-hidden rounded-md border border-border-subtle">
          <button
            type="button"
            className="px-3 py-2 text-sm"
            aria-label={`${property.ariaLabel}: one fewer`}
            onClick={() => void property.commit(ctx, -1)}
          >
            &minus;
          </button>
          <span
            className="min-w-10 bg-bg-raised px-1 text-center font-mono text-sm"
            aria-label={property.ariaLabel}
            aria-live="polite"
          >
            &times;{property.read(ctx)}
          </span>
          <button
            type="button"
            className="px-3 py-2 text-sm"
            aria-label={`${property.ariaLabel}: one more`}
            onClick={() => void property.commit(ctx, 1)}
          >
            +
          </button>
        </div>
      );
    case "text":
      return <TextControl property={property} ctx={ctx} />;
    case "action":
      return (
        <Button
          variant={property.destructive ? "danger" : "secondary"}
          aria-label={property.ariaLabel}
          onClick={async () => {
            await property.commit(ctx, "");
            onActionDone?.(property);
            onClose();
          }}
        >
          {property.label}
        </Button>
      );
  }
}

function TextControl({ property, ctx }: { property: ColumnProperty; ctx: PropertyContext }) {
  const current = String(property.read(ctx) ?? "");
  const [draft, setDraft] = useState<string | null>(null);
  // The text last submitted: the draft is held until the live row shows it, not until the write resolves.
  const sent = useRef<string | null>(null);
  useEffect(() => {
    const value = sent.current;
    sent.current = null;
    // Keep anything typed while the write was in flight.
    setDraft((now) => (now === value ? null : now));
  }, [current]);
  return (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        if (draft === null) return;
        sent.current = draft;
        await property.commit(ctx, draft);
      }}
    >
      <Input
        value={draft ?? current}
        onChange={(e) => setDraft(e.target.value)}
        aria-label={property.ariaLabel}
        className="w-32"
      />
      <Button type="submit" disabled={draft === null || draft === current}>
        set
      </Button>
    </form>
  );
}
