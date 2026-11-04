// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLongPress } from "../useLongPress";

const ev = (o: Record<string, unknown> = {}) =>
  ({ isPrimary: true, button: 0, pointerType: "touch", clientX: 0, clientY: 0, ...o }) as never;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useLongPress", () => {
  it("fires once after 500ms and suppresses exactly one click", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => result.current.onPointerDown(ev()));
    act(() => void vi.advanceTimersByTime(499));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    act(() => void vi.advanceTimersByTime(2000));
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(result.current.consumeSuppressedClick()).toBe(true);
    expect(result.current.consumeSuppressedClick()).toBe(false);
  });

  it("is cancelled by movement past 10px", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => result.current.onPointerDown(ev()));
    act(() => result.current.onPointerMove(ev({ clientX: 11 })));
    act(() => void vi.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();
    // A moved press is neither gesture: its click is dropped too (FR-020).
    expect(result.current.consumeSuppressedClick()).toBe(true);
    expect(result.current.consumeSuppressedClick()).toBe(false);
  });

  it("tolerates movement within the threshold", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => result.current.onPointerDown(ev()));
    act(() => result.current.onPointerMove(ev({ clientX: 5 })));
    act(() => void vi.advanceTimersByTime(500));
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it.each(["onPointerUp", "onPointerCancel"] as const)("is cancelled by %s", (name) => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => result.current.onPointerDown(ev()));
    act(() => result.current[name](ev()));
    act(() => void vi.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("is cancelled on unmount", () => {
    const onLongPress = vi.fn();
    const { result, unmount } = renderHook(() => useLongPress({ onLongPress }));
    act(() => result.current.onPointerDown(ev()));
    unmount();
    act(() => void vi.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("only a primary contact (and primary mouse button) starts a press", () => {
    const onLongPress = vi.fn();
    const { result } = renderHook(() => useLongPress({ onLongPress }));
    act(() => result.current.onPointerDown(ev({ isPrimary: false })));
    act(() => result.current.onPointerDown(ev({ pointerType: "mouse", button: 2 })));
    act(() => void vi.advanceTimersByTime(1000));
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => result.current.onPointerDown(ev({ pointerType: "mouse", button: 0 })));
    act(() => void vi.advanceTimersByTime(500));
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("drops its click suppression when the press ends with no click reaching the column", () => {
    const { result } = renderHook(() => useLongPress({ onLongPress: vi.fn() }));
    act(() => result.current.onPointerDown(ev()));
    act(() => void vi.advanceTimersByTime(500));
    act(() => result.current.onPointerUp(ev()));
    // The click that ends the press would arrive within the window; none did.
    act(() => void vi.advanceTimersByTime(400));
    expect(result.current.consumeSuppressedClick({ detail: 1 })).toBe(false);
  });

  it("still suppresses the click that ends the press, before the next task", () => {
    const { result } = renderHook(() => useLongPress({ onLongPress: vi.fn() }));
    act(() => result.current.onPointerDown(ev()));
    act(() => void vi.advanceTimersByTime(500));
    act(() => result.current.onPointerUp(ev()));
    expect(result.current.consumeSuppressedClick({ detail: 1 })).toBe(true);
  });

  it("never suppresses a keyboard-generated click (detail 0)", () => {
    const { result } = renderHook(() => useLongPress({ onLongPress: vi.fn() }));
    act(() => result.current.onPointerDown(ev()));
    act(() => void vi.advanceTimersByTime(500));
    expect(result.current.consumeSuppressedClick({ detail: 0 })).toBe(false);
  });
});
