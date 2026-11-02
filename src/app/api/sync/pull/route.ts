import { rolesForUser } from "@/lib/server/membership";
import { currentUser, unauthorized } from "@/lib/server/session";
import { readPull } from "@/lib/server/sync";
import { pullQuerySchema } from "@/lib/sync/protocol";

export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const parsed = pullQuerySchema.safeParse({
    since: url.searchParams.get("since") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "Malformed pull query." }, { status: 400 });
  }

  const roles = await rolesForUser(user.userId);
  const result = await readPull(roles, parsed.data.since, parsed.data.limit);

  return Response.json(result, {
    // Never cached: the cursor makes every response different and a stale one
    // would silently stall sync.
    headers: { "cache-control": "no-store" },
  });
}
