import { z } from "zod";
import { readCapped } from "@/lib/memos/body";
import { parseFormat, sniff } from "@/lib/memos/formats";
import { MAX_BYTES } from "@/lib/memos/limits";
import { REFUSALS, type RefusalCode } from "@/lib/memos/refusals";
import { canEdit, rolesForUser } from "@/lib/server/membership";
import { memoForRoute, readAudio, storeAudio } from "@/lib/server/memos";
import { currentUser } from "@/lib/server/session";
import { notifyChanged } from "@/lib/server/sync";

const HEADERS = { "cache-control": "private, no-store" };

/** Every answer that is not audio: the words come from the one table. */
function refuse(code: RefusalCode): Response {
  const { status, message } = REFUSALS[code];
  return Response.json({ code, message }, { status, headers: HEADERS });
}

const uuid = z.string().uuid();

/** The memo, if the account is in its band. Absent and foreign look the same. */
async function reachable(userId: string, memoId: string) {
  if (!uuid.safeParse(memoId).success) return null;
  const memo = await memoForRoute(memoId);
  if (!memo) return null;
  const role = (await rolesForUser(userId)).get(memo.bandId);
  return role ? { memo, role } : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ memoId: string }> },
) {
  const user = await currentUser(request);
  if (!user) return refuse("signed_out");
  const { memoId } = await params;
  const found = await reachable(user.userId, memoId);
  if (!found) return refuse("not_found");

  const audio = await readAudio(memoId);
  if (audio.kind === "erased") return refuse("erased");
  if (audio.kind === "not_uploaded") return refuse("not_uploaded");
  return new Response(new Uint8Array(audio.bytes), {
    status: 200,
    headers: {
      ...HEADERS,
      "content-type": audio.contentType,
      "content-length": String(audio.bytes.byteLength),
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ memoId: string }> },
) {
  const user = await currentUser(request);
  if (!user) return refuse("signed_out");
  const { memoId } = await params;
  const found = await reachable(user.userId, memoId);
  if (!found) return refuse("not_found");
  if (!canEdit(found.role)) return refuse("read_only");

  const type = parseFormat(request.headers.get("content-type"));
  if (!type) return refuse("format");
  if (type.base !== parseFormat(found.memo.format)?.base) return refuse("format_mismatch");

  const declared = request.headers.get("content-length");
  if (declared !== null && /^\d+$/.test(declared)) {
    const length = Number(declared);
    if (length > MAX_BYTES) return refuse("too_large");
    if (length !== found.memo.size) return refuse("size_mismatch");
  }

  const body = await readCapped(request.body, MAX_BYTES);
  if (!body.ok) return refuse(body.reason);
  if (body.bytes.byteLength !== found.memo.size) return refuse("size_mismatch");
  if (sniff(body.bytes) !== type.base) return refuse("content_mismatch");

  const stored = await storeAudio(memoId, type.normalised, body.bytes);
  if (!stored.ok) return refuse(stored.code);
  if (stored.created) await notifyChanged(stored.serverSeq);
  return Response.json({ code: "stored" }, { status: stored.created ? 201 : 200, headers: HEADERS });
}
