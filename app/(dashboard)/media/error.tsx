"use client";

import { PageHeading } from "@/components/ui";

export default function MediaError({ retry }: { error: unknown; retry: () => void }) {
  return <>
    <PageHeading title="Media saya" />
    <div className="card stack" role="alert">
      <h2>Daftar media belum bisa dimuat</h2>
      <p className="muted">Server tidak menjawab dengan benar. Muat ulang. Kalau masih gagal, keluar lalu masuk lagi, atau hubungi pemilik.</p>
      <div className="actions"><button type="button" className="btn btn-primary" onClick={() => retry()}>Muat ulang</button></div>
    </div>
  </>;
}
