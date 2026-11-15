import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
export { Card, CardContent };
export { Button } from "@/components/ui/button";
export { Badge };

export function PageHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="subtitle">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <Card>
      <div className="stat">
        <span className="stat-label">{label}</span>
        <span className="stat-figure">{value}</span>
        {detail && <span className="stat-hint">{detail}</span>}
      </div>
    </Card>
  );
}

/** What belongs here, and the one action that fills it. */
export function EmptyState({ title, detail, href, label }: { title: string; detail: string; href?: string; label?: string }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      <span>{detail}</span>
      {href && label && <Link className="btn btn-primary" href={href}>{label}</Link>}
    </div>
  );
}

const statusLabels: Record<string, string> = {
  DRAFT: "Draf", GENERATING: "Sedang dibuat", NEEDS_REVIEW: "Perlu diperiksa", IN_REVISION: "Perlu diperbaiki", APPROVED: "Siap terbit", REJECTED: "Ditolak",
  PUBLISHED: "Sudah terbit", PUBLISH_FAILED: "Gagal terbit", ARCHIVED: "Diarsipkan", QUEUED: "Dalam antrean", SCHEDULED: "Terjadwal", PUBLISHING: "Sedang terbit",
  FAILED: "Gagal", CANCELLED: "Dibatalkan", SUCCESS: "Berhasil", SUCCEEDED: "Berhasil", BLOCKED: "Diblokir", PENDING: "Menunggu", VERIFIED: "Terverifikasi",
  ACTIVE: "Aktif", INACTIVE: "Nonaktif", DISABLED: "Nonaktif", PAUSED: "Dijeda", INVITED: "Diundang", READY: "Siap", CONFIGURED: "Sudah disetel",
  CREDENTIALS_CONFIGURED: "Sudah disetel", NOT_CONFIGURED: "Belum disetel", SETUP_REQUIRED: "Perlu disiapkan", OPTIONAL: "Opsional", INLINE_MODE: "Terbit langsung",
  BULLMQ_CONFIGURED: "Antrean aktif", DATABASE_CONNECTED: "Terhubung", TEST_ADAPTER: "Mode uji", UNSUPPORTED_PROVIDER: "Penyedia tidak didukung",
  AI_GENERATED: "Ilustrasi AI", USER_PROVIDED: "Izin dari pengguna", PUBLIC_DOMAIN: "Domain publik", CC0: "CC0", CC_BY: "CC BY", CC_BY_SA: "CC BY-SA", OTHER: "Lisensi lain",
  SUPPORTED: "Didukung sumber", CONFLICTED: "Bertentangan", UNVERIFIED: "Belum terverifikasi", RETRIEVAL_SUCCESS: "Sumber terbaca", RETRIEVAL_FAILED: "Sumber gagal dibaca", RETRIEVAL_PENDING: "Sumber belum dibaca",
};
const good = new Set(["approved", "published", "active", "verified", "succeeded", "success", "supported"]);
const bad = new Set(["failed", "publish_failed", "rejected", "disabled", "blocked", "unsupported_provider", "conflicted"]);
const attention = new Set(["needs_review", "scheduled", "queued", "pending", "draft", "generating", "in_revision", "paused", "setup_required", "unverified"]);

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const variant = good.has(normalized) ? "success" : bad.has(normalized) ? "destructive" : attention.has(normalized) ? "warning" : "default";
  const labelKey = status.toUpperCase().replaceAll(/[ -]+/g, "_");
  return <Badge variant={variant}>{statusLabels[labelKey] || status.replaceAll("_", " ")}</Badge>;
}
