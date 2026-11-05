// @vitest-environment jsdom
/**
 * INV-021: never does the preview draw other than what is written.
 * INV-024: never does one intent make two parts.
 * INV-029: never is a result silent to assistive technology, or the staff less described.
 * And the song with no tuning, which the spec says gets an offer and the preview that goes with it.
 */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PartRow, SongRow, TuningRow } from "@/lib/model";
import { presetById } from "@/lib/tunings";

const importTab = vi.fn();
vi.mock("@/lib/local/importing", () => ({
  importTab: (...args: unknown[]) => importTab(...args),
}));

import { PasteTab } from "@/components/app/PasteTab";

const preset = presetById("bass4-e")!;
const tuning = { ...preset, id: "t1", bandId: "b", name: "E Standard (Bass 4)", isDefault: true } as unknown as TuningRow;
const song = { id: "s", bandId: "b", tuningId: null } as unknown as SongRow;
const parts = [{ id: "p1", label: "A" }, { id: "p2", label: "B" }] as unknown as PartRow[];

const staff = (names: string, bodies: string[]) => bodies.map((b, i) => `${names[i]} |${b}|`).join("\n");
const FOUR = staff("GDAE", ["-5-7-", "-----", "-----", "-----"]);
const OTHER = staff("GDAE", ["-9-3-", "-----", "-----", "-----"]);
const FIVE = staff("GDAEB", ["-5-7-", "-----", "-----", "-----", "-3---"]);
const BAD = staff("GDAE", ["-5s7-", "-----", "-----", "-----"]);
const BAD_TWICE = `${BAD}\n\n${staff("GDAE", ["-57--", "-----", "-----", "-----"])}`;

function mount(over: Partial<Parameters<typeof PasteTab>[0]> = {}) {
  const onClose = vi.fn();
  const onImported = vi.fn();
  render(
    <PasteTab
      song={song}
      tuning={tuning}
      tunings={[tuning]}
      parts={parts}
      eventsByPart={{}}
      density="expanded"
      onClose={onClose}
      onImported={onImported}
      {...over}
    />,
  );
  return { onClose, onImported };
}

const box = () => screen.getByRole("textbox", { name: "Tab text" }) as HTMLTextAreaElement;
const status = () => screen.getByRole("status").textContent;

async function type(text: string) {
  await act(async () => {
    fireEvent.change(box(), { target: { value: text } });
  });
}

beforeEach(() => importTab.mockReset());
afterEach(cleanup);

describe("INV-029 every row of the Words table", () => {
  it("idle", () => {
    mount();
    expect(status()).toBe("Paste tab here.");
    expect(screen.queryByRole("button", { name: /Import|Switch/ })).toBeNull();
  });

  it("refused, one", async () => {
    mount();
    await type(BAD);
    expect(status()).toBe("Line 1 could not be read. Nothing will be imported.");
    expect(screen.queryByRole("button", { name: /Import|Switch/ })).toBeNull();
  });

  it("refused, several", async () => {
    mount();
    await type(BAD_TWICE);
    expect(status()).toBe("2 lines could not be read. Nothing will be imported.");
  });

  it("refused, no line", async () => {
    mount();
    await type("lyrics only");
    expect(status()).toBe("No tab was found in this text.");
  });

  it("ready, fits", async () => {
    mount();
    await type(FOUR);
    expect(status()).toBe("Ready to import as part C.");
    expect(screen.getByRole("button", { name: "Import as part C" })).toBeTruthy();
  });

  it("ready, offer", async () => {
    mount();
    await type(FIVE);
    expect(status()).toBe("Ready to import as part C in B Standard.");
    expect(screen.getByRole("button", { name: "Switch to B Standard and import" })).toBeTruthy();
  });

  it("a refusal fixed in the box", async () => {
    mount();
    await type(BAD);
    await type(FOUR);
    expect(status()).toBe("Ready to import as part C.");
    expect(screen.queryByTestId("paste-refusals")).toBeNull();
  });

  it("the two failure messages keep the text", async () => {
    mount();
    await type(FOUR);
    importTab.mockReturnValue(Promise.reject(new Error("no")));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Import as part C" }));
    });
    expect(status()).toBe("Could not save this part. Nothing was changed.");
    expect(box().value).toBe(FOUR);
    importTab.mockResolvedValue({ kind: "changed", reading: { kind: "idle" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Import as part C" }));
    });
    expect(status()).toBe("The song changed while this was open. Check the preview again.");
    expect(box().value).toBe(FOUR);
  });

  it("a column keeps its description, with a repeat, a technique and a chord", async () => {
    mount();
    await type(`    Am\n${staff("GDAE", ["-5h7h7~x3-", "----------", "----------", "----------"])}`);
    const labels = [...document.querySelectorAll('[data-testid="tab-column"]')].map((c) =>
      c.getAttribute("aria-label"),
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.every(Boolean)).toBe(true);
  });
});

