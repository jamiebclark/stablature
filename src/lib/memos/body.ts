/** Reading an upload's body without ever holding more than the cap allows. */

export type Capped = { ok: true; bytes: Uint8Array } | { ok: false; reason: "too_large" | "incomplete" };

/**
 * Read a stream, giving up the moment it passes `max`.
 *
 * Sums each chunk as it arrives. The stream is cancelled at once on crossing,
 * so at most `max` plus one chunk is ever held, and no further chunk is pulled.
 * A null stream or a read error is `incomplete`.
 */
export async function readCapped(
  stream: ReadableStream<Uint8Array> | null,
  max: number,
): Promise<Capped> {
  if (!stream) return { ok: false, reason: "incomplete" };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "incomplete" };
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return { ok: true, bytes };
}
