import { PageHeading } from "@/components/ui";
import "@/app/css/briefs.css";

export default function Loading() {
  return <>
    <PageHeading title="Tulis berita" subtitle="Tulis satu narasi, pilih media yang menerimanya, lalu pilih ditulis AI atau dipakai apa adanya. Anda memeriksa semuanya sebelum terbit."/>
    <div role="status" aria-label="Memuat halaman" className="stack">
      <div className="skeleton bf-skeleton-form"/>
    </div>
  </>;
}
