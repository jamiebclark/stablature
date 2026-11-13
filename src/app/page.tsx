"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input, Loading, PageHeader } from "@/components/ui";
import { LogoMark } from "@/components/app/Logo";
import { createBand, createTuningFromPreset } from "@/lib/local/editing";
import { useBands, useSongCounts } from "@/lib/local/hooks";
import { songCountWords } from "@/lib/words";
import { DEFAULT_PRESET_ID, presetById } from "@/lib/tunings";

export default function BandsPage() {
  const bands = useBands();
  const counts = useSongCounts();
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create() {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const band = await createBand(trimmed);
      // Seed a 5-string B standard so a brand-new band can capture immediately
      // rather than being sent to a settings screen first.
      await createTuningFromPreset(band.id, presetById(DEFAULT_PRESET_ID)!, true);
      setName("");
      router.push(`/bands/${band.id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader title="Bands" />

      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Band name"
          aria-label="Band name"
        />
        <Button type="submit" variant="primary" disabled={!name.trim() || busy}>
          Add band
        </Button>
      </form>

      {bands === undefined ? (
        <Loading />
      ) : bands.length === 0 ? (
        /*
         * Shown once and then never again. Somebody opening this for the
         * first time has no idea what it is, and somebody opening it for the
         * hundredth wants their bands and nothing else -- so the explanation
         * lives in the empty state rather than on the page.
         */
        <div className="rounded-lg border border-dashed border-border-subtle px-6 py-10 text-center">
          <div className="mb-3 flex justify-center text-text-dim">
            <LogoMark size={28} />
          </div>
          <p className="mx-auto max-w-sm text-sm text-text-dim">
            Tablature for bands that build songs out of lettered parts. Capture a riff on
            your phone while someone is playing it at you — in a rehearsal room with no
            signal — then read the whole song back as a form rather than metres of tab.
          </p>
          <p className="mt-3 text-xs text-text-faint">Name your band above to start.</p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {bands.map((band) => (
            <li key={band.id}>
              <Link href={`/bands/${band.id}`} className="block">
                <Card className="transition hover:border-border-strong">
                  <p className="font-medium">{band.name}</p>
                  <p className="mt-0.5 text-xs text-text-faint">{songCountWords(counts?.[band.id] ?? 0)}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
