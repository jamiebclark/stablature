import { TRIPLET_REFUSAL } from "@/lib/capture/grouping";
import { chordToneNames, type Chord } from "@/lib/chords";
import { statusShortFor, type LatchId } from "@/lib/capture/latches";
import type { readDuration } from "@/lib/rhythm/durations";

/** A 1px rule between segments. \`inline\` draws it inside a truncating box so it is clipped with its segment. */
const Sep = ({ inline = false }: { inline?: boolean }) => (
  <span
    aria-hidden="true"
    className={inline ? "mr-0.5 inline-block h-3 w-px shrink-0 bg-text-faint align-middle" : "h-3 w-px shrink-0 bg-text-faint"}
  />
);

const symbolFit = (symbol: string) => (symbol.length <= 10 ? "shrink-0" : "min-w-[10ch] truncate");

export function StatusRow({
  status,
  lit,
  waiting,
  wideRow,
  refused,
  atEnd,
  afterId,
  chord,
  chordSymbol,
  cursorDuration,
  hasColumns,
  onStart,
  onEnd,
}: {
  status: string | null;
  lit: ReadonlySet<LatchId>;
  waiting: 1 | 2 | null;
  wideRow: boolean;
  refused: boolean;
  atEnd: boolean;
  afterId: string | null;
  chord: Chord | null;
  chordSymbol: string | null;
  cursorDuration: ReturnType<typeof readDuration>;
  hasColumns: boolean;
  onStart: () => void;
  onEnd: () => void;
}) {
  return (
        <div
          data-testid="status-row"
          className="flex h-(--status-row) shrink-0 items-center gap-0.5 overflow-hidden whitespace-nowrap border-t border-border-subtle px-3 text-[0.7rem]"
        >
          <span
            data-testid="status-position"
            className={`shrink-0 ${refused || status || !atEnd ? "text-accent" : "text-text-faint"}`}
          >
            {refused ? (
              TRIPLET_REFUSAL
            ) : (
              <>
                {/* A waiting digit takes the room the long words need, so they go short while it waits. */}
                {waiting
                  ? status
                    ? wideRow
                      ? status
                      : statusShortFor(lit)
                    : atEnd
                      ? "at the end"
                      : afterId === null
                        ? "at the start"
                        : "after the mark"
                  : status ||
                    (atEnd
                      ? "adding at the end"
                      : afterId === null
                        ? "adding at the start"
                        : "adding after the marked column")}
              </>
            )}
          </span>
          {/* Which notes the lit frets are. The unreadable-symbol case says so
              rather than leaving an unexplained bare neck. */}
          {chord ? (
            <>
              <Sep />
              <span
                data-testid="status-symbol"
                className={`${refused ? "min-w-0 truncate" : symbolFit(chord.symbol)} font-mono font-semibold text-accent`}
              >
                {chord.symbol}
              </span>
              <span className="sr-only"> chord:</span>
              {refused ? null : (
                <>
                  <span data-testid="status-tones" aria-hidden="true" className="ml-0.5 min-w-0 shrink-[1000] truncate font-mono text-text-dim">
                    {chordToneNames(chord).join(" ")}
                  </span>
                  <span className="sr-only">{chordToneNames(chord).join(", ")}</span>
                </>
              )}
            </>
          ) : chordSymbol ? (
            <>
              <Sep />
              <span
                data-testid="status-symbol"
                className={`${refused ? "min-w-0 truncate" : symbolFit(chordSymbol)} font-mono font-semibold text-text-faint`}
              >
                {chordSymbol}
              </span>
              <span
                className="min-w-0 truncate font-mono text-text-faint"
                title="Not a chord this app can read"
              >
                &mdash; not a chord I know
              </span>
            </>
          ) : null}
          {waiting ? (
            <span data-testid="digit-waiting" className="shrink-0 font-mono text-accent">
              <Sep inline />
              fret {waiting}&hellip;
            </span>
          ) : !refused && cursorDuration ? (
            <span data-testid="cursor-duration" className="min-w-0 shrink truncate font-mono text-text-dim">
              <Sep inline />
              {cursorDuration.words}
            </span>
          ) : null}
          {hasColumns ? (
            <>
              <Sep />
              <button
                type="button"
                onClick={onStart}
                className="inline-flex h-6 min-w-[44px] shrink-0 items-center justify-center rounded px-1.5 text-text-dim hover:text-accent"
              >
                &#8676; start
              </button>
              <button
                type="button"
                onClick={onEnd}
                className="inline-flex h-6 min-w-[44px] shrink-0 items-center justify-center rounded px-1.5 text-text-dim hover:text-accent"
              >
                end &#8677;
              </button>
            </>
          ) : null}
        </div>
  );
}
