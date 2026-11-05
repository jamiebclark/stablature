// @vitest-environment jsdom
/** INV-033/INV-036: marks and the variant line are plain, non-interactive, and absent for a Same variant. */
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TabStaff } from "@/components/tab/TabStaff";
import { VariantLine } from "@/components/reading/VariantLine";
import { compareParts } from "@/lib/reading/compare";
import { staffMarks } from "@/lib/reading/marks";
import { barline, bass5, ev } from "@/lib/tab/__tests__/helpers";
import type { PartRow } from "@/lib/model";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { type AnnotationRow, type EventRow } from "@/lib/model";
import { type StaffView } from "@/lib/reading/view";
import { type Density } from "@/lib/tab/layout";
import { space } from "@/lib/tab/__tests__/helpers";

const A = 2;
const parentEvents = [ev({ [A]: 5 }), ev({ [A]: 7 }), barline(), ev({ [A]: 3 })];
const parent = { id: "a", label: "A" } as PartRow;
const strings = bass5.strings.length;

function draw(variant: typeof parentEvents, interactive = false) {
  const comparison = compareParts(
    { part: parent, events: parentEvents, annotations: [] },
    { part: { id: "b", label: "B" } as PartRow, events: variant, annotations: [] },
    strings,
  );
  const marks = staffMarks(comparison, { events: variant, fromBar: null, toBar: null, density: "expanded" });
  const view = render(
    <>
      <TabStaff
        events={variant}
        tuning={bass5}
        reading={{ view: "frets", partEvents: variant, marks }}
        onSelectColumn={interactive ? () => {} : undefined}
      />
      <VariantLine text={marks.line} />
    </>,
  );
  return { marks, view };
}

describe("marks", () => {
  it("are not interactive", () => {
    const changed = [ev({ [A]: 5 }), ev({ [A]: 9 }), barline()];
    const { view } = draw(changed);
    const c = view.container;
    for (const id of ["tab-diff", "tab-removal", "variant-line"]) {
      for (const el of c.querySelectorAll(`[data-testid="${id}"]`)) {
        expect(el.querySelector('a, button, [tabindex], [role="button"]')).toBeNull();
        expect(el.closest("a, button")).toBeNull();
      }
    }
    expect(c.querySelectorAll('[data-testid="tab-column"]')[1].getAttribute("role")).toBe("img");
    expect(c.querySelectorAll('[data-diff="changed"]').length).toBe(1);
    expect(c.querySelectorAll('[data-testid="tab-removal"]').length).toBe(1);
    expect(c.querySelector('[data-testid="tab-removal"]')!.getAttribute("aria-label")).toBe(
      "1 column removed from A here",
    );
    expect(c.querySelector('[data-testid="tab-removal"]')!.textContent).toContain("−1");
    expect(c.querySelector('[data-diff="changed"]')!.getAttribute("aria-label")).toContain(
      "Changed from A: fret 7 to fret 9 on string 3",
    );
  });

  it("leave a Same variant exactly as the staff without a comparison", () => {
    const same = parentEvents.map((e) => ({ ...e }));
    const { view, marks } = draw(same);
    const plain = render(<TabStaff events={same} tuning={bass5} reading={{ view: "frets", partEvents: same }} />);
    expect(marks.any).toBe(false);
    const staff = view.container.querySelector('[data-testid="tab-staff"]')!.outerHTML;
    expect(staff).toBe(plain.container.querySelector('[data-testid="tab-staff"]')!.outerHTML);
    expect(view.container.querySelector('[data-testid="variant-line"]')!.textContent).toBe("Same as A");
  });
});

describe("INV-036 a removal inside a group carries the group's line (review F3)", () => {
  const grouped = (fret: number, over: Partial<ReturnType<typeof ev>> = {}) =>
    ev({ [A]: fret }, {}, { tupletId: "g", tupletCount: 3, groupKind: "tuplet", ...over });
  const gapOf = (parentEvents: ReturnType<typeof ev>[], variant: ReturnType<typeof ev>[]) => {
    const comparison = compareParts(
      { part: parent, events: parentEvents, annotations: [] },
      { part: { id: "b", label: "B" } as PartRow, events: variant, annotations: [] },
      strings,
    );
    const marks = staffMarks(comparison, { events: variant, fromBar: null, toBar: null, density: "expanded" });
    const { container } = render(<TabStaff events={variant} tuning={bass5} reading={{ view: "frets", partEvents: variant, marks }} />);
    return container.querySelector('[data-testid="tab-removal"]')!;
  };

  it("draws the bracket in a gap inside a group", () => {
    const gap = gapOf([grouped(1), grouped(2), grouped(3)], [grouped(1), grouped(3)]);
    expect(gap).not.toBeNull();
    expect(gap.querySelectorAll('[class~="tab-bracket"]').length).toBe(1);
  });
  it("draws it when a connector also sits in that gap", () => {
    const gap = gapOf(
      [grouped(1), grouped(2), grouped(3)],
      [grouped(1), ev({ [A]: 3 }, { [A]: ["hammer_on"] }, { tupletId: "g", tupletCount: 3, groupKind: "tuplet" })],
    );
    expect(gap).not.toBeNull();
    expect(gap.querySelectorAll('[class~="tab-bracket"]').length).toBe(1);
  });
});

