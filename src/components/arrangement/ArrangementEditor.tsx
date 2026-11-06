"use client";

/**
 * Building and tweaking an arrangement.
 *
 * The roadmap is the display; this adds the controls around it. Selecting a
 * chip reveals its own controls rather than putting a repeat stepper and a
 * variant picker on every chip at once -- a song with twelve entries would
 * otherwise be unreadable, which defeats the purpose.
 */

import { useState } from "react";
import { Button, Input, Panel } from "@/components/ui";
import { parseArrangement } from "@/lib/arrangement/expand";
import {
  appendPartEntry,
  appendSection,
  appendTextEntry,
  bumpEntryRepeat,
  deleteEntry,
  deleteSection,
  moveEntry,
  seedArrangementFromParts,
  setEntryBars,
  setEntryVariant,
} from "@/lib/local/arranging";
import type { ArrangementEntryRow, PartRow, SongRow } from "@/lib/model";
import { Roadmap } from "./Roadmap";

export interface ArrangementEditorProps {
  song: SongRow;
  parts: readonly PartRow[];
  entries: readonly ArrangementEntryRow[];
  /** Bar counts per part, so the bar-range stepper cannot exceed the part. */
  barCounts: Record<string, number>;
}

export function ArrangementEditor({ song, parts, entries, barCounts }: ArrangementEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cue, setCue] = useState("");
  const [sectionName, setSectionName] = useState("");

  const nodes = parseArrangement(entries);
  const selected = entries.find((entry) => entry.id === selectedId) ?? null;
  const selectedIndex = entries.findIndex((entry) => entry.id === selectedId);

  // Variants are offered as the final-pass substitute for their base part,
  // which is the only place they are referenced from.
  const variantsFor = (partId: string | null) =>
    partId ? parts.filter((part) => part.variantOfPartId === partId) : [];

  const playable = parts.filter((part) => part.variantOfPartId === null);

  const adding = (
    <>
      <div className="flex flex-wrap items-center gap-1.5 no-print">
        {playable.map((part) => (
          <Button
            key={part.id}
            onClick={() => appendPartEntry(song, part.id)}
            aria-label={`Add part ${part.label} to the arrangement`}
          >
            + <span className="font-mono">{part.label}</span>
          </Button>
        ))}

        {entries.length === 0 && playable.length > 0 ? (
          <Button variant="primary" onClick={() => seedArrangementFromParts(song, parts)}>
            Each part once
          </Button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2 no-print">
        <form
          className="flex gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            await appendSection(song, sectionName, 2);
            setSectionName("");
          }}
        >
          <Input
            value={sectionName}
            onChange={(e) => setSectionName(e.target.value)}
            placeholder="Section name"
            aria-label="Section name"
            className="w-36"
          />
          <Button type="submit">+ section</Button>
        </form>

        <form
          className="flex gap-1.5"
          onSubmit={async (e) => {
            e.preventDefault();
            await appendTextEntry(song, cue);
            setCue("");
          }}
        >
          <Input
            value={cue}
            onChange={(e) => setCue(e.target.value)}
            placeholder="Cue, e.g. build slowly"
            aria-label="Cue"
            className="w-44"
          />
          <Button type="submit" disabled={!cue.trim()}>
            + cue
          </Button>
        </form>
      </div>
    </>
  );

  return (
    <section>
      <div className="mb-3">
        <Roadmap
          nodes={nodes}
          parts={parts}
          activeEntryId={selectedId}
          onSelectEntry={(id) => setSelectedId((current) => (current === id ? null : id))}
        />
      </div>

      {selected ? (
        <div className="mb-3 rounded-lg border border-accent/40 bg-bg-raised p-3 no-print">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-dim">
              {selected.kind === "part"
                ? parts.find((p) => p.id === selected.partId)?.label ?? "Entry"
                : selected.kind === "section_start"
                  ? `Section: ${selected.label ?? "unnamed"}`
                  : "Entry"}
            </p>
            <Button variant="ghost" onClick={() => setSelectedId(null)}>
              Done
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selected.kind === "part" || selected.kind === "section_start" ? (
              <div className="flex items-center overflow-hidden rounded-md border border-border-subtle">
                <button
                  type="button"
                  className="min-h-(--control) min-w-10 px-3 text-sm disabled:opacity-30"
                  disabled={selected.repeat <= 1}
                  onClick={() => bumpEntryRepeat(selected, -1)}
                  aria-label="One fewer repeat"
                >
                  &minus;
                </button>
                <span className="min-w-12 px-1 text-center font-mono text-sm">
                  &times;{selected.repeat}
                </span>
                <button
                  type="button"
                  className="min-h-(--control) min-w-10 px-3 text-sm"
                  onClick={() => bumpEntryRepeat(selected, 1)}
                  aria-label="One more repeat"
                >
                  +
                </button>
              </div>
            ) : null}

            {selected.kind === "part" && variantsFor(selected.partId).length > 0 ? (
              <label className="flex items-center gap-1.5 text-xs text-text-dim">
                Last pass
                <select
                  value={selected.lastRepeatPartId ?? ""}
                  onChange={(e) => setEntryVariant(selected.id, e.target.value || null)}
                  className="min-h-(--control) rounded border border-border-subtle bg-bg px-2 text-text"
                >
                  <option value="">same</option>
                  {variantsFor(selected.partId).map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {selected.kind === "part" && (barCounts[selected.partId ?? ""] ?? 0) > 1 ? (
              <BarRange
                entry={selected}
                barCount={barCounts[selected.partId ?? ""] ?? 1}
              />
            ) : null}

            <div className="ml-auto flex gap-2">
              <Button
                disabled={selectedIndex <= 0}
                onClick={() => moveEntry(entries, selected.id, selectedIndex - 1)}
                aria-label="Move earlier"
              >
                &larr;
              </Button>
              <Button
                disabled={selectedIndex >= entries.length - 1}
                onClick={() => moveEntry(entries, selected.id, selectedIndex + 2)}
                aria-label="Move later"
              >
                &rarr;
              </Button>
              <Button
                variant="danger"
                className="ml-2"
                onClick={async () => {
                  if (selected.kind === "section_start") {
                    await deleteSection(entries, selected.id);
                  } else {
                    await deleteEntry(selected.id);
                  }
                  setSelectedId(null);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {entries.length > 0 ? (
        <Panel id="song-arrange" label="Add to the arrangement">
          {adding}
        </Panel>
      ) : (
        adding
      )}
    </section>
  );
}

/**
 * Bar range for "play half of C".
 *
 * Offered only when the part has more than one bar, since a range over a
 * single bar is the same as no range at all.
 */
function BarRange({ entry, barCount }: { entry: ArrangementEntryRow; barCount: number }) {
  const whole = entry.fromBar === null && entry.toBar === null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-text-dim">
      {whole ? (
        <Button onClick={() => setEntryBars(entry.id, 1, Math.ceil(barCount / 2))}>
          Part of it
        </Button>
      ) : (
        <>
          bars
          <input
            type="number"
            min={1}
            max={barCount}
            value={entry.fromBar ?? 1}
            onChange={(e) => setEntryBars(entry.id, Number(e.target.value), entry.toBar)}
            aria-label="First bar"
            className="min-h-(--control) w-14 rounded border border-border-subtle bg-bg px-1.5 text-text"
          />
          &ndash;
          <input
            type="number"
            min={1}
            max={barCount}
            value={entry.toBar ?? barCount}
            onChange={(e) => setEntryBars(entry.id, entry.fromBar, Number(e.target.value))}
            aria-label="Last bar"
            className="min-h-(--control) w-14 rounded border border-border-subtle bg-bg px-1.5 text-text"
          />
          <Button variant="ghost" onClick={() => setEntryBars(entry.id, null, null)}>
            whole part
          </Button>
        </>
      )}
    </div>
  );
}
