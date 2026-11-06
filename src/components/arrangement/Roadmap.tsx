"use client";

/**
 * The roadmap: a whole song's form, on one screen.
 *
 * This is the reading view that paper cannot do. Rather than unrolling a form
 * into metres of linear tab, each entry is one chip carrying its own repeat
 * count, variant and bar range -- so `A x4, B, A x4 with a flourish on the
 * 4th, half of C, D` stays glanceable at the density you would actually scribble
 * it at.
 *
 * Sections are drawn as bracketed groups with their repeat on the bracket,
 * which is how the nesting stays legible without indentation eating the width.
 */

import type { ArrangementNode } from "@/lib/arrangement/expand";
import type { PartRow } from "@/lib/model";

export interface RoadmapProps {
  nodes: readonly ArrangementNode[];
  parts: readonly PartRow[];
  activeEntryId?: string | null;
  onSelectEntry?: (entryId: string) => void;
}

export function Roadmap({ nodes, parts, activeEntryId = null, onSelectEntry }: RoadmapProps) {
  if (nodes.length === 0) {
    return (
      <p className="text-sm text-text-faint">
        No arrangement yet — add the parts in the order you play them.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-stretch gap-1.5">
      <Nodes
        nodes={nodes}
        parts={parts}
        activeEntryId={activeEntryId}
        onSelectEntry={onSelectEntry}
      />
    </div>
  );
}

function Nodes({ nodes, parts, activeEntryId, onSelectEntry }: RoadmapProps) {
  const labelOf = (id: string) => parts.find((p) => p.id === id)?.label ?? "?";

  return (
    <>
      {nodes.map((node) => {
        if (node.kind === "text") {
          const cueClass = "self-center px-1 text-xs italic text-text-dim";
          return onSelectEntry ? (
            <button
              key={node.entryId}
              type="button"
              onClick={() => onSelectEntry(node.entryId)}
              className={`${cueClass} min-h-(--control) text-left`}
            >
              {node.label}
            </button>
          ) : (
            <span key={node.entryId} className={cueClass}>
              {node.label}
            </span>
          );
        }

        if (node.kind === "section") {
          return (
            <div
              key={node.entryId}
              className={`flex items-stretch gap-1.5 rounded-md border px-1.5 py-1 ${
                node.entryId === activeEntryId ? "border-accent" : "border-border-strong"
              }`}
            >
              <button
                type="button"
                onClick={onSelectEntry ? () => onSelectEntry(node.entryId) : undefined}
                className="min-h-(--control) self-center text-left"
              >
                <span className="block text-[0.6rem] uppercase tracking-wide text-text-faint">
                  {node.label ?? "section"}
                </span>
                {node.repeat > 1 ? (
                  <span className="block font-mono text-xs text-accent">&times;{node.repeat}</span>
                ) : null}
              </button>
              <div className="flex flex-wrap items-stretch gap-1.5 border-l border-border-subtle pl-1.5">
                {node.children.length === 0 ? (
                  <span className="self-center px-1 text-xs text-text-faint">empty</span>
                ) : (
                  <Nodes
                    nodes={node.children}
                    parts={parts}
                    activeEntryId={activeEntryId}
                    onSelectEntry={onSelectEntry}
                  />
                )}
              </div>
            </div>
          );
        }

        const active = node.entryId === activeEntryId;
        const bars = barsLabel(node.fromBar, node.toBar);

        return (
          <button
            key={node.entryId}
            type="button"
            onClick={onSelectEntry ? () => onSelectEntry(node.entryId) : undefined}
            data-testid="roadmap-chip"
            className={`min-h-(--control) rounded-md border px-2 py-1 text-left transition ${
              active
                ? "border-accent bg-accent-dim/30"
                : "border-border-subtle bg-bg-raised hover:border-border-strong"
            }`}
          >
            <span className="font-mono text-sm font-semibold">
              {labelOf(node.partId)}
              {node.repeat > 1 ? (
                <span className="text-accent">&times;{node.repeat}</span>
              ) : null}
            </span>

            {/* The variant and the bar range are the two things that turn a
                part reference into the form the band actually plays. */}
            {node.lastRepeatPartId ? (
              <span className="block text-[0.6rem] text-text-dim">
                last: {labelOf(node.lastRepeatPartId)}
              </span>
            ) : null}
            {bars ? <span className="block text-[0.6rem] text-text-dim">{bars}</span> : null}
          </button>
        );
      })}
    </>
  );
}

function barsLabel(fromBar: number | null, toBar: number | null): string | null {
  if (fromBar === null && toBar === null) return null;
  if (fromBar !== null && toBar !== null) {
    return fromBar === toBar ? `bar ${fromBar}` : `bars ${fromBar}–${toBar}`;
  }
  if (fromBar !== null) return `from bar ${fromBar}`;
  return `to bar ${toBar}`;
}
