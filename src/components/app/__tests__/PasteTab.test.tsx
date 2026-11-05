// @vitest-environment jsdom
/** INV-024 (UI half) and INV-029 (jsdom half, idle and ready states). */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventRow, PartRow, SongRow, TuningRow } from "@/lib/model";
import { toAscii } from "@/lib/tab/ascii";
import { ev } from "@/lib/tab/__tests__/helpers";
import { presetById } from "@/lib/tunings";

const importTab = vi.fn();
// vi.fn tracks a rejecting result with a promise of its own, which the runner reports as unhandled.
let rejectWith: Error | null = null;
vi.mock("@/lib/local/importing", () => ({
  importTab: (...args: unknown[]) => {
    const result = importTab(...args);
    return rejectWith ? Promise.reject(rejectWith) : result;
  },
}));

import { PasteTab } from "../PasteTab";

const preset = presetById("bass4-e")!;
const tuning = { ...preset, id: "t1", bandId: "b", isDefault: true } as unknown as TuningRow;
const song = { id: "s", bandId: "b", tuningId: null } as unknown as SongRow;
const parts = [{ id: "p1", label: "A" }, { id: "p2", label: "B" }] as unknown as PartRow[];

const events: EventRow[] = [ev({ "2": 5 }), ev({ "3": 7 })];
const TAB = toAscii({ events, tuning, density: "expanded" });

function mount() {
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
    />,
  );
  return { onClose, onImported };
}

async function type(text: string) {
  await act(async () => {
    fireEvent.change(screen.getByRole("textbox", { name: "Tab text" }), { target: { value: text } });
  });
}

describe("PasteTab", () => {
  beforeEach(() => {
    importTab.mockReset();
    rejectWith = null;
  });

  it("idle: named box, one sentence, no import button", () => {
    mount();
    expect(screen.getByRole("textbox", { name: "Tab text" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Paste tab here.");
    expect(screen.queryByRole("button", { name: /Import/ })).toBeNull();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeTruthy();
  });

  it("ready: says which part and offers the import", async () => {
    mount();
    await type(TAB);
    expect(screen.getByRole("status").textContent).toBe("Ready to import as part C.");
    expect(screen.getByRole("button", { name: "Import as part C" })).toBeTruthy();
    expect(document.querySelectorAll("[aria-label]").length).toBeGreaterThan(1);
  });

  it("two synchronous clicks with the write held open make one call", async () => {
    let release!: (value: unknown) => void;
    importTab.mockReturnValue(new Promise((resolve) => (release = resolve)));
    const { onClose, onImported } = mount();
    await type(TAB);
    const button = screen.getByRole("button", { name: "Import as part C" });
    await act(async () => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(importTab).toHaveBeenCalledTimes(1);
    await act(async () => release({ kind: "imported", part: { id: "new" } }));
    expect(onClose).toHaveBeenCalled();
    expect(onImported).toHaveBeenCalledWith("new");
  });

  it("a rejected write keeps the text and says nothing changed", async () => {
    rejectWith = new Error("no");
    mount();
    await type(TAB);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Import as part C" }));
    });
    expect(screen.getByRole("status").textContent).toBe(
      "Could not save this part. Nothing was changed.",
    );
    expect((screen.getByRole("textbox", { name: "Tab text" }) as HTMLTextAreaElement).value).toBe(TAB);
  });
});
