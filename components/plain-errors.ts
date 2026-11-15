/** Turns API failures into one plain Indonesian message (cause plus fix), and names the field when the API says which one. */

export type ApiBody = { error?: string; details?: { path: string; message: string }[] };

export class Failure extends Error {
  constructor(message: string, readonly field: string | null = null) {
    super(message);
  }
}

const known: [RegExp, (match: RegExpMatchArray) => string][] = [
  [/^Media not found\.?$/, () => "Media ini tidak ditemukan. Muat ulang halaman, lalu coba lagi."],
  [/^Domain not found\.?$/, () => "Alamat situs ini tidak ditemukan. Muat ulang halaman, lalu coba lagi."],
  [/^Category not found\.?$/, () => "Kategori ini tidak ditemukan. Muat ulang halaman, lalu coba lagi."],
  [/^Email sudah terdaftar\.?$/, () => "Email ini sudah punya akun. Pakai email lain, atau aktifkan lagi akun yang sudah ada di daftar tim."],
  [/^Slug media sudah digunakan/, () => "Nama ini sudah dipakai media lain. Ubah sedikit nama atau kode media."],
  [/^Hostname sudah terdaftar/, () => "Alamat situs ini sudah dipakai media lain. Pakai alamat yang berbeda."],
  [/^User not found\.?$/, () => "Akun ini tidak ditemukan. Muat ulang halaman, lalu coba lagi."],
  [/^Media access denied\.?$/, () => "Akun Anda belum diberi akses ke media ini. Minta pemilik menambahkannya."],
  [/^Unknown media scope\.?$/, () => "Salah satu media yang dipilih tidak ditemukan. Muat ulang halaman, lalu pilih lagi."],
  [/^A category with this name already exists\.?$/, () => "Kategori dengan nama ini sudah ada. Pakai nama lain."],
  [/^Category is used by (\d+) article/, (m) => `Kategori ini dipakai ${m[1]} naskah. Pindahkan naskahnya ke kategori lain, lalu hapus.`],
  [/^Published media cannot change its public slug\.?$/, () => "Media yang sudah punya naskah terbit tidak boleh mengganti kode medianya. Kembalikan kode yang lama."],
  [/^Owner accounts cannot be disabled/, () => "Akun pemilik tidak bisa dinonaktifkan."],
  [/^Category name is required\.?$/, () => "Tulis nama kategori dulu."],
];

export function failure(status: number, body: ApiBody, fields: Record<string, string>, fallback: string): Failure {
  const detail = body.details?.find((item) => fields[item.path]);
  if (detail) return new Failure(fields[detail.path], detail.path);
  if (body.details?.length) return new Failure("Ada isian yang belum benar. Periksa form ini, lalu coba lagi.", body.details[0]?.path ?? null);
  if (status === 401) return new Failure("Sesi Anda sudah habis. Masuk lagi, lalu ulangi langkah ini.");
  if (status === 403) return new Failure("Akun Anda tidak punya izin untuk tindakan ini. Minta pemilik atau admin yang melakukannya.");
  const message = body.error?.trim();
  if (!message) return new Failure(fallback);
  for (const [pattern, build] of known) {
    const match = message.match(pattern);
    if (match) return new Failure(build(match));
  }
  return new Failure(status >= 500 ? fallback : message);
}

export function asFailure(error: unknown, fallback: string): Failure {
  if (error instanceof Failure) return error;
  if (error instanceof TypeError) return new Failure("Server tidak terjangkau. Periksa koneksi internet, lalu coba lagi.");
  return new Failure(fallback);
}

export async function readBody(response: Response): Promise<ApiBody & Record<string, unknown>> {
  try {
    return await response.json();
  } catch {
    return {};
  }
}
