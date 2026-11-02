/**
 * The mark: three strings and a note.
 *
 * The same idea as the app icon, dropped from five strings to three. At the
 * 18px a header gives it, five lines close up into a grey block — the mark has
 * to survive being small far more often than it has to be literal about a
 * bass having five strings.
 *
 * Deliberately not a guitar, a pick, or a music note. The app is about
 * tablature, and a staff with something on it is what tablature looks like
 * from across a room.
 */

export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden
      focusable="false"
      className="shrink-0"
    >
      <path
        d="M1.5 4.5h15M1.5 9h15M1.5 13.5h15"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* The note masks the string behind it, exactly as a fret number does. */}
      <rect x="7" y="6.6" width="5" height="4.8" rx="1" fill="var(--accent)" />
    </svg>
  );
}

/** Mark plus name, for the header and anywhere the app introduces itself. */
export function Logo({ size = 18 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <LogoMark size={size} />
      <span className="font-mono font-semibold tracking-tight">stablature</span>
    </span>
  );
}
