import { TuningsView } from "@/components/app/TuningsView";

export default async function TuningsPage({ params }: { params: Promise<{ bandId: string }> }) {
  const { bandId } = await params;
  return <TuningsView bandId={bandId} />;
}
