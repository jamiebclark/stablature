/**
 * Band invites.
 *
 * An invite is a link you paste into the band chat. It grants membership in
 * one band at one role, expires, and can be revoked -- which is about as much
 * ceremony as a five-person band warrants.
 */

import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { bandInvites, bands } from "@/db/schema";
import { newId } from "@/lib/ids";
import type { BandRole } from "@/lib/model";
import { ensureMembership, roleInBand } from "./membership";

/** Long enough to be unguessable, short enough to read out over a loud amp. */
const CODE_LENGTH = 12;

/**
 * Crockford-style alphabet: no I, L, O, U, so a code cannot be misheard or
 * mistyped as a different valid one.
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

const DEFAULT_TTL_DAYS = 30;

function generateCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  // Modulo bias across 32 symbols from 256 values is exactly zero, since 256
  // is a multiple of 32.
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export interface CreatedInvite {
  code: string;
  expiresAt: Date;
  role: BandRole;
}

/** Only an owner may invite. Editors can change songs, not the roster. */
export async function createInvite(
  userId: string,
  bandId: string,
  role: BandRole = "editor",
): Promise<CreatedInvite | { error: "forbidden" | "unknown_band" }> {
  const [band] = await db.select({ id: bands.id }).from(bands).where(eq(bands.id, bandId)).limit(1);
  if (!band) return { error: "unknown_band" };

  if ((await roleInBand(userId, bandId)) !== "owner") return { error: "forbidden" };

  const code = generateCode();
  const expiresAt = new Date(Date.now() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.insert(bandInvites).values({
    id: newId(),
    bandId,
    code,
    role,
    createdByUserId: userId,
    expiresAt,
  });

  return { code, expiresAt, role };
}

export interface AcceptedInvite {
  bandId: string;
  bandName: string;
  role: BandRole;
}

/**
 * Redeem a code.
 *
 * Idempotent: accepting twice is a no-op rather than an error, because people
 * open links twice and the second tap should not look like a failure. An
 * existing membership is never downgraded.
 */
export async function acceptInvite(
  userId: string,
  code: string,
): Promise<AcceptedInvite | { error: "invalid" | "expired" }> {
  const [invite] = await db
    .select({
      bandId: bandInvites.bandId,
      role: bandInvites.role,
      bandName: bands.name,
    })
    .from(bandInvites)
    .innerJoin(bands, eq(bands.id, bandInvites.bandId))
    .where(
      and(
        eq(bandInvites.code, code.trim().toUpperCase()),
        isNull(bandInvites.revokedAt),
        gt(bandInvites.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!invite) {
    // Deliberately not distinguishing "never existed" from "expired" to a
    // caller holding a bad code; the route maps this to one message.
    return { error: "invalid" };
  }

  const existing = await roleInBand(userId, invite.bandId);
  if (existing) {
    return { bandId: invite.bandId, bandName: invite.bandName, role: existing };
  }

  await ensureMembership(userId, invite.bandId, invite.role);
  return { bandId: invite.bandId, bandName: invite.bandName, role: invite.role };
}

export async function revokeInvites(userId: string, bandId: string): Promise<boolean> {
  if ((await roleInBand(userId, bandId)) !== "owner") return false;
  await db
    .update(bandInvites)
    .set({ revokedAt: new Date() })
    .where(and(eq(bandInvites.bandId, bandId), isNull(bandInvites.revokedAt)));
  return true;
}
