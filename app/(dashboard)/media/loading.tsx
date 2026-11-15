import { PageHeading } from "@/components/ui";
import "@/app/css/media.css";

export default function Loading() {
  return <>
    <PageHeading title="Media saya" subtitle="Setiap media punya langkah penyiapan sendiri. Selesaikan ketiganya supaya naskah bisa terbit." />
    <div className="media-skeleton" role="status" aria-label="Memuat daftar media">
      <div className="skeleton" /><div className="skeleton" />
    </div>
  </>;
}
