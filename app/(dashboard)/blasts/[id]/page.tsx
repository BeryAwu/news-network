import BlastHub from "@/components/blast-hub";
import { requireUser } from "@/lib/auth";
import "@/app/css/blasts.css";

export const dynamic = "force-dynamic";

export default async function BlastPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  return <BlastHub id={id} />;
}
