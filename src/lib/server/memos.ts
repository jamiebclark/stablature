/** Server-side memo helpers shared by push and the audio routes. */

import { createHash } from "node:crypto";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { BAND_TOTAL_BYTES } from "@/lib/memos/limits";
import type { RefusalCode } from "@/lib/memos/refusals";
import { PUSH_LOCK } from "./sync";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Mark these memos' audio ERASED: bytes and hash cleared, size 0, the first
 * `erased_at` kept. Idempotent. This is the only statement that clears
 * the bytes column; `check:memo-fence` asserts that it appears exactly once.
 */
export async function eraseMemoAudio(
  tx: Tx,
  memoIds: readonly string[],
  bandId: string,
): Promise<void> {
  if (memoIds.length === 0) return;
  const rows = memoIds.map((memoId) => ({
    memoId,
    bandId,
    contentType: "",
    size: 0,
    erasedAt: sql`now()`,
  }));
  await tx
    .insert(schema.memoAudio)
    .values(rows as never)
    .onConflictDoUpdate({
      target: schema.memoAudio.memoId,
      set: {
        bytes: null,
        sha256: null,
        size: 0,
        erasedAt: sql`coalesce(${schema.memoAudio.erasedAt}, now())`,
      },
    });
}

/** The ids of a part's memos (live or not). */
export async function memoIdsOfParts(tx: Tx, partIds: readonly string[]): Promise<string[]> {
  if (partIds.length === 0) return [];
  const rows = await tx
    .select({ id: schema.memos.id })
    .from(schema.memos)
    .where(inArray(schema.memos.partId, [...partIds]));
  return rows.map((r) => r.id);
}

/** The memo a request names, with just what the routes check. */
export async function memoForRoute(memoId: string) {
  const [row] = await db
    .select({
      id: schema.memos.id,
      bandId: schema.memos.bandId,
      partId: schema.memos.partId,
      format: schema.memos.format,
      size: schema.memos.size,
      deletedAt: schema.memos.deletedAt,
      serverSeq: schema.memos.serverSeq,
    })
    .from(schema.memos)
    .where(eq(schema.memos.id, memoId))
    .limit(1);
  return row;
}

export type AudioRead =
  | { kind: "ok"; bytes: Buffer; contentType: string }
  | { kind: "erased" }
  | { kind: "not_uploaded" };

/** The stored audio of a memo (the caller has already checked the band). */
export async function readAudio(memoId: string): Promise<AudioRead> {
  const [row] = await db
    .select({
      bytes: schema.memoAudio.bytes,
      contentType: schema.memoAudio.contentType,
      erasedAt: schema.memoAudio.erasedAt,
    })
    .from(schema.memoAudio)
    .where(eq(schema.memoAudio.memoId, memoId))
    .limit(1);
  if (row?.erasedAt) return { kind: "erased" };
  if (!row || !row.bytes) return { kind: "not_uploaded" };
  return { kind: "ok", bytes: row.bytes, contentType: row.contentType };
}

/** Bytes this band holds on the server. */
export async function bandTotal(tx: Pick<typeof db, "select">, bandId: string): Promise<number> {
  const [row] = await tx
    .select({ total: sql<string>`coalesce(sum(${schema.memoAudio.size}), 0)` })
    .from(schema.memoAudio)
    .where(and(eq(schema.memoAudio.bandId, bandId), isNotNull(schema.memoAudio.bytes)));
  return Number(row?.total ?? 0);
}

export type StoreResult =
  | { ok: true; created: boolean; serverSeq: number }
  | { ok: false; code: RefusalCode };

/**
 * Keep an upload. Runs under `PUSH_LOCK`, so the checks and the insert see the
 * same state as push does: a delete that has landed cannot be undone by a late
 * upload, and two uploads cannot both squeeze past the band total.
 */
export async function storeAudio(
  memoId: string,
  contentType: string,
  bytes: Uint8Array,
): Promise<StoreResult> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${PUSH_LOCK})`);
    const [memo] = await tx.select().from(schema.memos).where(eq(schema.memos.id, memoId)).limit(1);
    if (!memo || memo.deletedAt) return { ok: false, code: "deleted" } as const;
    const [audio] = await tx
      .select({
        sha256: schema.memoAudio.sha256,
        erasedAt: schema.memoAudio.erasedAt,
        hasBytes: sql<boolean>`${schema.memoAudio.bytes} is not null`,
      })
      .from(schema.memoAudio)
      .where(eq(schema.memoAudio.memoId, memoId))
      .limit(1);
    if (audio?.erasedAt) return { ok: false, code: "erased" } as const;
    const [part] = await tx
      .select({ deletedAt: schema.parts.deletedAt })
      .from(schema.parts)
      .where(eq(schema.parts.id, memo.partId))
      .limit(1);
    if (!part || part.deletedAt) {
      await eraseMemoAudio(tx, [memoId], memo.bandId);
      return { ok: false, code: "part_deleted" } as const;
    }
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (audio?.hasBytes) {
      return audio.sha256 === sha256
        ? ({ ok: true, created: false, serverSeq: memo.serverSeq } as const)
        : ({ ok: false, code: "different_file" } as const);
    }
    if ((await bandTotal(tx, memo.bandId)) + bytes.byteLength > BAND_TOTAL_BYTES) {
      return { ok: false, code: "band_full" } as const;
    }
    await tx.insert(schema.memoAudio).values({
      memoId,
      bandId: memo.bandId,
      contentType,
      size: bytes.byteLength,
      sha256,
      bytes: Buffer.from(bytes),
      uploadedAt: sql`now()`,
    });
    return { ok: true, created: true, serverSeq: memo.serverSeq } as const;
  });
}
