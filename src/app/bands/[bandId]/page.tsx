import { BandView } from "@/components/app/BandView";

export default async function BandPage({ params }: { params: Promise<{ bandId: string }> }) {
  const { bandId } = await params;
  return <BandView bandId={bandId} />;
}
