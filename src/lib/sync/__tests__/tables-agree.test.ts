import { describe, expect, it } from "vitest";
import { SYNC_TABLE_ORDER } from "../../../db/schema/domain";
import { TABLES } from "../../server/sync";
import { MERGEABLE_FIELDS, SERVER_STAMPED_FIELDS, SYNCED_TABLES } from "../../model";
import { ROW_SCHEMAS } from "../protocol";

const keys = (o: object) => [...Object.keys(o)].sort();

describe("every place a synced table is declared (INV-005, FR-005)", () => {
  it("SYNCED_TABLES equals SYNC_TABLE_ORDER", () => {
    expect([...SYNCED_TABLES]).toEqual([...SYNC_TABLE_ORDER]);
  });

  it("ROW_SCHEMAS, MERGEABLE_FIELDS and the server TABLES name the same tables", () => {
    const expected = [...SYNCED_TABLES].sort();
    expect(keys(ROW_SCHEMAS)).toEqual(expected);
    expect(keys(MERGEABLE_FIELDS)).toEqual(expected);
    expect(keys(TABLES)).toEqual(expected);
  });

  it("server-stamped fields belong to a synced table and are never mergeable", () => {
    for (const [table, fields] of Object.entries(SERVER_STAMPED_FIELDS)) {
      expect(SYNCED_TABLES as readonly string[]).toContain(table);
      const mergeable = (MERGEABLE_FIELDS as Record<string, readonly string[]>)[table];
      for (const f of fields) expect(mergeable).not.toContain(f);
    }
  });
});
