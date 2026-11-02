import { applyPush, notifyChanged } from "@/lib/server/sync";
import { rolesForUser } from "@/lib/server/membership";
import { currentUser, unauthorized } from "@/lib/server/session";
import { pushRequestSchema } from "@/lib/sync/protocol";

export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return unauthorized();

  const parsed = pushRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Malformed push.", issues: parsed.error.issues.slice(0, 10) },
      { status: 400 },
    );
  }

  const roles = await rolesForUser(user.userId);
  const result = await applyPush(user.userId, parsed.data.mutations, roles);

  // Wake other devices only if something actually landed.
  if (result.cursor > 0) await notifyChanged(result.cursor);

  return Response.json(result);
}
