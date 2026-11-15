import { PageHeading } from "@/components/ui";
import "@/app/css/connections.css";

export default function Loading() {
  return <>
    <PageHeading title="Koneksi layanan" subtitle="Cek apakah layanan di balik aplikasi sudah tersambung." />
    <div className="connections-skeleton" role="status" aria-label="Memeriksa layanan">
      <div className="skeleton" /><div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
    </div>
  </>;
}
