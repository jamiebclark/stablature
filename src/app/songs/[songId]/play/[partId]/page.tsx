import { PlayView } from "@/components/app/PlayView";

/** Play one part of a song. Linkable, and survives a reload. */
export default async function PlayPartPage({
  params,
}: {
  params: Promise<{ songId: string; partId: string }>;
}) {
  const { songId, partId } = await params;
  return <PlayView songId={songId} partId={partId} />;
}
