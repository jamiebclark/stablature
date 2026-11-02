"use client";

/**
 * A band's tunings.
 *
 * Bands keep several and pick a default, because a band that plays in Drop A
 * should not have to re-pick it for every song. The string count is a
 * consequence of the tuning rather than a separate setting -- being a 5-string
 * is what being tuned BEADG means.
 */

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, EmptyState, Loading, PageHeader } from "@/components/ui";
import { createTuningFromPreset, setDefaultTuning } from "@/lib/local/editing";
import { deleteRow } from "@/lib/local/mutate";
import { useTunings } from "@/lib/local/hooks";
import { stringCount, stringLabels, TUNING_PRESETS, type TuningPreset } from "@/lib/tunings";

const FAMILIES = [...new Set(TUNING_PRESETS.map((p) => p.family))];

export function TuningsView({ bandId }: { bandId: string }) {
  const tunings = useTunings(bandId);
  const [family, setFamily] = useState<TuningPreset["family"]>("Bass 5");

  async function add(preset: TuningPreset) {
    // The first tuning added becomes the default; there is nothing to compete.
    await createTuningFromPreset(bandId, preset, (tunings?.length ?? 0) === 0);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Tunings"
        subtitle="The default is what songs use unless they say otherwise."
        back={{ href: `/bands/${bandId}`, label: "Band" }}
      />

      {tunings === undefined ? (
        <Loading />
      ) : tunings.length === 0 ? (
        <EmptyState title="No tunings yet. Add one from the presets below." />
      ) : (
        <ul className="mb-8 grid gap-2">
          {tunings.map((tuning) => (
            <li key={tuning.id}>
              <Card className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {tuning.name}
                    {tuning.isDefault ? (
                      <span className="ml-2 rounded bg-accent-dim px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-accent">
                        default
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-text-faint">
                    {stringCount(tuning)}-string &middot; {stringLabels(tuning).join(" ")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {tuning.isDefault ? null : (
                    <Button onClick={() => setDefaultTuning(tunings, tuning.id)}>
                      Make default
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    onClick={() => deleteRow("tunings", tuning.id)}
                    aria-label={`Delete ${tuning.name}`}
                  >
                    <Trash2 size={15} aria-hidden />
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-sm font-semibold text-text-dim">Add from a preset</h2>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {FAMILIES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => setFamily(candidate)}
            className={`rounded px-2.5 py-1 text-xs ${
              candidate === family ? "bg-accent text-accent-text" : "bg-bg-raised text-text-dim"
            }`}
          >
            {candidate}
          </button>
        ))}
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {TUNING_PRESETS.filter((p) => p.family === family).map((preset) => (
          <li key={preset.id}>
            <Card className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm">{preset.name}</p>
                <p className="mt-0.5 font-mono text-xs text-text-faint">
                  {stringLabels(preset).join(" ")}
                </p>
              </div>
              <Button onClick={() => add(preset)} aria-label={`Add ${preset.name}`}>
                <Plus size={15} aria-hidden />
                Add
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  );
}
