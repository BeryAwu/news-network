export type AssetLicenseEvidence = {
  licenseType: string;
  sourceUrl?: string;
  licenseUrl?: string;
  credit: string;
  attributionText: string;
  generationPrompt?: string;
};

export function assetLicenseRequirementError(input: AssetLicenseEvidence): string | null {
  if (["CC0", "CC_BY", "CC_BY_SA"].includes(input.licenseType) && (!input.sourceUrl || !input.licenseUrl)) return "Tambahkan tautan sumber gambar dan teks lisensi untuk memeriksa hak penggunaannya.";
  if (["CC_BY", "CC_BY_SA"].includes(input.licenseType) && !input.attributionText.trim() && !input.credit.trim()) return "Lisensi CC BY meminta teks atribusi atau nama kreator.";
  if (input.licenseType === "PUBLIC_DOMAIN" && !input.sourceUrl) return "Tambahkan tautan yang membuktikan gambar berasal dari sumber domain publik.";
  if (input.licenseType === "AI_GENERATED" && !input.generationPrompt?.trim()) return "Tambahkan prompt atau deskripsi pembuat gambar AI.";
  if (input.licenseType === "OTHER" && !input.attributionText.trim()) return "Jelaskan dasar izin gambar pada teks atribusi.";
  return null;
}
