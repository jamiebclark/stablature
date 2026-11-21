// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { browserCapability, recordAvailability } from "../capability";

/** INV-020: the Record item says why it can't, in a fixed order, and "insecure" wins over a missing microphone API. */
const ok = { secure: true, microphone: true, recorder: true, busy: false };

describe("recordAvailability", () => {
  it("ok", () => expect(recordAvailability(ok)).toBe("ok"));
  it("insecure", () => expect(recordAvailability({ ...ok, secure: false })).toBe("insecure"));
  it("insecure and no mediaDevices is insecure", () =>
    expect(recordAvailability({ ...ok, secure: false, microphone: false })).toBe("insecure"));
  it("no-microphone", () => expect(recordAvailability({ ...ok, microphone: false })).toBe("no-microphone"));
  it("no-recorder", () => expect(recordAvailability({ ...ok, recorder: false })).toBe("no-recorder"));
  it("busy", () => expect(recordAvailability({ ...ok, busy: true })).toBe("busy"));
  it("no-recorder beats busy", () => expect(recordAvailability({ ...ok, recorder: false, busy: true })).toBe("no-recorder"));
});

describe("browserCapability", () => {
  const w = window as unknown as { isSecureContext: boolean; MediaRecorder?: unknown };
  const had = Object.getOwnPropertyDescriptor(window, "isSecureContext");
  afterEach(() => {
    if (had) Object.defineProperty(window, "isSecureContext", had);
    delete w.MediaRecorder;
  });
  it("reads the page: no mediaDevices on an insecure page", () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });
    const c = browserCapability();
    expect(c.secure).toBe(false);
    expect(c.microphone).toBe(false);
    expect(c.recorder).toBe(false);
  });
  it("sees a MediaRecorder", () => {
    w.MediaRecorder = class {};
    expect(browserCapability().recorder).toBe(true);
  });
});
