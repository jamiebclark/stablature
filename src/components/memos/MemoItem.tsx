"use client";

/** One memo in a part's list (contracts/memo-ui.md §4). */

import { useState, useSyncExternalStore } from "react";
import { Download, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { Button, Input, Sheet } from "@/components/ui";
import { OverflowMenu } from "@/components/ui/OverflowMenu";
import { useSession } from "@/lib/auth-client";
import { db } from "@/lib/local/db";
import { useMemoLocal } from "@/lib/local/hooks";
import { deleteMemo, renameMemo, retryMemo } from "@/lib/local/memos";
import { isDownloading, subscribeDownloading } from "@/lib/memos/transfer";
import { LABEL_MAX } from "@/lib/memos/limits";
import { memoState } from "@/lib/memos/state";
import { downloadName, formatClock } from "@/lib/memos/words";
import type { MemoRow } from "@/lib/model";
import { saveClip } from "./download";
import { useMemoPlayer, useOnline } from "./useMemoPlayer";

function dateWords(ms: number): string {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

export function MemoItem({
  memo,
  index,
  songTitle,
  partLabel,
}: {
  memo: MemoRow;
  /** 1-based position among the part's live memos, oldest first. */
  index: number;
  songTitle: string;
  partLabel: string;
}) {
  const title = memo.label ?? `Memo ${index}`;
  const local = useMemoLocal(memo.id);
  const { data: session } = useSession();
  const online = useOnline();
  const player = useMemoPlayer(memo.id, memo.format);
  const downloading = useSyncExternalStore(
    subscribeDownloading,
    () => isDownloading(memo.id),
    () => false,
  );
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(memo.label ?? "");
  const [deleting, setDeleting] = useState(false);

  const state = memoState({
    row: memo,
    hasAudio: local?.hasAudio ?? false,
    upload: local?.upload ?? null,
    fetch: local?.fetch ?? null,
    downloading,
    recordedHere: (local?.upload ?? null) !== null || memo.serverSeq === 0,
    signedIn: Boolean(session?.user),
    online,
    canPlay: player.canPlay,
    decodeFailed: player.decodeFailed,
  });

  const download = async () => {
    const entry = await db.memoAudio.get(memo.id);
    if (!entry) return;
    saveClip(
      entry.bytes,
      entry.format,
      downloadName({ songTitle, partLabel, label: memo.label, recordedAt: memo.recordedAt, format: memo.format }),
    );
  };

  return (
    <li data-testid="memo" data-memo-id={memo.id} data-state={state.kind} className="rounded-md bg-bg-sunken p-2">
      <audio {...player.audioProps} className="hidden" />
      <div className="flex flex-wrap items-center gap-2">
        {renaming ? (
          <form
            className="flex flex-1 gap-1.5"
            onSubmit={async (e) => {
              e.preventDefault();
              await renameMemo(memo.id, name);
              setRenaming(false);
            }}
          >
            <Input
              autoFocus
              value={name}
              maxLength={LABEL_MAX}
              onChange={(e) => setName(e.target.value)}
              aria-label="Memo name"
            />
            <Button type="submit" variant="primary">
              Save
            </Button>
          </form>
        ) : (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{title}</span>
            <span className="block text-xs text-text-dim">
              {memo.recordedByName ?? "You"} · {dateWords(memo.recordedAt)} · {formatClock(memo.durationMs)}
            </span>
          </span>
        )}
        <OverflowMenu
          label={`Actions for memo ${title}`}
          items={[
            {
              label: "Rename",
              ariaLabel: `Rename memo ${title}`,
              icon: <Pencil size={15} aria-hidden />,
              onSelect: () => {
                setName(memo.label ?? "");
                setRenaming(true);
              },
            },
            ...(local?.hasAudio
              ? [{ label: "Download", ariaLabel: `Download memo ${title}`, icon: <Download size={15} aria-hidden />, onSelect: download }]
              : []),
            {
              label: "Delete",
              ariaLabel: `Delete memo ${title}`,
              icon: <Trash2 size={15} aria-hidden />,
              destructive: true,
              onSelect: () => setDeleting(true),
            },
          ]}
        />
      </div>

      {state.player ? (
        <div className="mt-1 flex items-center gap-2">
          <Button
            data-testid="memo-play"
            aria-label={`${player.playing ? "Pause" : "Play"} memo ${title}`}
            aria-pressed={player.playing}
            className="min-w-(--control)"
            onClick={() => void player.toggle()}
          >
            {player.playing ? <Pause size={16} aria-hidden /> : <Play size={16} aria-hidden />}
          </Button>
          <input
            type="range"
            data-testid="memo-seek"
            aria-label={`Position in memo ${title}`}
            min={0}
            max={memo.durationMs}
            step={100}
            value={Math.min(player.elapsedMs, memo.durationMs)}
            onChange={(e) => void player.seek(Number(e.target.value))}
            className="min-h-(--control) min-w-0 flex-1 accent-accent"
          />
          {/* At rest it shows the length: a bare 0:00 reads as an empty clip. Once played it shows the position. */}
          <span data-testid="memo-elapsed" className="text-xs tabular-nums text-text-dim">
            {formatClock(player.playing || player.elapsedMs > 0 ? player.elapsedMs : memo.durationMs)}
          </span>
        </div>
      ) : null}

      {state.words ? (
        <p data-testid="memo-state" className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-dim">
          {state.words}
          {state.action === "download" ? (
            <Button data-testid="memo-download" onClick={() => void download()}>
              Download
            </Button>
          ) : null}
          {state.action === "retry" ? (
            <Button data-testid="memo-retry" onClick={() => void retryMemo(memo.id)}>
              Try again
            </Button>
          ) : null}
        </p>
      ) : null}

      <Sheet open={deleting} onClose={() => setDeleting(false)} label={`Delete memo ${title}?`}>
        <p className="mb-3 text-sm">
          This deletes the memo for everyone in the band. Its recording is erased and can&apos;t be brought back.
        </p>
        <div className="flex gap-2">
          <Button
            variant="danger"
            onClick={async () => {
              setDeleting(false);
              await deleteMemo(memo.id);
            }}
          >
            Delete memo
          </Button>
          <Button onClick={() => setDeleting(false)}>Cancel</Button>
        </div>
      </Sheet>
    </li>
  );
}
