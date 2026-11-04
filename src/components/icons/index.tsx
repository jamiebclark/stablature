/**
 * The two glyphs a general-purpose icon set cannot supply.
 *
 * Music already has notation for these, and no abstract icon beats it: nothing
 * in a UI icon library says "triplet" to a bass player faster than a bracket
 * with a 3 over it. Everything generic -- copy, delete, download -- comes from
 * lucide instead, because reinventing a trash can helps nobody.
 *
 * Both are drawn against the same 16-unit box and inherit `currentColor`, so
 * they sit on a button line with lucide icons without looking imported.
 */

export interface GlyphProps {
  className?: string;
}

/**
 * A bracket, with the number it prints over it when it has one.
 *
 * Rails shorten as the numeral widens, so the number never touches them. With
 * no numeral it is one closed path: a group that prints nothing.
 */
export function BracketGlyph({ className, numeral }: GlyphProps & { numeral?: number }) {
  const digits = numeral === undefined ? 0 : String(numeral).length;
  const rails =
    digits === 0
      ? null
      : digits === 1 && numeral === 3
        ? (["M1.5 12V8.5h3.6", "M10.9 8.5h3.6V12"] as const)
        : digits === 1
          ? (["M1.5 12V8.5h2.1", "M12.4 8.5h2.1V12"] as const)
          : (["M1.5 12V8.5h.6", "M13.9 8.5h.6V12"] as const);
  return (
    <svg
      viewBox="0 0 16 16"
      width="18"
      height="18"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
    >
      {rails ? (
        <>
          <path data-rail d={rails[0]} />
          <path data-rail d={rails[1]} />
          <text
            x="8"
            y="11.4"
            fontSize={digits === 1 ? "10" : "8"}
            fontWeight="700"
            textAnchor="middle"
            fill="currentColor"
            stroke="none"
            {...(digits === 1 ? {} : { textLength: "9.2", lengthAdjust: "spacingAndGlyphs" })}
          >
            {numeral}
          </text>
        </>
      ) : (
        <path d="M1.5 12V8.5h13V12" />
      )}
    </svg>
  );
}

/** A barline crossing the staff. */
export function BarlineGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="18"
      height="18"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
    >
      <path d="M2 4h12M2 8h12M2 12h12" strokeWidth="1" opacity="0.45" />
      <path d="M8 2.5v11" strokeWidth="2" />
    </svg>
  );
}

/** A gap in the staff: the pause-or-hold column. */
export function SpaceGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      aria-hidden
      focusable="false"
    >
      {/* A string line interrupted -- which is exactly what the column draws. */}
      <path d="M1.5 8h4M10.5 8h4" />
      <path d="M6.2 5.5v5M9.8 5.5v5" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
