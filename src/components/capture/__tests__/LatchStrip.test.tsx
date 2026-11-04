// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Latch, LatchId } from "@/lib/capture/latches";
import type { CursorTarget } from "@/lib/capture/target";
import { LatchStrip } from "../LatchStrip";

const target: CursorTarget = {
  kind: "playable",
  event: {
    id: "e1",
    bandId: "band-1",
    partId: "part-1",
    rank: "a",
    kind: "notes",
    frets: {},
    techniques: {},
    repeat: 1,
    durationHint: null,
    tupletId: null,
    tupletCount: null,
    updatedAt: "",
    deletedAt: null,
    fieldClocks: {},
    serverSeq: 0,
  },
};

function makeLatches(count: number): readonly Latch[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `latch-${i}` as LatchId,
    label: `l${i}`,
    ariaLabel: `latch ${i}`,
    title: `latch ${i} title`,
    scope: "next-note",
    statusText: `latch ${i} armed`,
  }));
}

describe("LatchStrip", () => {
  it("renders one cell per latch, with a byte-identical container class across sizes", () => {
    const one = render(
      <LatchStrip
        latches={makeLatches(1)}
        lit={new Set()}
        target={target}
        onToggle={() => {}}
      />,
    );
    const oneContainer = one.container.firstElementChild as HTMLElement;
    expect(one.container.querySelectorAll("button")).toHaveLength(1);
    const oneClassName = oneContainer.className;

    const five = render(
      <LatchStrip
        latches={makeLatches(5)}
        lit={new Set()}
        target={target}
        onToggle={() => {}}
      />,
    );
    const fiveContainer = five.container.firstElementChild as HTMLElement;
    expect(five.container.querySelectorAll("button")).toHaveLength(5);
    expect(fiveContainer.className).toBe(oneClassName);
  });

  it("differs per cell only in the armed/applicable modifier", () => {
    const latches = makeLatches(3);
    const { container } = render(
      <LatchStrip
        latches={latches}
        lit={new Set([latches[1].id])}
        target={target}
        onToggle={() => {}}
      />,
    );
    const buttons = Array.from(container.querySelectorAll("button"));
    expect(buttons).toHaveLength(3);
    expect(buttons[1].getAttribute("aria-pressed")).toBe("true");
    expect(buttons[0].getAttribute("aria-pressed")).toBe("false");
    expect(buttons[2].getAttribute("aria-pressed")).toBe("false");
  });

  it("contains no id-branching in its source", () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, "../LatchStrip.tsx"),
      "utf-8",
    );
    expect(source).not.toMatch(/id\s*===/);
    expect(source).not.toMatch(/switch\s*\(\s*id\s*\)/);
  });
});

describe("LatchStrip layout (INV-015)", () => {
  const barline: CursorTarget = {
    kind: "barline",
    event: { ...(target as { event: object }).event, kind: "barline" } as never,
  };
  const strip = (n: number, lit: string[] = [], at: CursorTarget = target) =>
    render(
      <LatchStrip
        latches={makeLatches(n)}
        lit={new Set(lit as LatchId[])}
        target={at}
        onToggle={() => {}}
      />,
    );

  it("1 vs 5 latches: same container class and style, identical cell classes", () => {
    const one = strip(1);
    const oneBox = one.getByTestId("latch-strip");
    const oneCell = oneBox.querySelector("button")!.className;
    const oneStyle = oneBox.getAttribute("style");
    one.unmount();

    const five = strip(5);
    const fiveBox = five.getByTestId("latch-strip");
    const cells = [...fiveBox.querySelectorAll("button")];
    expect(cells).toHaveLength(5);
    expect(fiveBox.className).toBe(oneBox.className);
    expect(fiveBox.getAttribute("style")).toBe(oneStyle);
    for (const c of cells) expect(c.className).toBe(oneCell);
  });

  it("an armed cell differs only by the armed modifier; an inapplicable cell stays in place", () => {
    const r = strip(5, ["latch-2"]);
    const cells = [...r.getByTestId("latch-strip").querySelectorAll("button")];
    const base = cells[0].className.split(/\s+/);
    const armed = cells[2].className.split(/\s+/);
    expect(armed.filter((c) => !base.includes(c)).sort()).toEqual(["bg-accent", "border-accent", "text-accent-text"]);
    expect(base.filter((c) => !armed.includes(c)).sort()).toEqual(
      ["bg-bg-raised", "border-border-subtle", "text-text"].sort(),
    );
    r.unmount();

    const dead = strip(5, [], barline);
    const deadCells = [...dead.getByTestId("latch-strip").querySelectorAll("button")];
    expect(deadCells).toHaveLength(5);
    for (const c of deadCells) expect(c.disabled).toBe(true);
  });
});

describe("LatchStrip with the real transition chips (INV-025)", () => {
  it("renders every declared latch, glyph chips in mono, without reading ids", async () => {
    const { LATCHES } = await import("@/lib/capture/latches");
    const r = render(
      <LatchStrip latches={LATCHES} lit={new Set(["hammer_on"] as LatchId[])} target={target} onToggle={() => {}} />,
    );
    const cells = [...r.getByTestId("latch-strip").querySelectorAll("button")];
    expect(cells).toHaveLength(5);
    expect(cells.map((c) => c.textContent)).toEqual(["stack", "h", "p", "/", "\\"]);
    expect(cells[1].getAttribute("aria-pressed")).toBe("true");
    expect(cells[1].className).toContain("font-mono");
    expect(cells[0].className).not.toContain("font-mono");
  });
});
