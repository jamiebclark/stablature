import { CaptureScreen } from "@/components/capture/CaptureScreen";

/**
 * Capture with no part named: the screen opens the most recent one.
 *
 * Selecting a part navigates to the sibling route below, so the open part is
 * always reflected in the URL once the user has chosen one.
 */
export default async function CapturePage({ params }: { params: Promise<{ songId: string }> }) {
  const { songId } = await params;
  return <CaptureScreen songId={songId} />;
}
