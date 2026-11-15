import { redirect } from "next/navigation";
import { visibleMedia } from "@/lib/dashboard";
import { requireUser } from "@/lib/auth";
import { aiConfiguration } from "@/lib/ai";
import { PageHeading } from "@/components/ui";
import BriefForm from "@/components/brief-form";
import "@/app/css/briefs.css";

export const dynamic = "force-dynamic";

export default async function BriefsPage() {
  const [media, user] = await Promise.all([visibleMedia(), requireUser()]);
  const canEdit = user.roles.some((assignment) => ["OWNER", "ADMIN", "EDITOR"].includes(assignment.role));
  const isAdmin = user.roles.some((assignment) => ["OWNER", "ADMIN"].includes(assignment.role));
  if (!media.length && canEdit && isAdmin) redirect("/media?first=1");
  const ai = await aiConfiguration();
  const testMode = ai.mode === "test adapter";
  const aiState = { ready: ai.configured && !testMode, testMode };

  return <>
    <PageHeading title="Tulis berita" subtitle="Tulis satu narasi, pilih media yang menerimanya, lalu pilih ditulis AI atau dipakai apa adanya. Anda memeriksa semuanya sebelum terbit."/>
    {canEdit && <BriefForm ai={aiState} isAdmin={isAdmin}/>}
    {!canEdit && <div className="notice">Menulis berita memerlukan peran editor atau operator. Berita yang sudah ada bisa Anda lihat di Daftar berita.</div>}
  </>;
}
