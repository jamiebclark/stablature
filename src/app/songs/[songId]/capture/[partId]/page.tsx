import { CaptureScreen } from "@/components/capture/CaptureScreen";

/** Capture a specific part. Linkable, and survives a reload. */
export default async function CapturePartPage({
  params,
}: {
  params: Promise<{ songId: string; partId: string }>;
}) {
  const { songId, partId } = await params;
  return <CaptureScreen songId={songId} partId={partId} />;
}
