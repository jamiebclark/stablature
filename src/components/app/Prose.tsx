import type { ReactNode } from "react";

/**
 * Shared shell for the written pages.
 *
 * Narrower than the app's 3xl, because prose read at a full desktop width is
 * unpleasant and these are the only pages anyone reads rather than scans.
 */
export function Prose({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-prose px-4 py-10">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-xs text-text-faint">Last updated {updated}</p>
      <div className="mt-6 space-y-5 text-sm leading-relaxed text-text-dim [&_h2]:mt-8 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:uppercase [&_h2]:tracking-wide [&_h2]:text-text [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-text [&_ul]:space-y-1.5">
        {children}
      </div>
    </main>
  );
}
