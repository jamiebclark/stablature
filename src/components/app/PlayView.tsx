"use client";

/**
 * The play view: the arrangement unrolled into continuous tab.
 *
 * The roadmap on the song page is for knowing the form; this is for reading
 * while you play it. Every pass is drawn, in order, with its bars sliced out
 * and its variant substituted — so `A x4 with a flourish on the 4th` appears as
 * four staves, the last of which is actually different.
 *
 * This is the view worth printing, which is why the page chrome is marked
 * no-print and each pass avoids breaking across a page.
 */

import { useMemo } from "react";
import { ButtonLink, EmptyState, Loading, PageHeader } from "@/components/ui";
import { ClickBar } from "@/components/rhythm/ClickBar";
import { TabStaff } from "@/components/tab/TabStaff";
import { expandArrangement, parseArrangement } from "@/lib/arrangement/expand";
import { drawnPasses } from "@/lib/arrangement/passes";
import {
  useArrangement,
  useParts,
  useSong,
  useSongAnnotations,
  useSongEvents,
  useSongTuning,
} from "@/lib/local/hooks";
import { stringLabels } from "@/lib/tunings";

export function PlayView({ songId }: { songId: string }) {
  const song = useSong(songId);
  const tuning = useSongTuning(song);
  const parts = useParts(songId);
  const entries = useArrangement(songId);
  const eventsByPart = useSongEvents(songId);
  const annotationsByPart = useSongAnnotations(songId);

  const steps = useMemo(
    () => (entries ? expandArrangement(parseArrangement(entries)) : []),
    [entries],
  );
  const passes = useMemo(() => drawnPasses(steps, eventsByPart ?? {}), [steps, eventsByPart]);

  if (song === undefined || parts === undefined || entries === undefined) return <Loading />;
  if (!song) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-text-dim">That song is not on this device.</p>
      </main>
    );
  }

  const partsById = new Map(parts.map((part) => [part.id, part]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={song.title}
        subtitle={
          tuning
            ? `${stringLabels(tuning).join(" ")}${song.bpm ? ` — ${song.bpm} bpm` : ""}`
            : undefined
        }
        back={{ href: `/songs/${songId}`, label: "Song" }}
        actions={<ButtonLink href={`/songs/${songId}/capture`}>Capture</ButtonLink>}
      />

      {steps.length === 0 ? (
        <EmptyState title="No arrangement yet, so there is nothing to lay out in order.">
          <ButtonLink href={`/songs/${songId}`} variant="primary">
            Build the arrangement
          </ButtonLink>
        </EmptyState>
      ) : (
        <ol className="grid gap-4">
          {passes.map(({ step, events }, index) => {
            const part = partsById.get(step.partId);
            const previous = passes[index - 1]?.step;

            // Only announce a section when it actually changes, or a repeated
            // chorus would shout its name at every pass.
            const sectionChanged =
              step.sections.join(">") !== (previous?.sections.join(">") ?? "");

            return (
              <li key={`${step.entryId}-${step.pass}-${index}`} className="print-keep">
                {sectionChanged && step.sections.length > 0 ? (
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">
                    {step.sections.join(" / ")}
                  </p>
                ) : null}

                <div className="rounded-lg border border-border-subtle bg-bg-raised p-3">
                  <div className="mb-1.5 flex items-baseline gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {part?.label ?? "?"}
                    </span>
                    {step.passes > 1 ? (
                      <span className="text-xs text-text-faint">
                        pass {step.pass} of {step.passes}
                      </span>
                    ) : null}
                    {step.fromBar !== null || step.toBar !== null ? (
                      <span className="text-xs text-text-dim">
                        bars {step.fromBar ?? 1}–{step.toBar ?? "end"}
                      </span>
                    ) : null}
                    {part?.name ? (
                      <span className="text-xs text-text-faint">{part.name}</span>
                    ) : null}
                  </div>

                  {tuning ? (
                    <TabStaff
                      events={events}
                      tuning={tuning}
                      annotations={annotationsByPart?.[step.partId] ?? []}
                      surface="raised"
                      showRhythm
                    />
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ClickBar song={song} passes={passes} notationReady={eventsByPart !== undefined} />
    </main>
  );
}
