"use client";

/**
 * The song: its parts, and the arrangement that sequences them.
 *
 * Laid out arrangement-first on purpose. The form is what you need when you
 * are standing up with a bass on — "what comes after the second B?" — and the
 * parts below it are the reference you drop into when you have forgotten how
 * one actually goes.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GitBranch, Pencil, Play, Trash2 } from "lucide-react";
import { ArrangementEditor } from "@/components/arrangement/ArrangementEditor";
import { ExportSong } from "@/components/app/ExportSong";
import { PasteTab } from "@/components/app/PasteTab";
import { ViewControl } from "@/components/reading/ViewControl";
import { useStaffView } from "@/components/reading/useStaffView";
import { VariantLine } from "@/components/reading/VariantLine";
import { TabStaff } from "@/components/tab/TabStaff";
import { Button, ButtonLink, Card, EmptyState, Input, Loading, PageHeader, Panel, TouchLabel } from "@/components/ui";
import { partHeading } from "@/lib/reading/bars";
import { createPart, createVariant } from "@/lib/local/editing";
import {
  useArrangement,
  useBarCounts,
  useSong,
  useSongContent,
  useSongs,
  useSongTuning,
  useTunings,
} from "@/lib/local/hooks";
import { deleteRow, patchRow } from "@/lib/local/mutate";
import type { AnnotationRow, EventRow, PartRow } from "@/lib/model";
import { compareVariants, type VariantComparison } from "@/lib/reading/compare";
import { staffMarks } from "@/lib/reading/marks";
import type { StaffView } from "@/lib/reading/view";
import type { Density } from "@/lib/tab/layout";
import { stringLabels } from "@/lib/tunings";

export function SongView({ songId }: { songId: string }) {
  const song = useSong(songId);
  const tuning = useSongTuning(song);
  const tunings = useTunings(song?.bandId);
  const bandSongs = useSongs(song?.bandId);
  const content = useSongContent(songId);
  const parts = content?.parts;
  const eventsByPart = content?.eventsByPart;
  const annotationsByPart = content?.annotationsByPart;
  const entries = useArrangement(songId);
  const [view] = useStaffView();
  const barCounts = useBarCounts(songId);

  const [density, setDensity] = useState<Density>("expanded");
  const [pasting, setPasting] = useState(false);
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const router = useRouter();

  // Compared once per read of the song, and only when the whole song has arrived (FR-026).
  const comparisons = useMemo(
    () => (content && tuning ? compareVariants(content, tuning) : null),
    [content, tuning],
  );

  const hasScrollTarget = scrollTo !== null && (parts?.some((p) => p.id === scrollTo) ?? false);
  useEffect(() => {
    if (!scrollTo || !hasScrollTarget) return;
    document.getElementById(`part-${scrollTo}`)?.scrollIntoView({ block: "nearest" });
  }, [scrollTo, hasScrollTarget]);

  if (song === undefined) return <Loading />;
  if (!song) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-text-dim">That song is not on this device.</p>
      </main>
    );
  }

  const actions = (
    <>
      <ButtonLink href={`/songs/${songId}/play`}>
        <Play size={15} aria-hidden />
        Play view
      </ButtonLink>
      <ButtonLink href={`/songs/${songId}/capture`} variant="primary">
        Capture
      </ButtonLink>
    </>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 pb-6 pt-3">
      <PageHeader
        title={song.title}
        subtitle={
          tuning ? `${stringLabels(tuning).join(" ")} — ${tuning.name}` : "No tuning available"
        }
        back={{ href: `/bands/${song.bandId}`, label: "Band" }}
        touchBar
        actions={actions}
      />

      <div className="mb-2 no-print">
      <Panel id="song-tools" label="Song tools">
      <div className="flex flex-wrap items-center gap-3">
        {tunings && tunings.length > 1 ? (
          <label className="flex items-center gap-1.5 text-xs text-text-dim">
            Tuning
            <select
              value={song.tuningId ?? ""}
              onChange={(e) => patchRow("songs", song.id, { tuningId: e.target.value || null })}
              className="min-h-(--control) rounded border border-border-subtle bg-bg-raised px-2 text-text"
            >
              {/* Null means "whatever the band plays in", so retuning the band
                  does not require touching every song. */}
              <option value="">Band default</option>
              {tunings.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex items-center gap-1.5 text-xs text-text-dim">
          BPM
          <Input
            type="number"
            min={20}
            max={400}
            value={song.bpm ?? ""}
            onChange={(e) =>
              patchRow("songs", song.id, { bpm: e.target.value ? Number(e.target.value) : null })
            }
            className="w-20"
            aria-label="Beats per minute"
          />
        </label>

        {tuning && parts && eventsByPart && entries ? (
          <ExportSong
            density={density}
            input={{
              song,
              tuning,
              tuningName: tuning.name,
              parts,
              eventsByPart,
              annotationsByPart: annotationsByPart ?? {},
              entries,
            }}
          />
        ) : null}

        {tuning && parts && eventsByPart && entries && view !== "frets" ? (
          <span className="text-xs text-text-dim no-print" data-testid="export-note">
            Exports use fret numbers
          </span>
        ) : null}

        <div className="ml-auto flex overflow-hidden rounded-md border border-border-subtle">
          {(["expanded", "compact"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDensity(option)}
              className={`min-h-(--control) px-3 text-xs ${
                density === option ? "bg-accent text-accent-text" : "text-text-dim"
              }`}
              title={
                option === "expanded"
                  ? "Draw every repetition"
                  : "Collapse repeats, fitting more on screen"
              }
            >
              {option}
            </button>
          ))}
        </div>

        {tuning ? <ViewControl /> : null}
      </div>
      </Panel>
      </div>

      <section className="mb-4">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Arrangement
        </h2>
        {entries === undefined || parts === undefined || barCounts === undefined ? (
          <Loading />
        ) : (
          <ArrangementEditor
            song={song}
            parts={parts}
            entries={entries}
            barCounts={barCounts}
          />
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-dim">Parts</h2>
          <div className="flex gap-2 no-print">
            <Button className="no-print" onClick={() => setPasting((open) => !open)}>
              Paste tab
            </Button>
            <Button
              className="no-print"
              onClick={async () => {
                const created = await createPart(song);
                router.push(`/songs/${songId}/capture/${created.id}`);
              }}
            >
              + part
            </Button>
          </div>
        </div>

        {pasting && parts !== undefined && eventsByPart !== undefined && tunings !== undefined && bandSongs !== undefined ? (
          <PasteTab
            song={song}
            tuning={tuning}
            tunings={tunings}
            bandSongs={bandSongs}
            parts={parts}
            eventsByPart={eventsByPart}
            density={density}
            onClose={() => setPasting(false)}
            onImported={setScrollTo}
          />
        ) : null}

        {parts === undefined || eventsByPart === undefined ? (
          <Loading />
        ) : parts.length === 0 ? (
          <EmptyState title="No parts yet.">
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={`/songs/${songId}/capture`} variant="primary">
                Start capturing
              </ButtonLink>
              <Button className="no-print" onClick={() => setPasting(true)}>
                Paste tab
              </Button>
            </div>
          </EmptyState>
        ) : (
          <ul className="grid gap-3">
            {parts.map((part) => (
              <li key={part.id} id={`part-${part.id}`}>
                <PartCard
                  part={part}
                  parts={parts}
                  events={eventsByPart[part.id] ?? []}
                  annotations={annotationsByPart?.[part.id] ?? []}
                  tuning={tuning}
                  density={density}
                  view={view}
                  comparison={comparisons?.get(part.id)}
                  songId={songId}
                  bpm={song.bpm}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        data-testid="song-actions"
        className="no-print sticky bottom-0 z-10 -mx-4 mt-4 flex gap-2 border-t border-border-subtle bg-bg px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] fine:hidden"
      >
        {actions}
      </div>
    </main>
  );
}

function PartCard({
  part,
  parts,
  events,
  annotations,
  tuning,
  density,
  view,
  comparison,
  songId,
  bpm,
}: {
  part: PartRow;
  parts: readonly PartRow[];
  events: readonly EventRow[];
  annotations: readonly AnnotationRow[];
  tuning: ReturnType<typeof useSongTuning>;
  density: Density;
  view: StaffView;
  comparison: VariantComparison | undefined;
  songId: string;
  bpm: number | null;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(part.name ?? "");

  const base = part.variantOfPartId
    ? parts.find((candidate) => candidate.id === part.variantOfPartId)
    : undefined;

  const heading = useMemo(() => partHeading(events, bpm), [events, bpm]);

  const marks = useMemo(
    () =>
      comparison
        ? staffMarks(comparison, { events, fromBar: null, toBar: null, density })
        : null,
    [comparison, events, density],
  );

  return (
    <Card className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded bg-bg-sunken px-2 py-0.5 font-mono text-sm font-semibold">
          {part.label}
        </span>

        {renaming ? (
          <form
            className="flex flex-1 gap-1.5"
            onSubmit={async (e) => {
              e.preventDefault();
              await patchRow("parts", part.id, { name: name.trim() || null });
              setRenaming(false);
            }}
          >
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. main riff"
              aria-label="Part name"
            />
            <Button type="submit" variant="primary">
              Save
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            className="inline-flex min-h-(--control) items-center text-sm text-text-dim hover:text-accent"
          >
            {part.name ?? "name this part"}
          </button>
        )}

        {heading.text ? (
          <span data-testid="part-heading" className="text-xs text-text-faint">
            {heading.text}
          </span>
        ) : null}

        {base ? (
          <span className="text-xs text-text-faint">
            variant of <span className="font-mono">{base.label}</span>
          </span>
        ) : null}

        <div className="ml-auto flex gap-1 no-print">
          {part.variantOfPartId ? null : (
            <Button onClick={() => createVariant(part)} title="Copy this part so it can diverge">
              <GitBranch size={15} aria-hidden />
              + variant
            </Button>
          )}
          <ButtonLink
            href={`/songs/${songId}/capture/${part.id}`}
            className="min-w-(--control)"
            title="Edit"
          >
            <Pencil size={15} aria-hidden />
            <TouchLabel>Edit</TouchLabel>
          </ButtonLink>
          <Button
            variant="danger"
            className="ml-2 min-w-(--control)"
            onClick={() => deleteRow("parts", part.id)}
            aria-label={`Delete part ${part.label}`}
            title="Delete"
          >
            <Trash2 size={15} aria-hidden />
            <TouchLabel>Delete</TouchLabel>
          </Button>
        </div>
      </div>

      {tuning ? (
        <TabStaff
          events={events}
          tuning={tuning}
          annotations={annotations}
          density={density}
          surface="raised"
          showRhythm
          barNumbers={{ offset: 0 }}
          reading={{ view, partEvents: events, marks }}
        />
      ) : (
        <p className="text-xs text-text-faint">Add a tuning to draw this part.</p>
      )}
      {marks ? <VariantLine text={marks.line} /> : null}
    </Card>
  );
}
