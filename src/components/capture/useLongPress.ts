"use client";

import { useCallback, useEffect, useRef } from "react";
import type { MouseEventHandler, PointerEventHandler } from "react";

export interface LongPressOptions {
  /** Fires after `delayMs` of a press that has not moved. */
  onLongPress: () => void;
  /** Default 500. */
  delayMs?: number;
  /** Movement past this many CSS pixels cancels. Default 10. */
  moveThresholdPx?: number;
}

export interface LongPressHandlers {
  onPointerDown: PointerEventHandler;
  onPointerMove: PointerEventHandler;
  onPointerUp: PointerEventHandler;
  onPointerCancel: PointerEventHandler;
  onContextMenu: MouseEventHandler;
  /**
   * True at most once for the click that ends the press that set it, then false.
   * A keyboard-generated click (`detail === 0`) is never suppressed.
   */
  consumeSuppressedClick: (event?: { detail: number }) => boolean;
}

const CLICK_WINDOW_MS = 400;

export function useLongPress({
  onLongPress,
  delayMs = 500,
  moveThresholdPx = 10,
}: LongPressOptions): LongPressHandlers {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const suppress = useRef(false);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callback = useRef(onLongPress);
  useEffect(() => {
    callback.current = onLongPress;
  });

  const clear = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  }, []);

  /**
   * The click that ends a press arrives after pointerup -- a touch click a few
   * frames after, not on the next task -- so the flag outlives it briefly. The next
   * pointerdown resets it, and keyboard clicks are never suppressed, so the
   * window cannot swallow a later gesture.
   */
  const endPress = useCallback(() => {
    clear();
    if (expiry.current !== null) clearTimeout(expiry.current);
    expiry.current = setTimeout(() => {
      expiry.current = null;
      suppress.current = false;
    }, CLICK_WINDOW_MS);
  }, [clear]);

  useEffect(
    () => () => {
      clear();
      if (expiry.current !== null) clearTimeout(expiry.current);
    },
    [clear],
  );

  const onPointerDown: PointerEventHandler = (event) => {
    if (!event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    clear();
    if (expiry.current !== null) clearTimeout(expiry.current);
    expiry.current = null;
    suppress.current = false;
    origin.current = { x: event.clientX, y: event.clientY };
    // Touch is captured implicitly; a mouse is not, and would stop reporting
    // movement the moment it left the (narrow) column.
    try {
      event.currentTarget?.setPointerCapture?.(event.pointerId);
    } catch {
      // Capture is an enhancement; the press still works without it.
    }
    timer.current = setTimeout(() => {
      timer.current = null;
      suppress.current = true;
      callback.current();
    }, delayMs);
  };

  const onPointerMove: PointerEventHandler = (event) => {
    const start = origin.current;
    if (!start) return;
    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > moveThresholdPx) {
      clear();
      // A moved press is neither gesture: the click that may follow is dropped too.
      suppress.current = true;
    }
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endPress,
    onPointerCancel: endPress,
    onContextMenu: (event) => event.preventDefault(),
    consumeSuppressedClick: (event) => {
      const was = suppress.current;
      suppress.current = false;
      return was && event?.detail !== 0;
    },
  };
}
