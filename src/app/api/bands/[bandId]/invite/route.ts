import { createInvite, revokeInvites } from "@/lib/server/invites";
import { currentUser, unauthorized } from "@/lib/server/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bandId: string }> },
) {
  const user = await currentUser(request);
  if (!user) return unauthorized();

  const { bandId } = await params;
  const result = await createInvite(user.userId, bandId);

  if ("error" in result) {
    const status = result.error === "unknown_band" ? 404 : 403;
    return Response.json(
      {
        error:
          result.error === "unknown_band"
            ? "That band has not reached the server yet. Sync first, then invite."
            : "Only the band owner can invite people.",
      },
      { status },
    );
  }

  return Response.json(result);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ bandId: string }> },
) {
  const user = await currentUser(request);
  if (!user) return unauthorized();

  const { bandId } = await params;
  const revoked = await revokeInvites(user.userId, bandId);
  if (!revoked) {
    return Response.json({ error: "Only the band owner can revoke invites." }, { status: 403 });
  }
  return Response.json({ revoked: true });
}
