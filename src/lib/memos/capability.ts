/** Whether "Record memo" can work here, and if not, why (contracts/memo-ui.md §1, §5). */

import type { Availability } from "./words";

export interface Capability {
  secure: boolean;
  microphone: boolean;
  recorder: boolean;
  busy: boolean;
}

/** The order is the contract: an insecure page has no `mediaDevices` either, and the address is the cause to name. */
export function recordAvailability(c: Capability): "ok" | Availability {
  if (!c.secure) return "insecure";
  if (!c.microphone) return "no-microphone";
  if (!c.recorder) return "no-recorder";
  if (c.busy) return "busy";
  return "ok";
}

/** What this page can do, read fresh each call (a test may delete `MediaRecorder` before load). */
export function browserCapability(busy = false): Capability {
  return {
    secure: typeof window !== "undefined" && window.isSecureContext === true,
    microphone: typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function",
    recorder: typeof MediaRecorder !== "undefined",
    busy,
  };
}
