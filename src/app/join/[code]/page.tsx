import { JoinBand } from "@/components/app/JoinBand";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinBand code={code} />;
}
