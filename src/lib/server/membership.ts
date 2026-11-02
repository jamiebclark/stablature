/**
 * Who may see and change what.
 *
 * Authorisation is per band, and `bandId` is denormalised onto every synced
 * row precisely so this check is one lookup rather than a chain of joins up to
 * the band. That matters because push validates every row in a batch
 * individually -- a batch of 500 columns should not mean 500 joins.
 */

import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { bandMembers, bands } from "@/db/schema";
import { newId } from "@/lib/ids";
import type { BandRole } from "@/lib/model";

/** Roles that may write. Viewers can read a band but not change it. */
const WRITERS: ReadonlySet<BandRole> = new Set<BandRole>(["owner", "editor"]);

export function canEdit(role: BandRole | undefined): boolean {
  return role !== undefined && WRITERS.has(role);
}

/** Every band this user belongs to, with their role in it. */
export async function rolesForUser(userId: string): Promise<Map<string, BandRole>> {
  const rows = await db
    .select({ bandId: bandMembers.bandId, role: bandMembers.role })
    .from(bandMembers)
    .where(eq(bandMembers.userId, userId));

  return new Map(rows.map((row) => [row.bandId, row.role]));
}

export async function roleInBand(
  userId: string,
  bandId: string,
): Promise<BandRole | undefined> {
  const [row] = await db
    .select({ role: bandMembers.role })
    .from(bandMembers)
    .where(and(eq(bandMembers.userId, userId), eq(bandMembers.bandId, bandId)))
    .limit(1);
  return row?.role;
}

/**
 * Make a user a member, leaving an existing membership alone.
 *
 * Idempotent because it runs on every push that creates a band, and a retried
 * push must not demote an owner to editor.
 */
export async function ensureMembership(
  userId: string,
  bandId: string,
  role: BandRole,
): Promise<void> {
  await db
    .insert(bandMembers)
    .values({ id: newId(), bandId, userId, role })
    .onConflictDoNothing({ target: [bandMembers.bandId, bandMembers.userId] });
}

export async function bandExists(bandId: string): Promise<boolean> {
  const [row] = await db.select({ id: bands.id }).from(bands).where(eq(bands.id, bandId)).limit(1);
  return Boolean(row);
}
