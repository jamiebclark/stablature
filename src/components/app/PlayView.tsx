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

import { useCallback, useMemo, useRef, useState } from "react";
import { useScreenKeys } from "@/components/keys/useScreenKeys";
import { ButtonLink, EmptyState, Loading, PageHeader } from "@/components/ui";
import { ClickBar } from "@/components/rhythm/ClickBar";
import { ViewControl } from "@/components/reading/ViewControl";
import { useStaffView } from "@/components/reading/useStaffView";
import { useReadingPosition } from "@/components/reading/useReadingPosition";
import { VariantLine } from "@/components/reading/VariantLine";
import { TabStaff } from "@/components/tab/TabStaff";
import { expandArrangement, ordinal, parseArrangement } from "@/lib/arrangement/expand";
import { drawnPasses } from "@/lib/arrangement/passes";
import {
  useArrangement,
  useParts,
  useSong,
  useSongContent,
  useSongTuning,
} from "@/lib/local/hooks";
import { passBars, partHeading } from "@/lib/reading/bars";
import { compareVariants } from "@/lib/reading/compare";
import { staffMarks } from "@/lib/reading/marks";
import { columnKey, readingStops, stepBar, stepColumn, type ReadingStop } from "@/lib/reading/position";
import type { ColumnTick } from "@/lib/rhythm/notation";
import { stringLabels } from "@/lib/tunings";

export function PlayView({ songId }: { songId: string }) {
  const song = useSong(songId);
  const tuning = useSongTuning(song);
  const parts = useParts(songId);
  const entries = useArrangement(songId);
  const content = useSongContent(songId);
  const eventsByPart = content?.eventsByPart;
  const annotationsByPart = content?.annotationsByPart;
  const [view] = useStaffView();

  const steps = useMemo(
    () => (entries ? expandArrangement(parseArrangement(entries)) : []),
    [entries],
  );
  const passes = useMemo(() => drawnPasses(steps, eventsByPart ?? {}), [steps, eventsByPart]);

  const bars = useMemo(() => passBars(passes), [passes]);
  // The bar mounts only once the song has loaded, so its root is held in state to re-run the padding effect.
  const [barRoot, setBarRoot] = useState<HTMLDivElement | null>(null);
  const cluster = useMemo(() => ({ current: barRoot }), [barRoot]);
  const { place } = useReadingPosition(passes, cluster);
  const onColumn = useCallback(
    (column: ColumnTick | null) =>
      place(column ? { pass: column.pass, key: columnKey(column.eventId, column.repetition) } : null),
    [place],
  );

  // The keyed reading position (data-model.md): set by keys only while stopped, cleared by starting.
  const stops = useMemo(() => readingStops(passes, bars.offset), [passes, bars]);
  const keyed = useRef<ReadingStop | null>(null);
  const idleRef = useRef(true);
  const clearKeyed = useCallback(() => {
    keyed.current = null;
    place(null);
  }, [place]);
  const moveKeyed = (step: typeof stepColumn, by: -1 | 1) => {
    if (!idleRef.current || stops.length === 0) return false;
    const next = step(stops, keyed.current, by);
    keyed.current = next;
    place(next ? { pass: next.pass, key: next.key } : null);
  };
  useScreenKeys("play", {
    "column-back": () => moveKeyed(stepColumn, -1),
    "column-on": () => moveKeyed(stepColumn, 1),
    "bar-back": () => moveKeyed(stepBar, -1),
    "bar-on": () => moveKeyed(stepBar, 1),
  });

  // Compared once per read of the song; a pass is marked only when its part is a compared variant.
  const comparisons = useMemo(
    () => (content && tuning ? compareVariants(content, tuning) : null),
    [content, tuning],
  );

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
    <main className="mx-auto max-w-screen-2xl pb-6 pl-[max(1rem,var(--safe-left))] pr-[max(1rem,var(--safe-right))] pt-2">
      <PageHeader
        title={song.title}
        subtitle={
          tuning
            ? `${stringLabels(tuning).join(" ")}${song.bpm ? ` — ${song.bpm} bpm` : ""}`
            : undefined
        }
        back={{ href: `/songs/${songId}`, label: "Song" }}
      />

      {steps.length === 0 ? (
        <EmptyState title="No arrangement yet, so there is nothing to lay out in order.">
          <ButtonLink href={`/songs/${songId}`} variant="primary">
            Build the arrangement
          </ButtonLink>
        </EmptyState>
      ) : (
        <>
        {content === undefined && view !== "frets" ? (
          <Loading />
        ) : (
        <ol className="grid gap-4">
          {passes.map(({ step, events }, index) => {
            const part = partsById.get(step.partId);
            const partEvents = eventsByPart?.[step.partId] ?? events;
            const comparison = comparisons?.get(step.partId);
            const marks = comparison
              ? staffMarks(comparison, {
                  events,
                  fromBar: step.fromBar,
                  toBar: step.toBar,
                  density: "expanded",
                })
              : null;

            const sectionWords = step.visits
              .map((visit) => (visit.time > 1 ? `${visit.label}, ${ordinal(visit.time)} time` : visit.label))
              .join(" / ");
            const firstOfPart = passes.findIndex((p) => p.step.partId === step.partId) === index;
            const heading = firstOfPart ? partHeading(partEvents, song.bpm).text : null;
            const sliced = step.fromBar !== null || step.toBar !== null;

            return (
              <li key={`${step.entryId}-${step.pass}-${index}`} className="print-keep">
                <div className="relative rounded-lg border border-border-subtle bg-bg-raised p-3">
                  <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-sm font-semibold">
                      {part?.label ?? "?"}
                    </span>
                    {sectionWords ? (
                      <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                        {sectionWords}
                      </span>
                    ) : null}
                    {step.passes > 1 ? (
                      <span className="text-xs text-text-faint">
                        pass {step.pass} of {step.passes}
                      </span>
                    ) : null}
                    {sliced ? (
                      <span className="text-xs text-text-dim">
                        bars {step.fromBar ?? 1}–{step.toBar ?? "end"} of this part
                      </span>
                    ) : null}
                    {part?.name ? (
                      <span className="text-xs text-text-faint">{part.name}</span>
                    ) : null}
                    {heading ? <span className="text-xs text-text-dim">{heading}</span> : null}
                  </div>

                  {tuning ? (
                    <TabStaff
                      events={events}
                      tuning={tuning}
                      annotations={annotationsByPart?.[step.partId] ?? []}
                      surface="raised"
                      showRhythm
                      wrap
                      pass={index}
                      barNumbers={{ offset: bars.offset[index] }}
                      reading={{ view, partEvents: eventsByPart?.[step.partId] ?? events, marks }}
                    />
                  ) : null}
                  {marks ? <VariantLine text={marks.line} /> : null}
                </div>
              </li>
            );
          })}
        </ol>
        )}
        </>
      )}

      <ClickBar
        song={song}
        passes={passes}
        notationReady={eventsByPart !== undefined}
        onColumn={onColumn}
        onStart={clearKeyed}
        idleRef={idleRef}
        rootRef={setBarRoot}
        cluster={
          <>
            {tuning && steps.length > 0 ? <ViewControl /> : null}
            <ButtonLink href={`/songs/${songId}/capture`}>Capture</ButtonLink>
          </>
        }
      />
    </main>
  );
}
