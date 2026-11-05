/**
 * One plain sentence under a variant's staff: what it changed against its parent. Text only -- no link,
 * no button, no handler -- so nothing about it can be tapped by accident.
 */
export function VariantLine({ text }: { text: string }) {
  return (
    <p data-testid="variant-line" className="mt-1 text-xs text-text-dim">
      {text}
    </p>
  );
}
