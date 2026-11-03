"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DashboardSnapshot } from "@/lib/dashboard";
import { StatusBadge } from "@/components/ui";

const pipeline = [
  ["DRAFT", "Draf"],
  ["GENERATING", "Sedang dibuat"],
  ["NEEDS_REVIEW", "Perlu ditinjau"],
  ["IN_REVISION", "Perlu perbaikan"],
  ["APPROVED", "Siap diterbitkan"],
  ["PUBLISHED", "Sudah terbit"],
  ["REJECTED", "Ditolak"]
] as const;

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
function formatDate(value: string) {
  return new Date(value).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export default function DashboardLiveSummary({ initialSnapshot, userRoles }: { initialSnapshot: DashboardSnapshot; userRoles: string[] }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [checkedAt, setCheckedAt] = useState(initialSnapshot.checkedAt);
  const [refreshState, setRefreshState] = useState<"ready" | "refreshing" | "error">("ready");
  const [errorMessage, setErrorMessage] = useState("");

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setRefreshState("refreshing");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store", signal });
      if (!response.ok) throw new Error(response.status === 401 ? "Sesi berakhir. Masuk kembali untuk memperbarui data." : "Tidak dapat memperbarui ringkasan saat ini.");
      const next = await response.json() as DashboardSnapshot;
      setSnapshot(next);
      setCheckedAt(new Date().toISOString());
      setErrorMessage("");
      setRefreshState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setErrorMessage(error instanceof Error ? error.message : "Tidak dapat memperbarui ringkasan saat ini.");
      setRefreshState("error");
    }
  }, []);

  useEffect(() => {
    let controller: AbortController | null = null;
    const poll = () => {
      if (document.visibilityState !== "visible") return;
      controller?.abort();
      controller = new AbortController();
      void refresh(controller.signal);
    };
    const interval = window.setInterval(poll, 30_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", poll);
      controller?.abort();
    };
  }, [refresh]);

  const { counts } = snapshot;
  const canManageMedia = userRoles.some((role) => ["OWNER", "ADMIN"].includes(role));
  const canCreateBrief = userRoles.some((role) => ["OWNER", "ADMIN", "EDITOR"].includes(role));
  const canEditArticles = canCreateBrief;
  const canReviewArticles = userRoles.some((role) => ["OWNER", "ADMIN", "REVIEWER"].includes(role));
  const canPublishArticles = userRoles.some((role) => ["OWNER", "ADMIN", "PUBLISHER"].includes(role));
  const nextStep = counts.mediaSites === 0
    ? canManageMedia
      ? { title: "Tambahkan media pertama", description: "Buat profil penerbit sebelum memasukkan sumber dan menyiapkan naskah.", href: "/media", action: "Tambah media" }
      : { title: "Minta akses media", description: "Akun ini belum diberi akses ke media mana pun. Minta pemilik newsroom menambahkan akses Anda.", href: "/media", action: "Lihat media" }
    : counts.sourceBriefs === 0 && counts.articles === 0
      ? canCreateBrief
        ? { title: "Buat brief sumber pertama", description: "Masukkan konteks dan referensi yang akan menjadi dasar naskah.", href: "/briefs", action: "Buat brief" }
        : { title: "Belum ada brief sumber", description: "Minta editor menambahkan informasi sumber. Brief dan naskah baru akan muncul di sini.", href: "/briefs", action: "Lihat brief" }
      : (counts.articleStatuses.NEEDS_REVIEW || 0) > 0
        ? canReviewArticles
          ? { title: "Tinjau naskah yang menunggu", description: "Periksa klaim dan bukti sebelum menyetujui artikel.", href: "/editorial?status=NEEDS_REVIEW", action: "Tinjau naskah" }
          : { title: "Naskah menunggu tinjauan", description: "Naskah siap diperiksa oleh reviewer. Anda dapat melihat antreannya.", href: "/editorial?status=NEEDS_REVIEW", action: "Lihat antrean" }
        : (counts.articleStatuses.IN_REVISION || 0) > 0
          ? canEditArticles
            ? { title: "Perbaiki naskah", description: "Buka catatan reviewer dan selesaikan perubahan yang diminta.", href: "/editorial", action: "Buka naskah" }
            : { title: "Naskah menunggu perbaikan", description: "Perubahan yang diminta reviewer sedang menunggu editor.", href: "/editorial", action: "Lihat naskah" }
          : (counts.publicationStatuses.FAILED || 0) > 0
            ? canPublishArticles
              ? { title: "Periksa publikasi yang gagal", description: `${counts.publicationStatuses.FAILED} tujuan publikasi gagal. Tinjau pesan error sebelum mencoba ulang.`, href: "/publishing", action: "Periksa publikasi" }
              : { title: "Ada publikasi yang gagal", description: `${counts.publicationStatuses.FAILED} tujuan gagal dan perlu ditinjau penerbit.`, href: "/publishing", action: "Lihat hasil" }
            : counts.approvedArticlesWithoutReadyDomain > 0
              ? canManageMedia
                ? { title: "Siapkan domain media", description: `${counts.approvedArticlesWithoutReadyDomain} naskah yang disetujui masih memerlukan domain utama yang aktif dan terverifikasi.`, href: "/media", action: "Atur domain" }
                : { title: "Domain media belum siap", description: "Naskah yang disetujui menunggu domain terverifikasi dari administrator.", href: "/publishing", action: "Lihat publikasi" }
              : (counts.articleStatuses.APPROVED || 0) > 0
                ? canPublishArticles
                  ? { title: "Terbitkan naskah yang disetujui", description: "Pilih domain terverifikasi dan pantau hasil untuk setiap tujuan.", href: "/publishing", action: "Buka publikasi" }
                  : { title: "Naskah siap diterbitkan", description: "Editor telah menyetujuinya. Penerbit dapat menjalankan publikasi dan melihat hasilnya.", href: "/publishing", action: "Lihat naskah" }
                : (counts.articleStatuses.DRAFT || 0) > 0
                  ? canEditArticles
                    ? { title: "Lanjutkan menyiapkan draf", description: "Buka naskah untuk memeriksa isinya dan melanjutkan proses tinjauan.", href: "/editorial", action: "Lihat draf" }
                    : { title: "Draf sedang disiapkan", description: "Editor sedang menyiapkan naskah. Statusnya akan diperbarui di sini.", href: "/editorial", action: "Lihat draf" }
                  : counts.articles === 0
                    ? canEditArticles
                      ? { title: "Buat draf dari brief", description: "Buka tinjauan naskah untuk membuat draf sesuai profil media.", href: "/editorial", action: "Buat draf" }
                      : { title: "Belum ada naskah", description: "Naskah akan muncul setelah editor membuat draf dari brief.", href: "/editorial", action: "Lihat naskah" }
                    : canCreateBrief
                      ? { title: "Siapkan brief berikutnya", description: "Setiap brief dapat menghasilkan draf sesuai profil media yang dipilih.", href: "/briefs", action: "Buat brief" }
                      : { title: "Tidak ada tindakan tertunda", description: "Ringkasan ini akan diperbarui saat editor menambahkan naskah baru.", href: "/editorial", action: "Lihat naskah" };

  return <div className="dashboard-live">
    <div className="dashboard-kpis" aria-label="Statistik ruang redaksi">
      <article className="card dashboard-kpi"><span className="muted">Media terdaftar</span><strong className="metric">{counts.mediaSites}</strong><span className="muted kpi-detail">{counts.activeMediaSites} aktif · {counts.verifiedDomains} domain terverifikasi</span></article>
      <article className="card dashboard-kpi"><span className="muted">Brief aktif</span><strong className="metric">{counts.sourceBriefs}</strong><span className="muted kpi-detail">Brief yang belum diarsipkan</span></article>
      <article className="card dashboard-kpi dashboard-kpi-attention"><span className="muted">Naskah perlu ditinjau</span><strong className="metric">{counts.articleStatuses.NEEDS_REVIEW || 0}</strong><span className="muted kpi-detail">Menunggu keputusan reviewer</span></article>
      <article className="card dashboard-kpi"><span className="muted">Target publikasi gagal</span><strong className="metric">{counts.publicationStatuses.FAILED || 0}</strong><span className="muted kpi-detail">Periksa detail sebelum mencoba ulang</span></article>
    </div>

    <section className="card next-step-card" aria-labelledby="next-step-title">
      <div className="next-step-copy"><span className="eyebrow">Langkah berikutnya</span><h2 id="next-step-title">{nextStep.title}</h2><p className="muted">{nextStep.description}</p></div>
      <Link href={nextStep.href} className="btn btn-primary">{nextStep.action}</Link>
    </section>

    {counts.articles === 0 && <div className="notice dashboard-empty-note">Belum ada naskah. Statistik akan bertambah setelah data editorial dibuat.</div>}

    <div className="dashboard-panels">
      <section className="card" aria-labelledby="editorial-pipeline-title">
        <div className="panel-heading"><div><h2 id="editorial-pipeline-title">Alur naskah</h2><p className="muted">Status saat ini untuk naskah dalam media yang dapat Anda akses.</p></div><Link href="/editorial" className="btn">Lihat semua</Link></div>
        <div className="pipeline-list">{pipeline.map(([status, label]) => <div className="pipeline-row" key={status}><span>{label}</span><StatusBadge status={status}/><strong>{counts.articleStatuses[status] || 0}</strong></div>)}</div>
      </section>

      <section className="card" aria-labelledby="publication-activity-title">
        <div className="panel-heading"><div><h2 id="publication-activity-title">Aktivitas publikasi</h2><p className="muted">Pembaruan enam target publikasi terakhir.</p></div><Link href="/publishing" className="btn">Buka publikasi</Link></div>
        {snapshot.latestTargets.length > 0 ? <div className="activity-list">{snapshot.latestTargets.map((target) => <article className="activity-row" key={target.id}>
          <div className="activity-copy"><strong>{target.articleTitle}</strong><span>{target.mediaName} · {target.hostname}</span><time dateTime={target.updatedAt}>{formatDate(target.updatedAt)}</time>{target.status === "FAILED" && target.lastErrorMessage && <span className="activity-error">{target.lastErrorMessage}</span>}</div>
          <StatusBadge status={target.status}/>
        </article>)}</div> : <div className="empty activity-empty"><strong>Belum ada aktivitas publikasi</strong><span>Target akan muncul setelah naskah disetujui dan dikirim ke domain.</span></div>}
      </section>
    </div>

    <div className={`dashboard-refresh dashboard-refresh-${refreshState}`} role={refreshState === "error" ? "alert" : undefined} aria-live={refreshState === "error" ? "assertive" : "off"}>
      <span className="refresh-dot" aria-hidden="true"/>
      <span>{refreshState === "refreshing" ? "Memperbarui statistik…" : refreshState === "error" ? `Pembaruan gagal · data terakhir diperiksa pukul ${formatTime(checkedAt)}` : `Data terakhir diperbarui pukul ${formatTime(checkedAt)}`}</span>
      {refreshState === "error" && <span className="refresh-error-detail">{errorMessage}</span>}
      <button className="refresh-button" type="button" onClick={() => void refresh()} disabled={refreshState === "refreshing"}>Perbarui</button>
      <span className="refresh-interval">Otomatis tiap 30 detik saat halaman terbuka</span>
    </div>
  </div>;
}
