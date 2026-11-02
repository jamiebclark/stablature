import { subscribeToChanges } from "@/lib/server/notifications";
import { currentUser, unauthorized } from "@/lib/server/session";

/** Streaming response; must never be prerendered or cached. */
export const dynamic = "force-dynamic";

/**
 * Tells connected clients when to pull.
 *
 * The event carries only a cursor, never row data -- the pull endpoint already
 * does that job, and keeping payloads out of the stream means there is nothing
 * here to authorise per message. A client may be woken for a change it cannot
 * see, which costs one empty pull and saves tracking per-band subscriptions.
 *
 * Server-sent events rather than a WebSocket: this survives a reverse proxy
 * with no extra configuration, which matters for something self-hosted behind
 * whatever Unraid is running.
 */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) return unauthorized();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (payload: unknown) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          open = false;
        }
      };

      send({ type: "ready" });
      const unsubscribe = await subscribeToChanges((cursor) => send({ type: "changed", cursor }));

      // Comment frames keep proxies from closing an idle connection.
      const heartbeat = setInterval(() => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          open = false;
        }
      }, 25_000);

      const close = () => {
        if (!open) return;
        open = false;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the client going away.
        }
      };

      request.signal.addEventListener("abort", close);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      // Tells nginx not to buffer, which would otherwise hold every event.
      "x-accel-buffering": "no",
    },
  });
}
