"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { Button, ButtonLink, Card, EmptyState, Input, Loading, PageHeader } from "@/components/ui";
import { InviteBandmate } from "./InviteBandmate";
import { createSong } from "@/lib/local/editing";
import { useBand, useSongs, useTunings } from "@/lib/local/hooks";
import { stringLabels } from "@/lib/tunings";

export function BandView({ bandId }: { bandId: string }) {
  const band = useBand(bandId);
  const songs = useSongs(bandId);
  const tunings = useTunings(bandId);
  const router = useRouter();
  const [title, setTitle] = useState("");

  const defaultTuning = tunings?.find((t) => t.isDefault) ?? tunings?.[0];

  if (band === undefined) return <Loading />;
  if (!band) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-6">
        <p className="text-sm text-text-dim">That band is not on this device.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title={band.name}
        subtitle={
          defaultTuning
            ? `Default tuning: ${defaultTuning.name} — ${stringLabels(defaultTuning).join(" ")}`
            : "No tunings yet"
        }
        back={{ href: "/", label: "Bands" }}
        actions={
          <ButtonLink href={`/bands/${bandId}/tunings`}>
            <SlidersHorizontal size={15} aria-hidden />
            Tunings
          </ButtonLink>
        }
      />

      <form
        className="mb-6 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!title.trim()) return;
          const song = await createSong(bandId, title, defaultTuning?.id ?? null);
          setTitle("");
          router.push(`/songs/${song.id}`);
        }}
      >
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Song title"
          aria-label="Song title"
        />
        <Button type="submit" variant="primary" disabled={!title.trim()}>
          Add song
        </Button>
      </form>

      <div className="mb-6">
        <InviteBandmate bandId={bandId} />
      </div>

      {songs === undefined ? (
        <Loading />
      ) : songs.length === 0 ? (
        <EmptyState title="No songs yet. Add one above." />
      ) : (
        <ul className="grid gap-3">
          {songs.map((song) => (
            <li key={song.id}>
              <Card className="flex items-center justify-between gap-3 transition hover:border-border-strong">
                <Link href={`/songs/${song.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-medium">{song.title}</p>
                  {song.bpm ? (
                    <p className="mt-0.5 font-mono text-xs text-text-faint">{song.bpm} bpm</p>
                  ) : null}
                </Link>
                <ButtonLink href={`/songs/${song.id}/capture`} variant="primary">
                  Capture
                </ButtonLink>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
