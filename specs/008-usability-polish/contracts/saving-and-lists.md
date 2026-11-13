# Contract: saving words and the band list (US3, US6, FR-021 to FR-028)

The design is in [research.md](../research.md) R6, R7, R8 and R11.

## 1. `src/lib/saving.ts` (new, pure)

```ts
import type { SyncState } from "@/lib/sync/client"; // type-only: src/lib/sync/ keeps zero diff

export type SignIn = "signed-in" | "signed-out" | "unknown";

export function signInKnowledge(
  session: { data: unknown | null; isPending: boolean; error: { status?: number } | null },
  syncState: SyncState | undefined,
): SignIn;

export type PendingWords = null | "saved-here" | { count: number };
export function pendingWords(knowledge: SignIn, pending: number | undefined): PendingWords;

export const SAVED_HERE = "Saved on this device";
export const SAVED_HERE_SHORT = "saved · sign in";
export const SAVED_HERE_NAME = "Saved on this device. Sign in to sync with your band.";
```

The unit tests in `src/lib/__tests__/saving.test.ts` are the full table of research R8. The rows are each session shape ×
{`idle`, `syncing`, `offline`, `signed-out`, `error`, undefined}, then × `pending` ∈ {undefined, 0, 1, 14}. The expected values are
hand-written, not computed by the function under test.

## 2. `src/components/app/useSaving.ts` (new)

```ts
export function useSaving(): { words: PendingWords; signIn: SignIn; status: SyncStatus | undefined };
```

It calls `useSession()`, `useSyncStatus()` and `usePendingWrites()` once each. **TopBar and CaptureScreen both use it**, so their words
come from one `pendingWords` call.

## 3. TopBar

`SyncBadge`, in this order:

1. If `state === "error" && message`: the message, as today.
2. If `words === "saved-here"`: `<span className="text-text-faint">Saved on this device</span>`. No link: the existing `Sign in` link is
   next to it.
3. If `words` is `{ count }`: `<span className="font-mono text-text-faint" title="Not pushed yet">{count} unsynced</span>`, as today.
4. Otherwise `offline`, `syncing…` or nothing, as today.

The `{pending} local` branch is removed. That state now reads as signed-out (R8).

## 4. Capture header

The `pending ? <span>{pending} unsynced</span>` is replaced by:

- If `words === "saved-here"`:

  ```tsx
  <Link href="/sign-in" aria-label={SAVED_HERE_NAME}
        className="inline-flex min-h-(--control) shrink-0 items-center text-[0.7rem] text-text-faint hover:text-accent">
    {SAVED_HERE_SHORT}
  </Link>
  ```

- If `{ count }`: today's span, unchanged.
- Otherwise nothing.

Its width must be no more than a `99 unsynced` span drawn with today's classes in the same page (INV-019).

## 5. Band list

- `src/lib/local/queries.ts`: **add** `songCountsByBand(database = defaultDb): Promise<Record<string, number>>`. It reads
  `database.songs.toArray()`, filters with `isLive`, and counts by `bandId`.
- `src/lib/local/hooks.ts`: **add** `useSongCounts(): Record<string, number> | undefined`.
- `src/lib/words.ts` (new): `songCountWords(n: number): string`.
- `src/app/page.tsx`: the slug paragraph becomes `<p className="mt-0.5 text-xs text-text-dim">{songCountWords(counts?.[band.id] ?? 0)}</p>`.
  While `counts` is undefined, the line is left empty, rather than saying `No songs yet` before the query answers. The slug stays in the
  data and the URLs (FR-021). Slug uniqueness (FU31) is not touched (FR-023).
