/**
 * Skills panduan gaya penulisan untuk AI artikel. Setiap skill adalah instruksi
 * prompt yang bisa diaktifkan per media. Guidance diuji dari pola narasi
 * humas instansi (contoh: rekap amplifikasi kegiatan Polres Metro Tangerang Kota).
 */
export interface WritingSkill {
  slug: string;
  name: string;
  description: string;
  promptGuidance: string;
}

export const WRITING_SKILLS: WritingSkill[] = [
  {
    slug: "humas-instansi",
    name: "Narasi humas instansi",
    description:
      "Gaya berita resmi kehumasan: langsung ke pokok kegiatan, menyebut instansi dan lokasi, menonjolkan hasil, serta netral namun menampilkan peran aparat/instansi.",
    promptGuidance:
      "Tulis dengan gaya berita resmi kehumasan instansi. Judul informatif ringkas: siapa (instansi/satuan), apa (kegiatan/operasi), di mana, dan hasil nyata. Bukalah paragraf pertama dengan pokok kegiatan dan lokasi. Gunakan kata kerja aksi resmi yang lazim (menggelar, mengamankan, menyisir, menindaklanjuti, mengantisipasi). Beri penekanan pada peran dan hasil: situasi kondusif, jumlah temuan, tindakan yang diambil, dan himbauan kepada masyarakat. Hindari spekulasi, dramatisasi berlebihan, atau menyebut orang tidak dikenal tanpa keterangan resmi. Akhiri dengan penutup ringkas: peran instansi dan ajakan bersama menjaga keteraturan/kamtibmas. Jangan menambahkan kutipan, data, atau kewenangan yang tidak ada dalam bahan yang disuplai.",
  },
];

export function getWritingSkill(slug: string | undefined | null): WritingSkill | undefined {
  if (!slug) return undefined;
  return WRITING_SKILLS.find((skill) => skill.slug === slug);
}

/**
 * Menggabungkan panduan gaya dari semua skill aktif untuk sebuah media.
 * `db` bertipe Prisma client/transaction client agar bisa dipakai di route mana pun.
 */
export async function enabledWritingGuidance(db: { mediaWritingSkill: { findMany: (args: { where: { mediaSiteId: string; enabled: boolean; skill: { isActive: boolean } }; include: { skill: { select: { promptGuidance: true } } } }) => Promise<{ skill: { promptGuidance: string } }[]> } }, mediaSiteId: string): Promise<string> {
  const rows = await db.mediaWritingSkill.findMany({
    where: { mediaSiteId, enabled: true, skill: { isActive: true } },
    include: { skill: { select: { promptGuidance: true } } },
  });
  return rows.map((row) => row.skill.promptGuidance).filter(Boolean).join("\n\n");
}
