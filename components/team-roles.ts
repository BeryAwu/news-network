/** Role names and one-sentence meaning, used by the team list and the add-member form. Values match the Role enum and /api/users. */
export const roleNames: Record<string, string> = { OWNER: "Pemilik", ADMIN: "Admin", EDITOR: "Editor", REVIEWER: "Pemeriksa", PUBLISHER: "Penerbit", OPERATOR: "Operator" };

export const assignableRoles = [
  { value: "OPERATOR", name: "Operator", meaning: "Menulis, memeriksa, dan menerbitkan sendiri. Hanya ke media yang Anda tautkan kepadanya. Cocok untuk orang yang mengoperasikan media setiap hari." },
  { value: "ADMIN", name: "Admin", meaning: "Mengelola semua media, alamat situs, dan koneksi layanan. Otomatis bisa membuka semua media." },
  { value: "EDITOR", name: "Editor", meaning: "Menulis berita dan meminta AI menulis, ke media yang Anda tautkan kepadanya." },
  { value: "REVIEWER", name: "Pemeriksa", meaning: "Membaca berita, lalu menyetujui, meminta perbaikan, atau menolak." },
  { value: "PUBLISHER", name: "Penerbit", meaning: "Menerbitkan atau menjadwalkan berita yang sudah disetujui." },
] as const;

export const ownerMeaning = "Pemilik mengatur tim dan semua pengaturan. Akun pemilik dibuat saat aplikasi pertama kali disiapkan, jadi tidak bisa ditambahkan dari sini.";
