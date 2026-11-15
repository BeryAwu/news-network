"use client";

import { PageHeading } from "@/components/ui";

export default function UsersError({ retry }: { error: unknown; retry: () => void }) {
  return <>
    <PageHeading title="Tim dan akses" />
    <div className="card stack" role="alert">
      <h2>Daftar tim belum bisa dimuat</h2>
      <p className="muted">Halaman ini hanya bisa dibuka oleh pemilik, dan server tidak menjawab dengan benar. Muat ulang. Kalau masih gagal, keluar lalu masuk lagi.</p>
      <div className="actions"><button type="button" className="btn btn-primary" onClick={() => retry()}>Muat ulang</button></div>
    </div>
  </>;
}
