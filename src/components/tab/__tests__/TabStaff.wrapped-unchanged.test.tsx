// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { barline, bass5, ev } from "@/lib/tab/__tests__/helpers";
import { TabStaff } from "../TabStaff";

const A = 2;

// INV-009: the play view passes none of the capture props, so its wrapped markup must not change.
describe("TabStaff wrapped markup without capture props", () => {
  it("is unchanged", () => {
    const html = renderToStaticMarkup(
      <TabStaff
        wrap
        events={[ev({ [A]: 5 }), ev({ [A]: 7 }), barline(), ev({ [A]: 3 })]}
        tuning={bass5}
      />,
    );
    expect(html).toMatchSnapshot();
  });
});
