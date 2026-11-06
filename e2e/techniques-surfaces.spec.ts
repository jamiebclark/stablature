import { openTools } from "./usability-helpers";
/**
 * INV-005: one fixture holding 4 transitions, 6 decorations, a repeated column, a barline, a
 * chord symbol and a triplet, on capture staff, song page expanded, song page compact and the
 * play view. The suite's fixture has one decoration, and its play-view member races a write.
 *
 * INV-003: no connector and exactly the plain width formula on a part with no techniques.
 * INV-023: aria-label for every member, on the capture staff and the read-only views.
 * INV-027 (computed half): connectors, affixes, chips and toggles x 2 themes.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addChord,
  CHIPS,
  columns,
  connectors,
  DECORATIONS,
  details,
  exportRow,
  exportText,
  fret,
  inspector,
  latch,
  openDialog,
  PHONE,
  stackLatch,
  startCapturing,
  storedRows,
  strip,
  THEMES,
} from "./capture-surface-helpers";

async function decorate(page: Page, index: number, words: readonly string[]) {
  await columns(page).nth(index).click();
  await details(page).click();
  await expect(openDialog(page)).toHaveCount(1);
  for (const w of words) {
    const toggle = inspector(page).getByRole("button", { name: `${w} on the A1 string` });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  }
  await inspector(page).getByRole("button", { name: "close" }).click();
  await expect(openDialog(page)).toHaveCount(0);
}

async function fixture(page: Page) {
  const ctx = await startCapturing(page);
  await fret(page, "A", 5).click();
  for (const [chip, number] of [
    ["hammer-on", 7],
    ["pull-off", 5],
    ["slide up", 7],
    ["slide down", 5],
  ] as const) {
    await latch(page, chip).click();
    await fret(page, "A", number).click();
  }
  await expect(connectors(page)).toHaveCount(4);
  await page.getByTitle("Four of these").click();
  await expect(columns(page)).toHaveCount(8);
  await page.getByTitle("Barline").click();
  for (let i = 0; i < 3; i += 1) await fret(page, "A", 3).click();
  await expect(columns(page)).toHaveCount(12);
  await page.getByTitle(/triplet/).click();
  await decorate(page, 0, DECORATIONS.map((d) => d.words));
  await decorate(page, 2, ["vibrato"]);
  await addChord(page, 1, "Am");
  return ctx;
}

const rail = /[-|\s]/g;

/** One string's drawn text with the rails out, from the DOM, in DOM order. */
const domRow = (page: Page, nth: number, stringIndex: number) =>
  page.getByTestId("tab-staff").nth(nth).evaluate((staff, i) => {
    let out = "";
    staff
      .querySelectorAll('[data-testid="tab-column"], [data-testid="tab-connector"]')
      .forEach((el) => {
        out += (el.querySelectorAll(".tab-cell")[i]?.textContent ?? "").trim();
      });
    return out;
  }, stringIndex);

const WANT_EXPANDED = "-t(<5>)b~mh7p5~/7\\5\\5\\5\\5-|-3-3-3-";

test("INV-005 one fixture, four surfaces, both densities", async ({ page }) => {
  const { songUrl } = await fixture(page);
  const text = await exportText(page, songUrl);
  const row = exportRow(text, "A");
  expect(row).toBe(WANT_EXPANDED);
  const want = row.replace(rail, "");

  expect(await domRow(page, 0, 2), "capture staff").toBe(want);

  await page.goto(songUrl);
  await expect(connectors(page).first()).toBeVisible();
  expect(await domRow(page, 0, 2), "song expanded").toBe(want);

  await openTools(page);
  await page.getByRole("button", { name: "compact" }).click();
  await expect(connectors(page)).toHaveCount(4);
  const compact = "t(<5>)b~mh7p5~/7\\5x433" + "3";
  expect(await domRow(page, 0, 2), "song compact").toBe(compact);

  // Compact download matches compact on screen.
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download/ }).click();
  const chunks: Buffer[] = [];
  for await (const c of await (await download).createReadStream()) chunks.push(c as Buffer);
  const compactText = Buffer.concat(chunks).toString("utf-8");
  expect(exportRow(compactText, "A").replace(rail, "")).toBe(compact);

  const add = page.getByRole("button", { name: "Add part A to the arrangement" });
  await add.click();
  await expect(add).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Each part once" })).toHaveCount(0); // the write landed
  await page.goto(`${songUrl}/play`);
  await expect(page.getByTestId("tab-staff").first()).toBeVisible({ timeout: 5000 });
  expect(await domRow(page, 0, 2), "play view").toBe(want);
});

