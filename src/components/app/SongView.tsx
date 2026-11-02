"use client";

/**
 * The song: its parts, and the arrangement that sequences them.
 *
 * Laid out arrangement-first on purpose. The form is what you need when you
 * are standing up with a bass on — "what comes after the second B?" — and the
 * parts below it are the reference you drop into when you have forgotten how
 * one actually goes.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrangementEditor } from "@/components/arrangement/ArrangementEditor";
import { TabStaff } from "@/components/tab/TabStaff";
import { Button, ButtonLink, Card, EmptyState, Input, Loading, PageHeader } from "@/components/ui";
import { createPart, createVariant } from "@/lib/local/editing";
import {
  useArrangement,
  useBarCounts,
  useParts,
  useSong,
  useSongAnnotations,
  useSongEvents,
  useSongTuning,
  useTunings,
} from "@/lib/local/hooks";
import { deleteRow, patchRow } from "@/lib/local/mutate";
import type { PartRow } from "@/lib/model";
import type { Density } from "@/lib/tab/layout";
import { stringLabels } from "@/lib/tunings";

export function SongView({ songId }: { songId: string }) {
  const song = useSong(songId);
  const tuning = useSongTuning(song);
  const tunings = useTunings(song?.bandId);
  const parts = useParts(songId);
  const entries = useArrangement(songId);
  const eventsByPart = useSongEvents(songId);
  const annotationsByPart = useSongAnnotations(songId);
  const barCounts = useBarCounts(songId);

  const [density, setDensity] = useState<Density>("expanded");
  const router = useRouter();

  if (song === undefined) return <Loading />;
  if (!song) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-text-dim">That song is not on this device.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={song.title}
        subtitle={
          tuning ? `${stringLabels(tuning).join(" ")} — ${tuning.name}` : "No tuning available"
        }
        back={{ href: `/bands/${song.bandId}`, label: "Band" }}
        actions={
          <>
            <ButtonLink href={`/songs/${songId}/play`}>Play view</ButtonLink>
            <ButtonLink href={`/songs/${songId}/capture`} variant="primary">
              Capture
            </ButtonLink>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 no-print">
        {tunings && tunings.length > 1 ? (
          <label className="flex items-center gap-1.5 text-xs text-text-dim">
            Tuning
            <select
              value={song.tuningId ?? ""}
              onChange={(e) => patchRow("songs", song.id, { tuningId: e.target.value || null })}
              className="rounded border border-border-subtle bg-bg-raised px-2 py-1.5 text-sm text-text"
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

        <div className="ml-auto flex overflow-hidden rounded-md border border-border-subtle">
          {(["expanded", "compact"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDensity(option)}
              className={`px-2.5 py-1.5 text-xs ${
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
      </div>

      <section className="mb-8">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">
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

        {parts === undefined || eventsByPart === undefined ? (
          <Loading />
        ) : parts.length === 0 ? (
          <EmptyState title="No parts yet.">
            <ButtonLink href={`/songs/${songId}/capture`} variant="primary">
              Start capturing
            </ButtonLink>
          </EmptyState>
        ) : (
          <ul className="grid gap-3">
            {parts.map((part) => (
              <li key={part.id}>
                <PartCard
                  part={part}
                  parts={parts}
                  events={eventsByPart[part.id] ?? []}
                  annotations={annotationsByPart?.[part.id] ?? []}
                  tuning={tuning}
                  density={density}
                  songId={songId}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
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
  songId,
}: {
  part: PartRow;
  parts: readonly PartRow[];
  events: NonNullable<ReturnType<typeof useSongEvents>>[string];
  annotations: NonNullable<ReturnType<typeof useSongAnnotations>>[string];
  tuning: ReturnType<typeof useSongTuning>;
  density: Density;
  songId: string;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(part.name ?? "");

  const base = part.variantOfPartId
    ? parts.find((candidate) => candidate.id === part.variantOfPartId)
    : undefined;

  return (
    <Card>
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
            className="text-sm text-text-dim hover:text-accent"
          >
            {part.name ?? "name this part"}
          </button>
        )}

        {base ? (
          <span className="text-xs text-text-faint">
            variant of <span className="font-mono">{base.label}</span>
          </span>
        ) : null}

        <div className="ml-auto flex gap-1 no-print">
          {part.variantOfPartId ? null : (
            <Button onClick={() => createVariant(part)} title="Copy this part so it can diverge">
              + variant
            </Button>
          )}
          <ButtonLink href={`/songs/${songId}/capture/${part.id}`}>Edit</ButtonLink>
          <Button
            variant="danger"
            onClick={() => deleteRow("parts", part.id)}
            aria-label={`Delete part ${part.label}`}
          >
            Delete
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
        />
      ) : (
        <p className="text-xs text-text-faint">Add a tuning to draw this part.</p>
      )}
    </Card>
  );
}
