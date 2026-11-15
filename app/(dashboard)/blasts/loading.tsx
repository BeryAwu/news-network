import { PageHeading } from "@/components/ui";
import { BlastListSkeleton } from "@/components/blast-skeletons";

export default function Loading() {
  return (
    <>
      <PageHeading title="Daftar berita" subtitle="Semua berita yang pernah Anda tulis. Buka satu berita untuk memeriksa, menerbitkan, atau mengambil link-nya." />
      <BlastListSkeleton />
    </>
  );
}
