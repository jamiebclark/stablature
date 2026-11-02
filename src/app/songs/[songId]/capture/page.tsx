import { CaptureScreen } from "@/components/capture/CaptureScreen";

export default async function CapturePage({
  params,
}: {
  params: Promise<{ songId: string }>;
}) {
  const { songId } = await params;
  return <CaptureScreen songId={songId} />;
}
