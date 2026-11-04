import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

/*
 * INV-001 / INV-003: this feature changes no stored shape and edits no
 * pre-existing exact-string test. This guards; it cannot fail first unless
 * someone edits a fenced file.
 */

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return null;
  }
}

const mainResolvable = git("rev-parse", "--verify", "--quiet", "main") !== null;

describe.skipIf(!mainResolvable)("the storage fence (needs a resolvable `main`)", () => {
  it("leaves the fenced members untouched", () => {
    const diff = git(
      "diff",
      "--name-only",
      "main",
      "--",
      "src/db",
      "drizzle",
      "src/lib/model.ts",
      "src/lib/sync",
      "src/lib/local/clipboard.ts",
      "src/lib/local/db.ts",
    );
    expect(diff?.trim()).toBe("");
    const untracked = git("ls-files", "--others", "--exclude-standard", "drizzle");
    expect(untracked?.trim()).toBe("");
  });

  it("leaves the existing exact-string tests untouched", () => {
    const diff = git(
      "diff",
      "--name-only",
      "main",
      "--",
      "src/lib/tab/__tests__/ascii.test.ts",
      "src/lib/export/__tests__/text.test.ts",
    );
    expect(diff?.trim()).toBe("");
  });
});