test("INV-003 no connector, and exactly the plain width", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await fret(page, "A", 12).click();
  await page.getByTitle("Barline").click();
  await fret(page, "E", 3).click();
  await stackLatch(page).click();
  await fret(page, "D", 10).click();
  await stackLatch(page).click();
  await expect(columns(page)).toHaveCount(4);
  await expect(connectors(page)).toHaveCount(0);
  const m = await page.getByTestId("tab-staff").evaluate((staff) => {
    const probe = document.createElement("span");
    probe.textContent = "0";
    probe.style.position = "absolute";
    staff.append(probe);
    const ch = probe.getBoundingClientRect().width;
    probe.remove();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const padProbe = document.createElement("div");
    padProbe.style.width = "var(--col-pad)";
    staff.append(padProbe);
    const pad = padProbe.getBoundingClientRect().width;
    padProbe.remove();
    return {
      ch,
      rem,
      pad,
      widths: [...staff.querySelectorAll('[data-testid="tab-column"]')].map(
        (e) => e.getBoundingClientRect().width,
      ),
    };
  });
  const plain = [1, 2, 1, 2].map((w) => w * m.ch + m.pad);
  m.widths.forEach((w, i) => expect(w).toBeCloseTo(plain[i], 1));
});

const LABELS: { name: string; build: (page: Page) => Promise<void>; last: string }[] = [
  ...CHIPS.map((c) => ({
    name: c.name,
    build: async (page: Page) => {
      await fret(page, "A", 5).click();
      await latch(page, c.name).click();
      await fret(page, "A", 7).click();
      await expect(connectors(page)).toHaveCount(1);
    },
    last: `string 3 fret 7 with ${c.name}`,
  })),
  ...DECORATIONS.map((d) => ({
    name: d.words,
    build: async (page: Page) => {
      await fret(page, "A", 7).click();
      await decorate(page, 0, [d.words]);
    },
    last: `string 3 fret 7 with ${d.words}`,
  })),
  {
    name: "all six",
    build: async (page) => {
      await fret(page, "A", 7).click();
      await decorate(page, 0, DECORATIONS.map((d) => d.words));
    },
    last: "string 3 fret 7 with tap, let ring, harmonic, bend, vibrato and palm mute",
  },
  {
    name: "a dead note",
    build: async (page) => {
      await page.getByRole("button", { name: "Dead note on the A string" }).click();
      await expect(columns(page)).toHaveCount(1);
      await decorate(page, 0, ["palm mute"]);
    },
    last: "string 3 fret x with palm mute",
  },
  {
    name: "a transition with no source",
    build: async (page) => {
      await fret(page, "E", 3).click();
      await latch(page, "hammer-on").click();
      await fret(page, "A", 7).click();
      await expect(columns(page)).toHaveCount(2);
    },
    last: "string 3 fret 7",
  },
  {
    name: "a plain column",
    build: async (page) => {
      await fret(page, "A", 7).click();
      await expect(columns(page)).toHaveCount(1);
    },
    last: "string 3 fret 7",
  },
];

for (const member of LABELS) {
  test(`INV-023 ${member.name}`, async ({ page }) => {
    const { songUrl } = await startCapturing(page);
    await member.build(page);
    await expect(columns(page).last()).toHaveAttribute("aria-label", member.last);
    await page.goto(songUrl);
    const last = columns(page).last();
    await expect(last).toHaveAttribute("aria-label", member.last);
    await expect(last).toHaveAttribute("role", "img");
  });
}