describe("review probe INV-016-033-035-036-staff.test.tsx", { timeout: 300_000 }, () => {
  afterEach(cleanup);
  
  const A = 2;
  const strings = bass5.strings.length;
  const P = { id: "a", label: "A" } as PartRow;
  const V = { id: "b", label: "B" } as PartRow;
  const grouped = (fret: number, tupletId = "g", tupletCount: number | null = 3) =>
    ev({ [A]: fret }, {}, { tupletId, tupletCount, groupKind: "tuplet" });
  
  function draw(
    parent: EventRow[], variant: EventRow[],
    opts: { view?: StaffView; density?: Density; parentNotes?: AnnotationRow[]; notes?: AnnotationRow[]; showRhythm?: boolean } = {},
  ) {
    const density = opts.density ?? "expanded";
    const comparison = compareParts(
      { part: P, events: parent, annotations: opts.parentNotes ?? [] },
      { part: V, events: variant, annotations: opts.notes ?? [] },
      strings,
    );
    const marks = staffMarks(comparison, { events: variant, fromBar: null, toBar: null, density });
    const { container } = render(
      <TabStaff
        events={variant}
        tuning={bass5}
        annotations={opts.notes ?? []}
        density={density}
        showRhythm={opts.showRhythm}
        surface="raised"
        reading={{ view: opts.view ?? "frets", partEvents: variant, marks }}
      />,
    );
    return { container, marks };
  }
  const q = (c: Element, id: string) => [...c.querySelectorAll(`[data-testid="${id}"]`)];
  const ariaOfMarked = (c: Element) => c.querySelector("[data-diff]")?.getAttribute("aria-label");
  const chord = (anchorEventId: string, value: string) => ({ id: `n-${value}`, kind: "chord", anchorEventId, value }) as AnnotationRow;
  
  describe("INV-035 the words table, exactly, through the staff", () => {
    const before = () => ev({ [A]: 5 });
    const one = (variant: EventRow, parent: EventRow = before(), extra: Parameters<typeof draw>[2] = {}) =>
      ariaOfMarked(draw([parent, ev({ [A]: 9 })], [variant, ev({ [A]: 9 })], extra).container);
  
    it("fret to fret", () => expect(one(ev({ [A]: 7 }))).toBe("string 3 fret 7. Changed from A: fret 5 to fret 7 on string 3"));
    it("fret added", () => expect(one(ev({ [A]: 5, 1: 7 }))).toBe("string 2 fret 7, string 3 fret 5. Changed from A: fret 7 added on string 2"));
    it("fret removed", () => expect(one(ev({ [A]: 5 }), ev({ [A]: 5, 1: 7 }))).toBe("string 3 fret 5. Changed from A: fret 7 removed on string 2"));
    it("to a dead note", () => expect(one(ev({ [A]: "x" }))).toBe("string 3 fret x. Changed from A: fret 5 to fret x on string 3"));
    it("rest to notes", () => expect(one(ev({ [A]: 5 }), space())).toContain("Changed from A: rest to notes, fret 5 added on string 3"));
    it("notes to rest", () => expect(one(space())).toContain("Changed from A: notes to rest, fret 5 removed on string 3"));
    it("technique added", () => expect(one(ev({ [A]: 5 }, { [A]: ["bend"] }))).toContain("Changed from A: bend added on string 3"));
    it("technique removed", () => expect(one(ev({ [A]: 5 }), ev({ [A]: 5 }, { [A]: ["palm_mute"] }))).toContain("Changed from A: palm mute removed on string 3"));
    it("a transition's own words", () => expect(one(ev({ [A]: 5 }, { [A]: ["hammer_on"] }))).toContain("Changed from A: hammer-on added on string 3"));
    it("a technique in neither table reads by its id", () => expect(one(ev({ [A]: 5 }, { [A]: ["growl" as never] }))).toContain("Changed from A: growl added on string 3"));
    it("duration set", () => expect(one(ev({ [A]: 5 }, {}, { durationHint: "q" }))).toContain("Changed from A: duration unset to quarter"));
    it("duration changed", () => expect(one(ev({ [A]: 5 }, {}, { durationHint: "8" }), ev({ [A]: 5 }, {}, { durationHint: "q" }))).toContain("Changed from A: duration quarter to eighth"));
    it("duration cleared", () => expect(one(ev({ [A]: 5 }), ev({ [A]: 5 }, {}, { durationHint: "32" }))).toContain("Changed from A: duration thirty-second to unset"));
    it("an unknown duration by its raw value", () => expect(one(ev({ [A]: 5 }, {}, { durationHint: "64" as never }))).toContain("Changed from A: duration unset to 64"));
    it("joined a group", () => expect(one(grouped(5))).toContain("Changed from A: group changed"));
    it("left a group", () => expect(one(ev({ [A]: 5 }), grouped(5))).toContain("Changed from A: group changed"));
    it("group number", () => expect(one(grouped(5, "g", 5), grouped(5, "h", 3))).toContain("Changed from A: group changed"));
    it("chord added", () => {
      const v = ev({ [A]: 5 });
      expect(one(v, before(), { notes: [chord(v.id, "C")] })).toContain("Changed from A: chord C added");
    });
    it("chord changed", () => {
      const v = ev({ [A]: 5 });
      const p = ev({ [A]: 5 });
      expect(one(v, p, { notes: [chord(v.id, "C")], parentNotes: [chord(p.id, "Am")] })).toContain("Changed from A: chord Am to C");
    });
    it("chord removed", () => {
      const p = ev({ [A]: 5 });
      expect(one(ev({ [A]: 5 }), p, { parentNotes: [chord(p.id, "Am")] })).toContain("Changed from A: chord Am removed");
    });
    it("added", () => {
      const { container } = draw([ev({ [A]: 5 })], [ev({ [A]: 5 }), ev({ [A]: 7 })]);
      expect(ariaOfMarked(container)).toBe("string 3 fret 7. Added, not in A");
    });
    it("in view words, the description keeps saying the fret and adds the mark", () => {
      const { container } = draw([ev({ [A]: 5 })], [ev({ [A]: 7 })], { view: "notes" });
      expect(ariaOfMarked(container)).toBe("string 3 fret 7 shown as E. Changed from A: fret 5 to fret 7 on string 3");
    });
    it("a gap of 1 and of 2", () => {
      const one1 = draw([ev({ [A]: 1 }), ev({ [A]: 2 }), ev({ [A]: 3 })], [ev({ [A]: 1 }), ev({ [A]: 3 })]).container;
      expect(q(one1, "tab-removal")[0].getAttribute("aria-label")).toBe("1 column removed from A here");
      expect(q(one1, "tab-removal")[0].textContent).toBe("−1");
      cleanup();
      const two = draw([ev({ [A]: 1 }), ev({ [A]: 2 }), ev({ [A]: 4 }), ev({ [A]: 3 })], [ev({ [A]: 1 }), ev({ [A]: 3 })]).container;
      expect(q(two, "tab-removal")[0].getAttribute("aria-label")).toBe("2 columns removed from A here");
      expect(q(two, "tab-removal")[0].textContent).toBe("−2");
    });
    it("compact with some repetitions marked", () => {
      const parent = [ev({ [A]: 7 }, {}, { repeat: 8 })];
      const variant = [ev({ [A]: 7 }, {}, { repeat: 8 })];
      const hits = draw(
        [...parent, ev({ [A]: 3 })],
        [{ ...variant[0], repeat: 5 }, ev({ [A]: 9 }, {}, { repeat: 3 }), ev({ [A]: 3 })],
        { density: "compact" },
      ).container;
      expect(ariaOfMarked(hits)).toContain("Changed from A: fret 7 to fret 9 on string 3");
      cleanup();
      const mixed = ev({ [A]: 7 }, {}, { repeat: 8 });
      const some = draw([ev({ [A]: 7 }, {}, { repeat: 5 }), ev({ [A]: 9 }, {}, { repeat: 3 })], [mixed], { density: "compact" }).container;
      expect(ariaOfMarked(some)).toBe("string 3 fret 7, repeated 8 times. Changed from A in 3 of 8 repetitions: fret 9 to fret 7 on string 3");
    });
  });
  
  describe("INV-036 a removal keeps the staff whole", () => {
    const bracketsOf = (el: Element) => el.querySelectorAll('[class~="tab-bracket"]').length;
  
    it("carries the bracket's line across a removal inside a group", () => {
      const parent = [grouped(1), grouped(2), grouped(3)];
      const variant = [grouped(1), grouped(3)];
      const { container } = draw(parent, variant);
      const gap = q(container, "tab-removal")[0];
      expect(gap).toBeDefined();
      expect(bracketsOf(gap)).toBe(1);
    });
    it("carries it when a connector also sits in that gap", () => {
      const parent = [grouped(1), grouped(2), grouped(3)];
      const variant = [grouped(1), ev({ [A]: 3 }, { [A]: ["hammer_on"] }, { tupletId: "g", tupletCount: 3, groupKind: "tuplet" })];
      const { container } = draw(parent, variant);
      const gap = q(container, "tab-removal")[0];
      expect(gap).toBeDefined();
      expect(bracketsOf(gap)).toBe(1);
    });
    it("draws no bracket in a gap at a group's edge", () => {
      const parent = [ev({ [A]: 1 }), grouped(2), grouped(3)];
      const variant = [grouped(2), grouped(3)];
      expect(bracketsOf(q(draw(parent, variant).container, "tab-removal")[0])).toBe(0);
      cleanup();
      const after = [grouped(2), grouped(3), ev({ [A]: 1 }), ev({ [A]: 4 })];
      const without = [after[0], after[1], after[3]].map((e) => ({ ...e, id: `${e.id}'` }));
      expect(bracketsOf(q(draw(after, without).container, "tab-removal")[0])).toBe(0);
    });
    it("adds no row and no attribute to a staff with nothing marked", () => {
      const events = [ev({ [A]: 5 }), barline(), ev({ [A]: 7 })];
      const { container } = draw(events, events.map((e) => ({ ...e, id: `${e.id}'` })));
      expect(q(container, "tab-diff")).toHaveLength(0);
      expect(q(container, "tab-removal")).toHaveLength(0);
      expect(container.querySelectorAll("[data-diff]")).toHaveLength(0);
    });
    it("gives a column the same rows as its neighbours, in the order chord, bracket, strings, rhythm, mark", () => {
      const parent = [ev({ [A]: 5 }, {}, { durationHint: "q" }), grouped(6), grouped(7)];
      const variant = [ev({ [A]: 9 }, {}, { durationHint: "q" }), grouped(7)];
      const { container } = draw(parent, variant, { notes: [chord("nothing", "C")], showRhythm: true });
      for (const element of [...q(container, "tab-column"), ...q(container, "tab-removal")]) {
        expect(element.lastElementChild?.classList.contains("tab-diff-mark")).toBe(true);
        expect(element.querySelectorAll(".tab-diff-mark")).toHaveLength(1);
      }
    });
    it("draws the gap on an empty variant", () => {
      const { container, marks } = draw([ev({ [A]: 5 }), ev({ [A]: 7 })], []);
      expect(marks.line).toBe("Differs from A in bar 1: 2 removed");
      expect(q(container, "tab-removal")[0].textContent).toBe("−2");
    });
  });
  
  describe("INV-033 nothing is reachable", () => {
    it.each(["frets", "notes", "intervals"] as const)("%s", (view) => {
      const { container } = draw(
        [ev({ [A]: 1 }), ev({ [A]: 2 }), ev({ [A]: 3 })],
        [ev({ [A]: 9 }), ev({ [A]: 3 }), ev({ [A]: 4 })],
        { view },
      );
      for (const id of ["tab-diff", "tab-removal"]) {
        for (const element of q(container, id)) {
          expect(element.matches("a, button, [tabindex], [role=button]")).toBe(false);
          expect(element.querySelector("a, button, [tabindex], [role=button]")).toBeNull();
        }
      }
      for (const column of q(container, "tab-column")) {
        expect(column.getAttribute("role")).toBe("img");
        expect(column.hasAttribute("tabindex")).toBe(false);
      }
    });
  });
  
  describe("INV-028 the view changes no mark", () => {
    it("draws the same columns, the same glyphs and the same gaps in all three", () => {
      const parent = [ev({ [A]: 1 }), ev({ [A]: 2 }), barline(), ev({ [A]: 3 }), ev({ [A]: 4 })];
      const seen = (["frets", "notes", "intervals"] as const).map((view) => {
        const variant = [ev({ [A]: 1 }), ev({ [A]: 9 }), barline(), ev({ [A]: 4 }), ev({ [A]: 5 })];
        const { container } = draw(parent, variant, { view });
        const out = JSON.stringify({
          marks: q(container, "tab-diff").map((e) => e.textContent),
          gaps: q(container, "tab-removal").map((e) => e.textContent),
        });
        cleanup();
        return out;
      });
      expect(new Set(seen).size).toBe(1);
    });
  });
});
