import { SongView } from "@/components/app/SongView";

export default async function SongPage({ params }: { params: Promise<{ songId: string }> }) {
  const { songId } = await params;
  return <SongView songId={songId} />;
}
