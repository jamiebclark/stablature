/**
 * Arrangements: how a handful of lettered parts becomes a song.
 *
 * This is the feature the app exists for. Bands here do not write linear tab,
 * they write forms -- "A four times, B, A four times with a flourish on the
 * fourth, the first half of C, D" -- and writing that out note for note is
 * exactly what makes paper fail. So the arrangement is stored as a sequence of
 * references and expanded on demand.
 *
 * Entries are stored FLAT with explicit section markers rather than as a tree,
 * because a flat list is what fractional ranks and row-level merging can
 * handle. This module is where that flat list is read back as the nested thing
 * it represents, so the storage stays mergeable and the UI still gets structure.
 */

import type { ArrangementEntryRow, PartRow } from "../model";

export type ArrangementNode = PartNode | SectionNode | TextNode;

export interface PartNode {
  kind: "part";
  entryId: string;
  partId: string;
  /** Total passes. 4 means "A x4". */
  repeat: number;
  /** 1-indexed, inclusive bar range. Null means the whole part. */
  fromBar: number | null;
  toBar: number | null;
  /**
   * Variant played on the final pass -- "A x4, flourish on the 4th".
   * Earlier passes use `partId`.
   */
  lastRepeatPartId: string | null;
  label: string | null;
}

export interface SectionNode {
  kind: "section";
  entryId: string;
  label: string | null;
  repeat: number;
  children: ArrangementNode[];
}

export interface TextNode {
  kind: "text";
  entryId: string;
  label: string | null;
}

/**
 * Read the flat entry list as a tree.
 *
 * Tolerant by design: a missing `section_end` closes at the end of the list,
 * and a stray one is ignored. Capture happens fast and offline, and a
 * half-finished section should still render rather than throw away the song.
 */
export function parseArrangement(entries: readonly ArrangementEntryRow[]): ArrangementNode[] {
  const root: ArrangementNode[] = [];
  const stack: SectionNode[] = [];

  const current = () => (stack.length > 0 ? stack[stack.length - 1].children : root);

  for (const entry of entries) {
    switch (entry.kind) {
      case "part": {
        if (!entry.partId) break; // A part entry with no part is not playable.
        current().push({
          kind: "part",
          entryId: entry.id,
          partId: entry.partId,
          repeat: Math.max(1, entry.repeat),
          fromBar: entry.fromBar,
          toBar: entry.toBar,
          lastRepeatPartId: entry.lastRepeatPartId,
          label: entry.label,
        });
        break;
      }
      case "section_start": {
        const section: SectionNode = {
          kind: "section",
          entryId: entry.id,
          label: entry.label,
          repeat: Math.max(1, entry.repeat),
          children: [],
        };
        current().push(section);
        stack.push(section);
        break;
      }
      case "section_end": {
        stack.pop();
        break;
      }
      case "text": {
        current().push({ kind: "text", entryId: entry.id, label: entry.label });
        break;
      }
    }
  }

  return root;
}

/** One pass of one part, in playing order. */
export interface ArrangementStep {
  /** The part actually played, which may be a variant on the final pass. */
  partId: string;
  /** The entry this came from, for highlighting it in the roadmap. */
  entryId: string;
  /** 1-indexed pass within its entry. */
  pass: number;
  passes: number;
  fromBar: number | null;
  toBar: number | null;
  /** Enclosing section labels, outermost first. */
  sections: string[];
}

/**
 * Flatten an arrangement into the sequence you would actually play.
 *
 * This is what the linear reading view renders, and what a future playback or
 * notation export would walk.
 */
export function expandArrangement(nodes: readonly ArrangementNode[]): ArrangementStep[] {
  const steps: ArrangementStep[] = [];

  const walk = (list: readonly ArrangementNode[], sections: string[]): void => {
    for (const node of list) {
      if (node.kind === "text") continue;

      if (node.kind === "section") {
        for (let pass = 0; pass < node.repeat; pass += 1) {
          walk(node.children, node.label ? [...sections, node.label] : sections);
        }
        continue;
      }

      for (let pass = 1; pass <= node.repeat; pass += 1) {
        // The variant replaces only the last pass. That is what "A x4 with a
        // flourish on the 4th" means, and it is why the variant is referenced
        // here rather than duplicated into the arrangement.
        const isFinalPass = pass === node.repeat;
        steps.push({
          partId: isFinalPass && node.lastRepeatPartId ? node.lastRepeatPartId : node.partId,
          entryId: node.entryId,
          pass,
          passes: node.repeat,
          fromBar: node.fromBar,
          toBar: node.toBar,
          sections,
        });
      }
    }
  };

  walk(nodes, []);
  return steps;
}

/** Total passes in an arrangement, i.e. how many times a part gets played. */
export function totalPasses(nodes: readonly ArrangementNode[]): number {
  return expandArrangement(nodes).length;
}

/**
 * Compact one-line notation, the way the band would write it on paper:
 *
 *     Ax4  B  Ax4 (4th: A')  C bars 1-2  { Chorus x2: D  Ex2 }
 *
 * Used for the roadmap summary and as an exact-output test of the whole
 * arrangement model.
 */
export function describeArrangement(
  nodes: readonly ArrangementNode[],
  parts: readonly Pick<PartRow, "id" | "label">[],
): string {
  const labelOf = (id: string) => parts.find((p) => p.id === id)?.label ?? "?";

  const render = (list: readonly ArrangementNode[]): string =>
    list
      .map((node) => {
        if (node.kind === "text") return node.label ? `"${node.label}"` : "";
        if (node.kind === "section") {
          const inner = render(node.children);
          const name = node.label ? `${node.label} ` : "";
          const repeat = node.repeat > 1 ? `x${node.repeat}` : "";
          return `{ ${name}${repeat}${repeat || name ? ": " : ""}${inner} }`;
        }

        let text = labelOf(node.partId);
        if (node.repeat > 1) text += `x${node.repeat}`;
        if (node.lastRepeatPartId) {
          text += ` (${ordinal(node.repeat)}: ${labelOf(node.lastRepeatPartId)})`;
        }
        const bars = describeBars(node.fromBar, node.toBar);
        if (bars) text += ` ${bars}`;
        return text;
      })
      .filter(Boolean)
      .join("  ");

  return render(nodes);
}

function describeBars(fromBar: number | null, toBar: number | null): string | null {
  if (fromBar === null && toBar === null) return null;
  if (fromBar !== null && toBar !== null) {
    return fromBar === toBar ? `bar ${fromBar}` : `bars ${fromBar}-${toBar}`;
  }
  if (fromBar !== null) return `from bar ${fromBar}`;
  return `to bar ${toBar}`;
}

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}
