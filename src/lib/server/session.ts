import { auth } from "@/lib/auth";

export interface RequestUser {
  userId: string;
}

/**
 * The signed-in user, or null.
 *
 * Sync is the one part of the app that requires a session. Everything else
 * reads the local mirror, which is what keeps capture working with no network.
 */
export async function currentUser(request: Request): Promise<RequestUser | null> {
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ? { userId: session.user.id } : null;
}

export function unauthorized(): Response {
  return Response.json(
    { error: "Sign in to sync. Your local changes are safe and will push once you do." },
    { status: 401 },
  );
}
