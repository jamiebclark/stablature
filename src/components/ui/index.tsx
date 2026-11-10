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
import { usePanel } from "@/components/reading/usePanel";
import type { PanelId } from "@/lib/reading/panels";
import { useKeyboardInset } from "./useKeyboardInset";

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
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap min-h-(--control) rounded-md px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";

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

/**
 * A button's words, shown beside its icon for a mouse and kept for screen readers only on touch, where a
 * row of labelled buttons wraps and the icon says enough. The button wants `min-w-(--control)` so that,
 * icon alone, it is still a square target.
 */
export function TouchLabel({ children }: { children: ReactNode }) {
  return <span className="sr-only fine:not-sr-only">{children}</span>;
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={`w-full min-h-(--control) rounded-md border border-border-subtle bg-bg-raised px-3 text-text placeholder:text-text-faint focus:border-accent focus:outline-none ${className}`}
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
  touchBar = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
  /** The actions also live in a bar at the foot of the page on touch, so the header shows them on a fine pointer only. */
  touchBar?: boolean;
}) {
  return (
    <header className="mb-3">
      <div className="flex items-center gap-2">
        {back ? (
          <Link
            href={back.href}
            className="inline-flex min-h-(--control) min-w-(--control) shrink-0 items-center justify-center gap-1 px-2 text-xs text-text-dim hover:text-accent no-print"
          >
            <ArrowLeft size={14} aria-hidden />
            {back.label}
          </Link>
        ) : null}
        <h1 className="line-clamp-2 min-w-0 flex-1 text-xl font-semibold tracking-tight">{title}</h1>
        {actions ? (
          <div className={`shrink-0 gap-2 no-print ${touchBar ? "hidden fine:flex" : "flex"}`}>{actions}</div>
        ) : null}
      </div>
      {subtitle ? <p className="mt-0.5 text-sm text-text-dim">{subtitle}</p> : null}
    </header>
  );
}

/**
 * A collapsible group of controls. The body stays mounted (`hidden`, not removed) so what is inside keeps
 * its state and stays findable. Open or closed is remembered on this device.
 */
export function Panel({
  id,
  label,
  className = "",
  children,
}: {
  id: PanelId;
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = usePanel(id);
  return (
    <div className={`no-print ${className}`}>
      <button
        type="button"
        data-testid={`panel-${id}`}
        aria-expanded={open}
        aria-controls={`panel-${id}-body`}
        onClick={() => setOpen(!open)}
        className="inline-flex min-h-(--control) w-full items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-raised px-3 text-sm font-medium text-text"
      >
        {label}
        <span aria-hidden className="text-text-dim">
          {open ? "−" : "+"}
        </span>
      </button>
      <div id={`panel-${id}-body`} data-testid={`panel-${id}-body`} hidden={!open} className="mt-2">
        {children}
      </div>
    </div>
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
  useKeyboardInset(open);
  // Whether the press now ending began on the backdrop. The click that finishes
  // the press which OPENED the sheet (a long press) never did, so it must not dismiss.
  const pressBeganOnBackdrop = useRef(false);
  // Whether a press began anywhere inside the dialog. A pointer click whose press
  // began elsewhere (a long press on the staff, released over a control the
  // sheet opened under the finger) is not a tap on that control.
  const pressBeganInside = useRef(false);
  // Whether the dialog's next `close` event is one this component caused by
  // following `open`. That event arrives a task later, so if `open` went true
  // again in between, passing it on would close the sheet just reopened.
  const closedByProp = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // A press record from an earlier opening must not license this one's release.
      pressBeganInside.current = false;
      dialog.showModal();
    } else if (!open && dialog.open) {
      closedByProp.current = true;
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClose={() => {
        if (closedByProp.current) {
          closedByProp.current = false;
          return;
        }
        onClose();
      }}
      onPointerCancel={() => {
        pressBeganInside.current = false;
      }}
      onPointerDown={(e) => {
        pressBeganInside.current = true;
        pressBeganOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClickCapture={(e) => {
        const stray = e.detail !== 0 && !pressBeganInside.current;
        pressBeganInside.current = false;
        if (stray) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onClick={(e) => {
        const dismiss = pressBeganOnBackdrop.current && e.target === e.currentTarget;
        pressBeganOnBackdrop.current = false;
        if (dismiss) e.currentTarget.close();
      }}
      style={{ marginBottom: "var(--kb-inset, 0px)", maxHeight: "calc(100dvh - var(--kb-inset, 0px))", paddingBottom: "var(--safe-bottom)", paddingLeft: "var(--safe-left)", paddingRight: "var(--safe-right)" }}
      className="m-0 mt-auto w-full max-w-none overflow-y-auto overscroll-contain rounded-t-xl border border-border-subtle bg-bg p-0 text-text backdrop:bg-black/50"
    >
      {open ? children : null}
    </dialog>
  );
}
