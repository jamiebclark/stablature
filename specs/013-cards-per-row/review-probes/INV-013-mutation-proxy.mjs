/**
 * Review round 4: a mutation proxy, so the suite's own tests can be shown to fail without editing any source file.
 * It forwards every request to `next start` on UPSTREAM_PORT. In each CSS and JS response it applies the MUTATION's
 * replacements. Other bodies pass through untouched.
 *
 *   node INV-013-mutation-proxy.mjs <listenPort> <upstreamPort> <mutation>
 *
 * Mutations:
 * - `own-head-print`: the print rule reads `--own-head` again, which is round 2 F1's state (T046's "confirm it can fail").
 * - `no-print-step`: `useCardTrack` finds no `.no-print` head items, so T043's second and third forced layouts in each
 *   measuring batch read a clean layout and cost nothing. This bisects the round-4 click-timing INV-022 regression.
 * - `no-head-ro`: the ResizeObserver watches the rulers only, as on main (no head rows).
 * - `no-head-toggle`: the batch reads each head as drawn, with no `max-content`/`nowrap` toggle.
 * - `flat-ruler`: `sumTerms` joins the ruler's terms flat, as main's `rulerWidth` did (Chromium reads it as 0px past
 *   about 100 operands).
 * - `no-ro`: `useCardTrack` measures after each commit and never observes, so nothing re-measures between commits.
 * - `no-has`: the memo floor's `li:has([data-testid=part-memos])` rules match nothing (no `:has()` in the stylesheet).
 * - `grid-list`: the wide list is `display: grid` again (no flex row breaking).
 * - `none`: forwards unchanged (the control).
 */
import http from "node:http";

const [listen, upstream, mutation = "none"] = process.argv.slice(2);
const MUTATIONS = {
  none: [],
  "own-head-print": [["var(--own-head-print,var(--own-head,0px))", "var(--own-head,0px)"]],
  "no-print-step": [['querySelectorAll(".no-print")', 'querySelectorAll(".no-print-x")']],
  "no-head-ro": [['querySelector(".reading-card > :first-child");t&&a.observe(t)', 'querySelector(".reading-card-x");t&&a.observe(t)']],
  "no-head-toggle": [['e.head&&(e.head.style.width="max-content",e.head.style.flexWrap="nowrap")', "e.head&&0"]],
  "flat-ruler": [['if(e.length<=8)return e.join(" + ");', 'if(1)return e.join(" + ");']],
  "no-ro": [['if(l(),"u"<typeof ResizeObserver)return;', "if(l(),1)return;"]],
  "no-has": [[".reading-cards>li:has([data-testid=part-memos])", ".reading-cards>li.never-x"]],
  "grid-list": [["flex-wrap:wrap;align-items:flex-start;display:flex}", "flex-wrap:wrap;align-items:flex-start;display:grid}"]],
};
// `a+b` applies several mutations at once.
const swaps = mutation.split("+").flatMap((m) => MUTATIONS[m] ?? [null]);
if (swaps.includes(null)) throw new Error(`unknown mutation ${mutation}`);

http
  .createServer((req, res) => {
    const headers = { ...req.headers };
    delete headers["accept-encoding"];
    const up = http.request({ host: "127.0.0.1", port: Number(upstream), method: req.method, path: req.url, headers }, (ur) => {
      const type = String(ur.headers["content-type"] ?? "");
      const css = /\.(css|js)(\?|$)/.test(req.url ?? "") || type.includes("text/css") || type.includes("javascript");
      if (!css || swaps.length === 0) {
        res.writeHead(ur.statusCode ?? 502, ur.headers);
        ur.pipe(res);
        return;
      }
      const chunks = [];
      ur.on("data", (c) => chunks.push(c));
      ur.on("end", () => {
        let body = Buffer.concat(chunks).toString("utf8");
        let hits = 0;
        for (const [from, to] of swaps) {
          const parts = body.split(from);
          hits += parts.length - 1;
          body = parts.join(to);
        }
        if (hits > 0) console.log(`mutated ${req.url}: ${hits} replacement(s)`);
        const out = Buffer.from(body, "utf8");
        const h = { ...ur.headers, "content-length": String(out.length) };
        delete h.etag;
        res.writeHead(ur.statusCode ?? 502, h);
        res.end(out);
      });
    });
    up.on("error", () => {
      res.writeHead(502);
      res.end();
    });
    req.pipe(up);
  })
  .listen(Number(listen));
