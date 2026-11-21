"use client";

/**
 * The memo area of one part card (contracts/memo-ui.md §2). Renders nothing for a part with no memos, no recording,
 * no held clip and no notice, so a card with nothing to say keeps exactly its old height (INV-012).
 */

import { Button } from "@/components/ui";
import { dismissMemoNotice } from "@/lib/local/memos";
import { LIST_VISIBLE } from "@/lib/memos/limits";
import { useMemoNotices, useMemos } from "@/lib/local/hooks";
import { useMemosExpanded } from "@/lib/memos/prefs";
import type { PartRow } from "@/lib/model";
import { unavailableWords, type Availability } from "@/lib/memos/words";
import { MemoItem } from "./MemoItem";
import { RecordPanel } from "./RecordPanel";
import { useRecorder } from "./useRecorder";

export function PartMemos({
  part,
  songTitle,
  explanation = null,
  onCloseExplanation,
}: {
  part: PartRow;
  songTitle: string;
  explanation?: Availability | null;
  onCloseExplanation?: () => void;
}) {
  const memos = useMemos(part.id) ?? [];
  const notices = useMemoNotices(part.id) ?? [];
  const { rec, snap } = useRecorder();
  const [expanded, setExpanded] = useMemosExpanded(part.id);

  const mine = snap.partId === part.id && snap.phase !== "idle";
  if (memos.length === 0 && notices.length === 0 && !mine && !explanation) return null;

  const hidden = memos.length > LIST_VISIBLE && !expanded ? memos.length - LIST_VISIBLE : 0;
  const start = hidden === 0 ? 0 : memos.length - LIST_VISIBLE;
  const drawn = memos.slice(start);

  return (
    <section data-testid="part-memos" aria-label={`Memos for part ${part.label}`} className="no-print mt-3 w-full">
      {notices.map((n) => (
        <p
          key={n.id}
          role="status"
          data-testid="memo-notice"
          className="mb-2 flex flex-wrap items-center gap-2 text-sm text-text-dim"
        >
          {n.words}
          <Button aria-label="Dismiss notice" onClick={() => void dismissMemoNotice(n.id)}>
            Dismiss
          </Button>
        </p>
      ))}
      {mine ? <RecordPanel rec={rec} snap={snap} songTitle={songTitle} partLabel={part.label} /> : null}
      {explanation ? (
        <p role="note" data-testid="record-unavailable" className="mb-2 flex flex-wrap items-center gap-2 text-sm text-text-dim">
          {unavailableWords(explanation, part.label)}
          <Button onClick={onCloseExplanation}>Close</Button>
        </p>
      ) : null}
      {memos.length > 0 ? (
        <>
          {memos.length > LIST_VISIBLE ? (
            <Button data-testid="memo-more" className="mb-2" onClick={() => setExpanded(!expanded)}>
              {expanded
                ? "Show fewer"
                : `Show ${hidden} earlier memo${hidden === 1 ? "" : "s"}`}
            </Button>
          ) : null}
          <ol data-testid="memo-list" className="grid gap-2">
            {drawn.map((memo, i) => (
              <MemoItem
                key={memo.id}
                memo={memo}
                index={start + i + 1}
                songTitle={songTitle}
                partLabel={part.label}
              />
            ))}
          </ol>
        </>
      ) : null}
    </section>
  );
}
