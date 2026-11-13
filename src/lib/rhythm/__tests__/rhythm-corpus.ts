import type { EventRow } from "@/lib/model";
import { layoutPart, type Density } from "@/lib/tab/layout";
import { bass5, barline, ev } from "@/lib/tab/__tests__/helpers";

/**
 * A bar written as text, for the FR-036 corpus. Tokens: `8` `r16` `unset` `"64"` (unknown), `|` (barline),
 * `x4:16` (a repeat), `[3: 8 8 8]` a counted group, `[p: 16 16]` a plain group.
 */
let gid = 0;
function one(token: string, over: Partial<EventRow> = {}): EventRow {
  if (token === "|") return barline();
  if (token === "unset") return ev({ "2": 5 }, {}, { durationHint: null, ...over });
  if (token === '"64"') return ev({ "2": 5 }, {}, { durationHint: "64" as never, ...over });
  const rest = token.startsWith("r");
  const rep = /^x(\d+):(.+)$/.exec(token);
  const d = rep ? rep[2] : rest ? token.slice(1) : token;
  return ev(rest ? {} : { "2": 5 }, {}, {
    kind: rest ? "rest" : "notes",
    durationHint: d as never,
    repeat: rep ? Number(rep[1]) : 1,
    ...over,
  });
}

export function parse(text: string): EventRow[] {
  const out: EventRow[] = [];
  const re = /\[(\d+|p):\s*([^\]]*)\]|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[3] !== undefined) {
      out.push(one(m[3]));
      continue;
    }
    const id = `g${++gid}`;
    const over: Partial<EventRow> =
      m[1] === "p"
        ? { tupletId: id, tupletCount: null, groupKind: "plain" }
        : { tupletId: id, tupletCount: Number(m[1]), groupKind: "tuplet" };
    for (const t of m[2].trim().split(/\s+/)) out.push(one(t, over));
  }
  return out;
}

export const layoutOf = (events: EventRow[], density: Density = "expanded") =>
  layoutPart({ events, tuning: bass5, density });
