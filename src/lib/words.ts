/** The band list's count line (spec 008 FR-022). */
export function songCountWords(n: number): string {
  if (n === 0) return "No songs yet";
  return n === 1 ? "1 song" : `${n} songs`;
}
