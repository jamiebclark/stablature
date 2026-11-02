import { PlayView } from "@/components/app/PlayView";

export default async function PlayPage({ params }: { params: Promise<{ songId: string }> }) {
  const { songId } = await params;
  return <PlayView songId={songId} />;
}
