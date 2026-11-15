"use client";

import { PageHeading } from "@/components/ui";

export default function SettingsError({ retry }: { error: unknown; retry: () => void }) {
  return <>
    <PageHeading title="Koneksi layanan" />
    <div className="card stack" role="alert">
      <h2>Status layanan belum bisa dimuat</h2>
      <p className="muted">Halaman ini hanya untuk pemilik dan admin, dan server tidak menjawab dengan benar. Muat ulang. Kalau masih gagal, keluar lalu masuk lagi.</p>
      <div className="actions"><button type="button" className="btn btn-primary" onClick={() => retry()}>Muat ulang</button></div>
    </div>
  </>;
}
