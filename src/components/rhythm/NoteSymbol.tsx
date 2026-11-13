import type { DurationId } from "@/lib/rhythm/durations";
import { GLYPH_BOX, NOTEHEAD, NOTES, OVAL, STEM, flagPath } from "@/components/rhythm/glyphs";

/** A duration's note symbol, drawn in `currentColor`; the button that holds it names it in words. */
export function NoteSymbol({ id }: { id: DurationId }) {
  const note = NOTES[id];
  return (
    <svg
      data-part="note-symbol"
      data-duration={id}
      viewBox={`0 0 ${GLYPH_BOX.width} ${GLYPH_BOX.height}`}
      className="h-5 w-auto"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
    >
      {id === "w" ? (
        <path d={OVAL} />
      ) : (
        <ellipse
          cx={NOTEHEAD.cx}
          cy={NOTEHEAD.cy}
          rx={NOTEHEAD.rx}
          ry={NOTEHEAD.ry}
          transform={`rotate(${NOTEHEAD.rotate} ${NOTEHEAD.cx} ${NOTEHEAD.cy})`}
          fill={note.filled ? "currentColor" : "none"}
        />
      )}
      {note.stem && <path d={STEM} />}
      {Array.from({ length: note.flags }, (_, i) => (
        <path key={i} d={flagPath(i + 1)} />
      ))}
    </svg>
  );
}
