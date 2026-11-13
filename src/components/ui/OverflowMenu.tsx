"use client";

/**
 * A modal "more actions" menu: one quiet trigger that holds the actions a card should not shout.
 *
 * A native `<dialog>` opened with `showModal()`, so the page under it is inert and a tap outside only
 * closes it. Items are `menuitem`s inside a `role="menu"`.
 */

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

export interface OverflowItem {
  /** Visible words. */
  label: string;
  /** Accessible name, when it must say more than `label` (e.g. "Delete part A"). */
  ariaLabel?: string;
  icon: ReactNode;
  /** A link item navigates; an action item runs. Exactly one is given. */
  href?: string;
  onSelect?: () => unknown;
  /** Draws a divider and 8px above this item, and the danger ink. */
  destructive?: boolean;
}

const ITEM =
  "flex min-h-(--control) w-full items-center gap-2 rounded px-3 text-left text-sm hover:bg-bg-sunken focus-visible:bg-bg-sunken";

export function OverflowMenu({
  label,
  items,
  className = "",
}: {
  label: string;
  items: readonly OverflowItem[];
  className?: string;
}) {
  const id = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Counts openings. `open` alone cannot say "opened again": the previous close's event arrives a task late.
  const [opening, setOpening] = useState(0);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  // Whether the press now ending began inside the dialog. The release of the press that OPENED the
  // menu never did, so it must not run an item (same guard as `Sheet`).
  const pressBeganInside = useRef(false);
  const pressBeganOnBackdrop = useRef(false);

  const entries = () => Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);

  const closeToTrigger = () => {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    triggerRef.current?.focus();
  };

  // Place from the trigger once the menu has a size: below and right-aligned, flipped above when it would
  // pass the bottom bar, clamped 8px inside the viewport.
  useEffect(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    const dialog = dialogRef.current;
    if (!open || !trigger || !menu || !dialog) return;
    const r = trigger.getBoundingClientRect();
    const w = dialog.offsetWidth;
    const h = dialog.offsetHeight;
    const actions = document.querySelector('[data-testid="song-actions"]');
    const bottomLimit = Math.min(window.innerHeight, actions ? actions.getBoundingClientRect().top : window.innerHeight) - 8;
    let top = r.bottom + 4;
    if (top + h > bottomLimit) top = r.top - h - 4;
    top = Math.max(8, Math.min(top, bottomLimit - h));
    const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8));
    setPos({ top, left });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opening]);

  // Focus waits for the menu to be placed: a hidden element cannot take it.
  useEffect(() => {
    if (open && pos) entries()[0]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pos]);

  const openMenu = () => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    pressBeganInside.current = false;
    setPos(null);
    setOpen(true);
    setOpening((n) => n + 1);
    dialog.showModal();
  };

  const move = (to: (list: HTMLElement[], at: number) => number) => {
    const list = entries();
    if (list.length === 0) return;
    const at = list.indexOf(document.activeElement as HTMLElement);
    list[to(list, at)]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={openMenu}
        className={`no-print inline-flex min-h-(--control) min-w-(--control) items-center justify-center rounded text-text-dim hover:bg-bg-sunken hover:text-text ${className}`}
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>
      <dialog
        ref={dialogRef}
        id={id}
        aria-label={label}
        onClose={(e) => setOpen(e.currentTarget.open)}
        onCancel={(e) => {
          e.preventDefault();
          closeToTrigger();
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
          if (dismiss) closeToTrigger();
        }}
        style={{ position: "fixed", margin: 0, top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? "visible" : "hidden" }}
        className="no-print min-w-48 rounded-lg border border-border-subtle bg-bg-raised p-1 text-text shadow-lg backdrop:bg-black/30"
      >
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              move((l, at) => (at + 1) % l.length);
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              move((l, at) => (at <= 0 ? l.length - 1 : at - 1));
            } else if (e.key === "Home") {
              e.preventDefault();
              move(() => 0);
            } else if (e.key === "End") {
              e.preventDefault();
              move((l) => l.length - 1);
            } else if (e.key === "Tab") {
              e.preventDefault();
              closeToTrigger();
            }
          }}
        >
          {open
            ? items.map((item) => {
                const ink = item.destructive ? "text-danger" : "";
                const content = (
                  <>
                    {item.icon}
                    {item.label}
                  </>
                );
                const divider = item.destructive ? <hr key={`${item.label}-hr`} aria-hidden className="my-2 border-border-subtle" /> : null;
                if (item.href !== undefined) {
                  return (
                    <span key={item.label} className="contents">
                      {divider}
                      <Link
                        href={item.href}
                        role="menuitem"
                        aria-label={item.ariaLabel}
                        className={`${ITEM} ${ink}`}
                        onClick={() => dialogRef.current?.close()}
                      >
                        {content}
                      </Link>
                    </span>
                  );
                }
                return (
                  <span key={item.label} className="contents">
                    {divider}
                    <button
                      type="button"
                      role="menuitem"
                      aria-label={item.ariaLabel}
                      className={`${ITEM} ${ink}`}
                      onClick={async () => {
                        dialogRef.current?.close();
                        await item.onSelect?.();
                      }}
                    >
                      {content}
                    </button>
                  </span>
                );
              })
            : null}
        </div>
      </dialog>
    </>
  );
}