test("INV-023 compact repeated, with no affix read out", async ({ page }) => {
  const { songUrl } = await startCapturing(page);
  await fret(page, "A", 7).click();
  await decorate(page, 0, ["vibrato"]);
  await page.getByTitle("Four of these").click();
  await expect(columns(page)).toHaveCount(4);
  await page.goto(songUrl);
  await openTools(page);
  await page.getByRole("button", { name: "compact" }).click();
  await expect(columns(page)).toHaveCount(1);
  await expect(columns(page).first()).toHaveAttribute(
    "aria-label",
    "string 3 fret 7 with vibrato, repeated 4 times",
  );
});

for (const theme of THEMES) {
  test(`INV-027 computed style, ${theme}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
    await page.setViewportSize(PHONE);
    await page.emulateMedia({ colorScheme: theme });
    await fixture(page);

    const marks = await page.getByTestId("tab-staff").evaluate((staff) => {
      const ink = (el: Element) => {
        const cs = getComputedStyle(el);
        let opacity = 1;
        for (let n: Element | null = el; n; n = n.parentElement) {
          opacity *= Number(getComputedStyle(n).opacity);
        }
        return { color: cs.color, weight: cs.fontWeight, opacity };
      };
      return {
        glyph: ink(staff.querySelector('[data-testid="tab-connector"] .tab-cell > span')!),
        cell: ink(staff.querySelector('[data-testid="tab-column"] .tab-cell > span')!),
      };
    });
    expect(marks.glyph.opacity).toBe(1);
    expect(marks.cell.opacity).toBe(1);
    expect(marks.glyph.color).toBe(marks.cell.color);

    const chipStyle = (name: string) =>
      latch(page, name).evaluate((e) => {
        const cs = getComputedStyle(e);
        return { bg: cs.backgroundColor, color: cs.color, opacity: cs.opacity };
      });
    const off = await chipStyle("hammer-on");
    await latch(page, "hammer-on").click();
    await expect(latch(page, "hammer-on")).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(300); // the chip has a colour transition
    const on = await chipStyle("hammer-on");
    expect(on.bg).not.toBe(off.bg);
    expect(on.opacity).toBe("1");
    expect(off.opacity).toBe("1");

    await columns(page).first().click();
    await details(page).click();
    const toggles = inspector(page).getByTestId("decoration-group").getByRole("button");
    const onToggle = await toggles.first().evaluate((e) => {
      const cs = getComputedStyle(e);
      return { bg: cs.backgroundColor, color: cs.color, pressed: e.getAttribute("aria-pressed") };
    });
    expect(onToggle.pressed).toBe("true");
    await toggles.first().click();
    await expect(toggles.first()).toHaveAttribute("aria-pressed", "false");
    const offToggle = await toggles.first().evaluate((e) => {
      const cs = getComputedStyle(e);
      return { bg: cs.backgroundColor, color: cs.color };
    });
    expect(onToggle.bg).not.toBe(offToggle.bg);
    expect(onToggle.color).not.toBe(offToggle.color);
    console.log(`MEASURE ${theme} ${JSON.stringify({ marks, chip: { on, off }, onToggle, offToggle })}`);
    await expect(strip(page)).toBeVisible();
  });
}

test("a widened tail stays in view when followTail is on", async ({ page }) => {
  await page.setViewportSize(PHONE);
  await startCapturing(page);
  for (let i = 0; i < 40; i += 1) await fret(page, "A", 12).click();
  await expect(columns(page)).toHaveCount(40);
  await details(page).click();
  for (const d of DECORATIONS) {
    const toggle = inspector(page).getByRole("button", { name: `${d.words} on the A1 string` });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  }
  await inspector(page).getByRole("button", { name: "close" }).click();
  await expect(openDialog(page)).toHaveCount(0);
  const left = await page
    .getByTestId("tab-staff")
    .locator(".overflow-x-auto")
    .evaluate((el) => el.scrollWidth - el.clientWidth - el.scrollLeft);
  expect(left, "scrolled to the end").toBeLessThanOrEqual(1);
});

test("the fixture stores no source in any form", async ({ page }) => {
  await fixture(page);
  const rows = await storedRows(page);
  for (const row of rows) {
    for (const other of rows) {
      if (row.id !== other.id) expect(JSON.stringify(row.techniques)).not.toContain(other.id);
    }
  }
});
