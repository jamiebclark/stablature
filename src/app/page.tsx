"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, EmptyState, Input, Loading, PageHeader } from "@/components/ui";
import { createBand, createTuningFromPreset } from "@/lib/local/editing";
import { useBands } from "@/lib/local/hooks";
import { DEFAULT_PRESET_ID, presetById } from "@/lib/tunings";

export default function BandsPage() {
  const bands = useBands();
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
        <EmptyState title="No bands yet. Add one above to get started." />
      ) : (
        <ul className="grid gap-3">
          {bands.map((band) => (
            <li key={band.id}>
              <Link href={`/bands/${band.id}`} className="block">
                <Card className="transition hover:border-border-strong">
                  <p className="font-medium">{band.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-text-faint">{band.slug}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