describe("INV-024 one intent, one import", () => {
  it("double click with the write held open", async () => {
    let release!: (value: unknown) => void;
    importTab.mockReturnValue(new Promise((resolve) => (release = resolve)));
    mount();
    await type(FOUR);
    const button = screen.getByRole("button", { name: "Import as part C" });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(importTab).toHaveBeenCalledTimes(1);
    await act(async () => {
      fireEvent.click(button);
    });
    expect(importTab).toHaveBeenCalledTimes(1);
    await act(async () => release({ kind: "imported", part: { id: "new" } }));
  });

  it("a click after changed is a new intent, and is allowed", async () => {
    importTab.mockResolvedValue({ kind: "changed", reading: { kind: "idle" } });
    mount();
    await type(FOUR);
    const button = screen.getByRole("button", { name: "Import as part C" });
    await act(async () => {
      fireEvent.click(button);
    });
    await act(async () => {
      fireEvent.click(button);
    });
    expect(importTab).toHaveBeenCalledTimes(2);
  });
});

/**
 * spec.md, Accepted: "A song with no tuning at all. Nothing fits, so an exact tuning is offered if
 * labels name one." FR-029 says the preview draws, and Story 4 that it draws in the offered tuning.
 */
describe("a song with no tuning", () => {
  it("offers, and draws the preview in the offered tuning", async () => {
    mount({ tuning: undefined, tunings: [] });
    await type(FIVE);
    expect(screen.getByRole("button", { name: "Switch to B Standard and import" })).toBeTruthy();
    expect(screen.queryByTestId("tab-staff"), "FR-029: the preview is drawn").not.toBeNull();
    expect(document.body.textContent).toMatch(/Part C: 1 bar, 2 columns/);
  });
});

/**
 * The button is drawn from `deferred`, and the write is handed `text`. In the frame between them
 * the person is looking at one tab and the write gets another.
 */
describe("INV-021 what the button promises is what the write gets", () => {
  it("a tap in the frame before the deferred reading lands writes the text on screen", async () => {
    importTab.mockResolvedValue({ kind: "changed", reading: { kind: "idle" } });
    mount();
    await type(FOUR);
    const button = screen.getByRole("button", { name: "Import as part C" });
    const before = document.querySelector('[data-testid="tab-staff"]')?.textContent;

    // Out of act on purpose: a real discrete event commits, and the deferred pass waits its turn.
    const environment = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean };
    environment.IS_REACT_ACT_ENVIRONMENT = false;
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    set.call(box(), OTHER);
    box().dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    const drawn = document.querySelector('[data-testid="tab-staff"]')?.textContent;
    button.click();
    await new Promise((resolve) => setTimeout(resolve, 50));
    environment.IS_REACT_ACT_ENVIRONMENT = true;

    expect(drawn, "the preview has not moved yet").toBe(before);
    expect(importTab).toHaveBeenCalledTimes(1);
    expect(importTab.mock.calls[0][1], "the write gets what the preview drew").toBe(FOUR);
  });
});

