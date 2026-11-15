/** Plain-language cause and next step for a failed publication, keyed by the error code stored on the target. */
const reasons: Record<string, string> = {
  DOMAIN_NOT_READY: "Alamat situs belum aktif atau belum dikonfirmasi. Periksa alamatnya di Media saya, lalu coba lagi.",
  ARTICLE_VERSION_NOT_APPROVED: "Naskah berubah setelah disetujui. Periksa dan setujui versi terbarunya, lalu terbitkan lagi.",
  ARTICLE_INELIGIBLE: "Naskah sudah ditolak atau diarsipkan, jadi tidak bisa terbit.",
  NOT_FOUND: "Data penerbitan tidak ditemukan. Hubungi admin.",
  UNPUBLISHED: "Naskah ditarik dari publikasi oleh tim.",
};

export function publishFailureReason(code: string | null | undefined): string {
  if (code && reasons[code]) return reasons[code];
  return "Penerbitan gagal di sistem. Coba lagi. Kalau tetap gagal, hubungi admin.";
}

/** Where the user can fix the cause of a failed publication, when there is such a place. */
export function publishFailureFix(code: string | null | undefined): { href: string; label: string } | undefined {
  return code === "DOMAIN_NOT_READY" ? { href: "/media", label: "Atur alamat situs" } : undefined;
}

/** Turns an error from POST /api/publish into one plain sentence with the fix, plus a link when the fix lives on another page. */
export function plainPublishError(message: string | undefined, status: number, fallback: string): { text: string; fix?: { href: string; label: string } } {
  const mediaMissing = message?.match(/^Media (.+) requires an active verified canonical domain/);
  if (mediaMissing) return { text: `Media ${mediaMissing[1]} belum punya alamat situs yang dikonfirmasi. Konfirmasi alamatnya, lalu coba lagi.`, fix: { href: "/media", label: "Atur alamat situs" } };
  if (message && /no reviewer approval for its current version|invalid approval evidence/i.test(message)) return { text: "Naskah berubah setelah disetujui. Setujui versi terbarunya, lalu terbitkan lagi." };
  if (message && /every selected article must be approved/i.test(message)) return { text: "Ada naskah yang belum disetujui atau sudah tidak bisa terbit. Muat ulang halaman, lalu coba lagi." };
  if (message && /scheduled time must be in the future/i.test(message)) return { text: "Waktu terbit sudah lewat. Pilih waktu di masa depan." };
  if (message && /every selected target must exist and have failed/i.test(message)) return { text: "Penerbitan ini sudah tidak berstatus gagal. Muat ulang halaman untuk melihat yang terbaru." };
  if (status === 403 || status === 401) return { text: "Akun Anda tidak bisa menerbitkan. Minta pemilik, admin, atau penerbit untuk menerbitkannya." };
  if (status === 429 && message) return { text: message };
  return { text: fallback };
}
