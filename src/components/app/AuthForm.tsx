"use client";

/**
 * Sign in / sign up.
 *
 * Worth being clear about what authentication is for here: it gates *syncing*,
 * not *using*. The app reads from a local mirror, so capture keeps working in a
 * rehearsal room with no signal — where verifying a session is impossible by
 * definition. Signing in is what lets your bandmates see what you captured.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Input } from "@/components/ui";
import { signIn, signUp } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signingUp = mode === "sign-up";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = signingUp
        ? await signUp.email({ name, email, password })
        : await signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? "That did not work. Check your details.");
        return;
      }
      router.push("/");
    } catch {
      // Almost always "the server is unreachable". Say so, rather than showing
      // a generic failure that implies the credentials were wrong.
      setError("Could not reach the server. You can still capture offline.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold tracking-tight">
        {signingUp ? "Create an account" : "Sign in"}
      </h1>
      <p className="mb-5 text-sm text-text-dim">
        Signing in is only needed to sync with your band. Capture works offline either way.
      </p>

      <Card>
        <form className="grid gap-3" onSubmit={submit}>
          {signingUp ? (
            <label className="grid gap-1 text-xs text-text-dim">
              Name
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
          ) : null}

          <label className="grid gap-1 text-xs text-text-dim">
            Email
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="grid gap-1 text-xs text-text-dim">
            Password
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signingUp ? "new-password" : "current-password"}
              minLength={8}
              required
            />
          </label>

          {error ? (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : null}

          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? "Working…" : signingUp ? "Create account" : "Sign in"}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-xs text-text-dim">
        {signingUp ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="text-accent hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account yet?{" "}
            <Link href="/sign-up" className="text-accent hover:underline">
              Create one
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
