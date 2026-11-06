"use client";

import { useEffect, useRef } from "react";
import type { ActionId, Screen } from "@/lib/keys/shortcuts";

/** An action returns false to say it did nothing, so the key keeps its default. */
export type KeyAction = (event: KeyboardEvent) => void | boolean;
export type ScreenActions = Partial<Record<ActionId, KeyAction>>;

interface Registration {
  readonly screen: Screen;
  readonly actions: { current: ScreenActions };
}

const registry = new Set<Registration>();

/**
 * A screen registers what its shortcuts do. Actions are read through a ref, so a new render never
 * rebinds anything. An action a screen has not registered does nothing.
 */
export function useScreenKeys(screen: Screen, actions: ScreenActions): void {
  const ref = useRef<ScreenActions>(actions);
  useEffect(() => {
    ref.current = actions;
  });
  useEffect(() => {
    const entry: Registration = { screen, actions: ref };
    registry.add(entry);
    return () => {
      registry.delete(entry);
    };
  }, [screen]);
}

/** Runs the registered action for this screen; true when one ran and did not decline. */
export function runScreenAction(id: ActionId, screen: Screen, event: KeyboardEvent): boolean {
  for (const entry of registry) {
    if (entry.screen !== screen) continue;
    const action = entry.actions.current[id];
    if (action && action(event) !== false) return true;
  }
  return false;
}

export const OPEN_HELP_EVENT = "stablature:open-help";
