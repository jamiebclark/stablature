import Link from "next/link";

/**
 * Shown when a page is requested that was never cached and the network is
 * gone. Deliberately reassuring: nothing has been lost, because nothing was
 * ever stored on the server first.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-16 text-center">
      <h1 className="mb-2 text-xl font-semibold tracking-tight">No connection</h1>
      <p className="mb-6 text-sm text-text-dim">
        This page has not been opened on this device before, so there is nothing cached
        to show. Anything you have already captured is safe and still here.
      </p>
      <Link href="/" className="text-sm text-accent hover:underline">
        Back to your bands
      </Link>
    </main>
  );
}
