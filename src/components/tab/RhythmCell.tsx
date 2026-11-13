import type { ReactNode } from "react";
import type { RhythmMark } from "@/lib/rhythm/beams";
import { GLYPH_BOX, OVAL, RESTS, STAFF_FLAG } from "@/components/rhythm/glyphs";

const BOX = `0 0 ${GLYPH_BOX.width} ${GLYPH_BOX.height}`;

/**
 * One column's rhythm: stem, beam halves, stubs, flags, a rest or the whole-note oval. Decorative; the column's
 * own label already says what it plays. Geometry and colour are in globals.css (`.tab-rhythm`).
 */
export function RhythmCell({ mark, children }: { mark: RhythmMark; children?: ReactNode }) {
  if (mark.kind === "none") {
    return <div className="tab-rhythm" data-testid="tab-rhythm" aria-hidden="true">{children}</div>;
  }
  if (mark.kind === "rest") {
    return (
      <div
        className="tab-rhythm"
        data-testid="tab-rhythm"
        aria-hidden="true"
        data-rhythm="rest"
        data-duration={mark.duration}
      >
        <svg data-part="rest" data-duration={mark.duration} viewBox={BOX}>
          <path d={RESTS[mark.duration]} />
        </svg>
        {children}
      </div>
    );
  }
  const levels = [1, 2, 3].filter((k) => k <= mark.levels);
  return (
    <div
      className="tab-rhythm"
      data-testid="tab-rhythm"
      aria-hidden="true"
      data-rhythm="note"
      data-duration={mark.duration}
      data-flags={mark.flags}
      data-beams-left={mark.left}
      data-beams-right={mark.right}
    >
      {mark.duration === "w" ? (
        <svg data-part="oval" viewBox={BOX}>
          <path d={OVAL} />
        </svg>
      ) : (
        <div data-part="stem" />
      )}
      {levels
        .filter((k) => k <= mark.left)
        .map((k) => (
          <div key={`l${k}`} data-part="beam" data-level={k} data-side="left" />
        ))}
      {levels
        .filter((k) => k <= mark.right)
        .map((k) => (
          <div key={`r${k}`} data-part="beam" data-level={k} data-side="right" />
        ))}
      {mark.stubs > 0 && mark.stubSide
        ? levels
            .filter((k) => k > mark.levels - mark.stubs)
            .map((k) => <div key={`s${k}`} data-part="stub" data-level={k} data-side={mark.stubSide!} />)
        : null}
      {levels
        .filter((k) => k <= mark.flags)
        .map((k) => (
          <svg
            key={`f${k}`}
            data-part="flag"
            data-level={k}
            viewBox={`0 0 ${STAFF_FLAG.width} ${STAFF_FLAG.height}`}
          >
            <path d={STAFF_FLAG.path} />
          </svg>
        ))}
      {children}
    </div>
  );
}
