"use client";

/**
 * Generates an invite link for a band.
 *
 * The band has to exist on the server before it can be invited into, which it
 * will not if you created it offline and have not synced yet. That case gets a
 * real explanation rather than a generic failure, because it is the most
 * likely one in practice.
 */

import { useState } from "react";
import { Button, Card } from "@/components/ui";

export function InviteBandmate({ bandId }: { bandId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/bands/${bandId}/invite`, { method: "POST" });
      const body = (await response.json()) as { error?: string; code?: string };
      if (!response.ok || !body.code) {
        setError(body.error ?? "Could not create an invite.");
        return;
      }
      setLink(`${window.location.origin}/join/${body.code}`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  if (!link) {
    return (
      <div className="no-print">
        <Button onClick={create} disabled={busy}>
          {busy ? "Working…" : "Invite a bandmate"}
        </Button>
        {error ? (
          <p role="alert" className="mt-2 text-xs text-danger">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Card className="no-print">
      <p className="mb-2 text-xs text-text-dim">
        Send this to your bandmates. It works for 30 days and for as many people as you like.
      </p>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          aria-label="Invite link"
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-md border border-border-subtle bg-bg px-2 py-1.5 font-mono text-xs"
        />
        <Button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
            } catch {
              // Clipboard access is blocked in plenty of contexts; the input is
              // selectable, so this is a convenience rather than the mechanism.
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </Card>
  );
}
