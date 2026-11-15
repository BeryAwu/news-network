import { PageHeading } from "@/components/ui";
import "@/app/css/team.css";

export default function Loading() {
  return <>
    <PageHeading title="Tim dan akses" subtitle="Tambahkan orang ke redaksi, tentukan peran mereka, dan pilih media yang boleh mereka buka." />
    <div className="card flush team-skeleton" role="status" aria-label="Memuat daftar tim">
      <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
    </div>
  </>;
}
