import { PageHeading } from "@/components/ui";
import "@/app/css/reports.css";

export default function Loading() {
  return <>
    <PageHeading title="Laporan" subtitle="Lihat berapa berita yang sudah terbit di tiap media, lalu unduh daftarnya." />
    <div className="rep-skeleton" role="status" aria-label="Memuat laporan">
      <div className="skeleton" /><div className="skeleton" /><div className="skeleton rep-sk-tall" />
    </div>
  </>;
}
