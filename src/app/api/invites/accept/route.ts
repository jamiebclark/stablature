import { z } from "zod";
import { acceptInvite } from "@/lib/server/invites";
import { currentUser, unauthorized } from "@/lib/server/session";

const bodySchema = z.object({ code: z.string().min(4).max(64) });

export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "That invite code does not look right." }, { status: 400 });
  }

  const result = await acceptInvite(user.userId, parsed.data.code);
  if ("error" in result) {
    return Response.json(
      { error: "That invite is not valid any more. Ask for a fresh link." },
      { status: 404 },
    );
  }

  return Response.json(result);
}
