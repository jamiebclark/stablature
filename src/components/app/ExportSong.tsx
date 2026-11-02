"use client";

/**
 * Copy or download the whole song as plain text.
 *
 * Deliberately prominent rather than buried in a menu. A band tool your work
 * can get stuck inside is worse than one you can paste out of, and pasting a
 * part into the band chat is something people already do constantly.
 */

import { useState } from "react";
import { Button } from "@/components/ui";
import { exportFilename, songToText, type SongExportInput } from "@/lib/export/text";
import type { Density } from "@/lib/tab/layout";

export function ExportSong({
  input,
  density,
}: {
  input: SongExportInput;
  density: Density;
}) {
  const [copied, setCopied] = useState(false);

  const build = () => songToText(input, { density });

  return (
    <div className="flex gap-1.5 no-print">
      <Button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(build());
            setCopied(true);
            window.setTimeout(() => setCopied(false), 2000);
          } catch {
            // Clipboard access is blocked in plenty of contexts; the download
            // below always works, so this is a convenience, not the mechanism.
            setCopied(false);
          }
        }}
        title="Copy the whole song as text"
      >
        {copied ? "Copied" : "Copy text"}
      </Button>

      <Button
        onClick={() => {
          const blob = new Blob([build()], { type: "text/plain;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = exportFilename(input.song.title);
          link.click();
          // Revoking immediately can race the download on some browsers.
          window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
        }}
        title="Download the song as a .txt file"
      >
        Download
      </Button>
    </div>
  );
}
