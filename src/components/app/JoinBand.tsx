"use client";

/**
 * Redeeming an invite link.
 *
 * Accepting needs the server, so this is one of the few screens that cannot
 * work offline — and it says so rather than spinning. Once accepted, the
 * band's whole history arrives through the normal pull, because the client
 * notices a band it has not seen before and rewinds its cursor (see
 * sync/client.ts).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Loading } from "@/components/ui";
import { useSession } from "@/lib/auth-client";
import { syncNow } from "@/lib/sync/client";

export function JoinBand({ code }: { code: string }) {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [state, setState] = useState<"idle" | "joining" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function accept() {
    setState("joining");
    setMessage(null);
    try {
      const response = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = (await response.json()) as { error?: string; bandId?: string };

      if (!response.ok || !body.bandId) {
        setState("error");
        setMessage(body.error ?? "That did not work.");
        return;
      }

      // Pull straight away so the band is populated by the time we land on it,
      // rather than showing an empty song list for a second.
      await syncNow();
      router.push(`/bands/${body.bandId}`);
    } catch {
      setState("error");
      setMessage("Could not reach the server. Try again once you have signal.");
    }
  }

  if (isPending) return <Loading />;

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold tracking-tight">Join a band</h1>
      <p className="mb-5 font-mono text-sm text-text-dim">{code}</p>

      <Card>
        {session ? (
          <>
            <p className="mb-3 text-sm text-text-dim">
              You will be able to see and edit this band&apos;s songs.
            </p>
            <Button
              variant="primary"
              onClick={accept}
              disabled={state === "joining"}
              className="w-full"
            >
              {state === "joining" ? "Joining…" : "Accept invite"}
            </Button>
          </>
        ) : (
          <>
            <p className="mb-3 text-sm text-text-dim">
              Sign in first, then this link will add you to the band.
            </p>
            <Link href="/sign-in" className="block">
              <Button variant="primary" className="w-full">
                Sign in
              </Button>
            </Link>
          </>
        )}

        {message ? (
          <p role="alert" className="mt-3 text-xs text-danger">
            {message}
          </p>
        ) : null}
      </Card>
    </main>
  );
}
