"use client";

/**
 * Small shared primitives.
 *
 * Deliberately thin -- enough to keep button and input styling in one place
 * without a component library this app does not need.
 */

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-text hover:brightness-110",
  secondary: "bg-bg-raised text-text border border-border-subtle hover:border-border-strong",
  ghost: "text-text-dim hover:text-text hover:bg-bg-raised",
  danger: "text-danger hover:bg-danger/10",
};

const BASE =
  // whitespace-nowrap because these sit in tight flex rows next to inputs, and
  // a wrapped label ("Add" over "band") reads as a layout bug.
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`w-full rounded-md border border-border-subtle bg-bg-raised px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none ${className}`}
      {...props}
    />
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`rounded-lg border border-border-subtle bg-bg-raised p-4 print-keep ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="mb-1 inline-flex items-center gap-1 text-xs text-text-dim hover:text-accent no-print"
          >
            <ArrowLeft size={13} aria-hidden />
            {back.label}
          </Link>
        ) : null}
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-text-dim">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2 no-print">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border-subtle p-8 text-center">
      <p className="text-sm font-medium text-text-dim">{title}</p>
      {children ? <div className="mt-3 flex justify-center gap-2">{children}</div> : null}
    </div>
  );
}

/** Shown while a Dexie query has not resolved yet (its value is undefined). */
export function Loading({ label = "Loading" }: { label?: string }) {
  return <p className="py-8 text-center text-sm text-text-faint">{label}&hellip;</p>;
}

/**
 * A modal bottom sheet on a native `<dialog>`. `onClose` fires for the `close`
 * event, so Esc, the backdrop and a programmatic close share one callback.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Whether the press now ending began on the backdrop. The click that finishes
  // the press which OPENED the sheet (a long press) never did, so it must not dismiss.
  const pressBeganOnBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={onClose}
      onPointerDown={(e) => {
        pressBeganOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        const dismiss = pressBeganOnBackdrop.current && e.target === e.currentTarget;
        pressBeganOnBackdrop.current = false;
        if (dismiss) e.currentTarget.close();
      }}
      className="m-0 mt-auto w-full max-w-none rounded-t-xl border border-border-subtle bg-bg p-0 text-text backdrop:bg-black/50"
    >
      {open ? children : null}
    </dialog>
  );
}
