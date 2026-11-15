import Link from "next/link";
import "@/app/css/guide.css";
import { PageHeading } from "@/components/ui";
import CopyButton from "@/components/copy-button";

export const dynamic = "force-dynamic";

const sections = [
  { id: "gambaran", label: "Gambaran umum" },
  { id: "media", label: "1. Siapkan media" },
  { id: "alamat-situs", label: "2. Sambungkan alamat situs" },
  { id: "tulis", label: "3. Tulis berita" },
  { id: "daftar", label: "4. Daftar berita" },
  { id: "laporan", label: "5. Laporan" },
  { id: "peran", label: "Siapa boleh apa" },
  { id: "masalah", label: "Kalau ada masalah" },
  { id: "istilah", label: "Arti istilah" },
];

export default function GuidePage() {
  const serverIp = process.env.PUBLIC_SERVER_IP?.trim() || "";
  return (
    <>
      <PageHeading title="Panduan" subtitle="Dari nol sampai berita pertama terbit. Baca dari atas, atau lompat ke bagian yang Anda butuhkan." />
      <div className="guide">
        <nav className="guide-toc" aria-label="Isi panduan">
          <strong>Isi panduan</strong>
          {sections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.label}</a>)}
        </nav>

        <div className="guide-body">
          <section id="gambaran" className="guide-section">
            <h2>Gambaran umum</h2>
            <p className="guide-lede">Aplikasi ini mengelola beberapa situs berita sekaligus. Anda menulis satu narasi, memilih media mana saja yang menerimanya, lalu menerbitkannya. AI bisa membantu menulis, tapi tidak ada berita yang tayang sebelum Anda menekan tombol.</p>
            <ol className="guide-steps">
              <li><div><h3>Siapkan media</h3><p>Satu media adalah satu situs berita. Isi nama dan kategorinya.</p></div></li>
              <li><div><h3>Sambungkan alamat situs</h3><p>Alamat situs adalah nama yang diketik pembaca, misalnya beritakota.id. Langkah ini dilakukan sekali per media.</p></div></li>
              <li><div><h3>Tulis berita</h3><p>Tambah gambar, tulis narasi, pilih media, lalu pilih ditulis AI atau apa adanya.</p></div></li>
              <li><div><h3>Daftar berita</h3><p>Periksa hasilnya, lalu tekan Terbitkan. Link semua berita tersedia sesudahnya.</p></div></li>
              <li><div><h3>Laporan</h3><p>Lihat berapa berita terbit per media, dan unduh Excel atau PDF.</p></div></li>
            </ol>
            <p>Langkah 1 dan 2 cukup sekali di awal. Setelah itu Anda hanya mengulang Tulis berita dan Daftar berita setiap hari, dan membuka Laporan kapan pun perlu.</p>
          </section>

          <section id="media" className="guide-section">
            <h2>1. Siapkan media</h2>
            <p className="guide-lede">Buka <Link href="/media">Media saya</Link>, lalu tekan Tambah media.</p>
            <ol className="guide-steps">
              <li><div><h3>Isi empat kolom</h3><ul><li><b>Nama internal</b>: nama untuk Anda sendiri, misalnya &quot;Berita Kota&quot;.</li><li><b>Nama merek</b>: nama yang tampil di situs.</li><li><b>Nama redaksi</b>: nama yang muncul sebagai penulis, misalnya &quot;Redaksi Berita Kota&quot;. Pakai nama yang benar, jangan nama orang rekaan.</li><li><b>Alamat situs</b>: boleh dikosongkan dulu. Bagian 2 menjelaskannya.</li></ul></div></li>
              <li><div><h3>Atur tampilan dan gaya</h3><p>Buka Kelola media. Di sana Anda memilih warna situs, menulis tagline, dan menambah kategori seperti Ekonomi atau Olahraga. Di bagian Pengaturan lanjutan, tulis siapa penerbit dan pemilik situs. Teks itu tampil di bawah setiap halaman.</p></div></li>
            </ol>
          </section>

          <section id="alamat-situs" className="guide-section">
            <h2>2. Sambungkan alamat situs</h2>
            <p className="guide-lede">Alamat situs sama seperti alamat rumah. Pembaca mengetik beritakota.id, lalu internet perlu tahu komputer mana yang menyimpan situsnya. Anda memberi tahu itu lewat pengaturan di tempat Anda membeli nama alamat tersebut.</p>

            <svg className="guide-diagram" viewBox="0 0 720 150" role="img" aria-label="Pembaca mengetik beritakota.id, pengaturan DNS menunjuk ke server, server menampilkan situs">
              <rect x="10" y="40" width="190" height="70" rx="14" fill="var(--app-primary-soft)" stroke="var(--app-line-strong)" />
              <text x="105" y="70" textAnchor="middle" fontSize="15" fontWeight="700">Pembaca</text>
              <text x="105" y="92" textAnchor="middle" fontSize="13">mengetik beritakota.id</text>
              <path d="M200 75 H260" stroke="var(--app-muted)" strokeWidth="2" />
              <rect x="260" y="40" width="200" height="70" rx="14" fill="var(--app-surface-2)" stroke="var(--app-line-strong)" />
              <text x="360" y="70" textAnchor="middle" fontSize="15" fontWeight="700">Pengaturan DNS</text>
              <text x="360" y="92" textAnchor="middle" fontSize="13">&quot;alamat ini ada di IP …&quot;</text>
              <path d="M460 75 H520" stroke="var(--app-muted)" strokeWidth="2" />
              <rect x="520" y="40" width="190" height="70" rx="14" fill="var(--app-primary-soft)" stroke="var(--app-line-strong)" />
              <text x="615" y="70" textAnchor="middle" fontSize="15" fontWeight="700">Server kami</text>
              <text x="615" y="92" textAnchor="middle" fontSize="13">menampilkan situs Anda</text>
            </svg>

            <ol className="guide-steps">
              <li>
                <div>
                  <h3>Siapkan nama alamatnya</h3>
                  <p>Beli di penyedia nama alamat (domain), misalnya Niagahoster, Rumahweb, atau Namecheap. Kalau sudah punya, lanjut ke langkah berikutnya. Anda juga bisa memakai subdomain, misalnya berita.contoh.id.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Arahkan alamat itu ke server kami</h3>
                  <p>Masuk ke tempat Anda membeli alamat itu, lalu cari menu <b>DNS</b> atau <b>Kelola DNS</b>. Buat satu data baru dengan isi berikut, lalu simpan.</p>
                  <ul>
                    <li><b>Jenis</b> (Type): <code>A</code></li>
                    <li><b>Nama</b> (Host): <code>@</code> untuk alamat utama seperti beritakota.id. Untuk subdomain seperti berita.contoh.id, isi <code>berita</code>.</li>
                    <li><b>Nilai</b> (Points to / Value): alamat IP di bawah ini</li>
                    <li><b>TTL</b>: biarkan otomatis</li>
                  </ul>
                  {serverIp ? (
                    <div className="guide-ip"><span>Alamat IP server:</span><code>{serverIp}</code><CopyButton value={serverIp} label="Salin IP" /></div>
                  ) : (
                    <div className="notice notice-warn" style={{ marginTop: 12 }}>Alamat IP server belum dicantumkan di aplikasi. Tanyakan ke orang yang mengelola server Anda.</div>
                  )}
                  <p className="muted" style={{ marginTop: 12 }}>Kalau bingung, kirim IP ini ke penyedia alamat Anda dan minta: &quot;tolong arahkan alamat saya ke IP ini dengan data jenis A&quot;. Perubahan bisa aktif dalam beberapa menit, kadang sampai beberapa jam.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Tambahkan dan konfirmasi di aplikasi</h3>
                  <p>Buka <Link href="/media">Media saya</Link>, pilih media Anda, lalu buka tab Alamat situs. Tulis alamatnya saja, tanpa https://. Tekan Tambah alamat, lalu Konfirmasi alamat ini.</p>
                  <p>Aplikasi memeriksa apakah alamat itu sudah mengarah ke server kami, dan memberi tahu Anda kalau belum.</p>
                </div>
              </li>
              <li>
                <div>
                  <h3>Buka alamatnya di browser</h3>
                  <p>Ketik alamat Anda di browser. Gembok HTTPS muncul otomatis, biasanya dalam beberapa detik. Kalau belum ada berita, situsnya menampilkan &quot;Belum ada berita yang diterbitkan&quot;. Itu normal.</p>
                </div>
              </li>
            </ol>
            <p className="muted">Mau www.beritakota.id ikut bisa dibuka? Ulangi langkah 2 sampai 3 untuk www.beritakota.id sebagai alamat kedua.</p>
          </section>

          <section id="tulis" className="guide-section">
            <h2>3. Tulis berita</h2>
            <p className="guide-lede">Buka <Link href="/briefs">Tulis berita</Link>. Anda menulis satu narasi, dan satu isi berita yang sama dikirim ke semua media yang Anda pilih. Layar ini punya lima langkah dan selalu menunjukkan Anda ada di langkah berapa.</p>
            <ol className="guide-steps">
              <li><div><h3>Gambar</h3><p>Tambahkan satu gambar utama dan sampai empat gambar tambahan. Langkah ini boleh dilewati.</p></div></li>
              <li><div><h3>Narasi</h3><p>Tulis judul dan ceritakan beritanya dengan kata-kata Anda sendiri. Tidak perlu rapi. Tautan sumber boleh ditambahkan kalau ada.</p></div></li>
              <li><div><h3>Media</h3><p>Centang media yang akan menerima berita ini. Yang tampil hanya media yang sudah dihubungkan pemilik ke akun Anda.</p></div></li>
              <li><div><h3>Cara menulis</h3><ul><li><b>Minta AI menulis</b>: AI menulis satu artikel, lalu artikel yang sama dipakai di semua media. Anda bisa memilih gaya tulisan dan menambah catatan, misalnya &quot;singkat, tiga paragraf&quot;.</li><li><b>Pakai tulisan saya apa adanya</b>: narasi Anda diterbitkan tanpa diubah AI. Panjangnya minimal 120 karakter.</li></ul></div></li>
              <li><div><h3>Periksa dan kirim</h3><p>Baca ringkasannya, lalu tekan satu tombol. Anda langsung dibawa ke halaman berita itu.</p></div></li>
            </ol>
            <div className="notice notice-warn">Kalau AI menulis dari narasi pendek tanpa sumber, ia memakai pengetahuan umum. Cek semua fakta, angka, dan nama sebelum menerbitkan.</div>
          </section>

          <section id="daftar" className="guide-section">
            <h2>4. Daftar berita</h2>
            <p className="guide-lede">Buka <Link href="/blasts">Daftar berita</Link>. Setiap baris adalah satu berita yang dikirim ke beberapa media. Pemilik dan Admin melihat semua berita, pengguna lain melihat berita buatannya sendiri.</p>
            <ol className="guide-steps">
              <li><div><h3>Periksa</h3><p>Buka berita, lalu baca pratinjaunya sampai habis. Kalau ada yang salah, ubah isinya langsung dengan tangan.</p></div></li>
              <li><div><h3>Terbitkan</h3><p>Tekan satu tombol, Terbitkan ke N media. N adalah jumlah media yang Anda pilih. Media yang alamat situsnya belum dikonfirmasi dilewati, dan halaman menjelaskan mana yang kurang.</p></div></li>
              <li><div><h3>Sesudah terbit</h3><ul><li>Daftar link berita di setiap media.</li><li><b>Salin semua link</b>: semua link disalin sekaligus, satu baris per link.</li><li>Unduh Excel berisi semua link.</li><li>Unduh laporan Word dan PDF.</li></ul></div></li>
              <li><div><h3>Nama penulis dan Edit</h3><p>Nama Anda tampil di berita yang terbit. Saat Anda membuka link dari Daftar berita, tombol Edit muncul di situs. Hasil edit langsung tayang di semua media sekaligus.</p></div></li>
            </ol>
            <p className="muted">Berita bisa juga ditarik dari semua media lewat tombol di halaman berita itu.</p>
          </section>

          <section id="laporan" className="guide-section">
            <h2>5. Laporan</h2>
            <p className="guide-lede">Buka <Link href="/reports">Laporan</Link> untuk melihat berapa berita sudah terbit di tiap media.</p>
            <ol className="guide-steps">
              <li><div><h3>Pilih periode</h3><p>Pilih Hari ini, 7 hari terakhir, 30 hari terakhir, Bulan ini, atau Semua. Anda juga bisa mengisi tanggal sendiri, dan memilih media tertentu saja.</p></div></li>
              <li><div><h3>Lihat pantauan per media</h3><p>Tabel menunjukkan total berita terbit, terbit pada periode itu, kapan terakhir terbit, dan berapa yang masih menunggu. Media yang belum punya berita diberi tanda khusus.</p></div></li>
              <li><div><h3>Unduh laporan</h3><p>Tekan Unduh Excel atau Unduh PDF. Isinya tanggal terbit, nama media, judul berita, dan link berita, sesuai periode dan media yang Anda pilih.</p></div></li>
            </ol>
          </section>

          <section id="peran" className="guide-section">
            <h2>Siapa boleh apa</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Peran</th><th>Boleh</th></tr></thead>
                <tbody>
                  <tr><td><b>Pemilik</b></td><td>Semua hal, termasuk mengatur tim dan koneksi layanan.</td></tr>
                  <tr><td><b>Admin</b></td><td>Mengelola media, alamat situs, tim, dan semua tahap kerja.</td></tr>
                  <tr><td><b>Operator</b></td><td>Menulis, memeriksa, dan menerbitkan sendiri, hanya ke media yang dihubungkan pemilik ke akunnya. Cocok untuk orang yang mengoperasikan media setiap hari.</td></tr>
                  <tr><td><b>Editor</b></td><td>Menulis berita dan meminta AI menulis, hanya ke media yang dihubungkan pemilik.</td></tr>
                  <tr><td><b>Pemeriksa</b></td><td>Menyetujui, menolak, atau meminta perbaikan.</td></tr>
                  <tr><td><b>Penerbit</b></td><td>Menerbitkan, menjadwalkan, dan menarik berita dari situs.</td></tr>
                </tbody>
              </table>
            </div>
            <p className="muted">Pemilik dan Admin bisa memakai semua media. Peran lain hanya bisa menulis ke media yang diatur pemilik di Tim dan akses. Pengguna tidak bisa mengubah daftar itu sendiri.</p>
          </section>

          <section id="masalah" className="guide-section">
            <h2>Kalau ada masalah</h2>
            <div className="guide-answers">
              <details><summary>Alamat sudah dikonfirmasi tapi situs tidak terbuka</summary><div><p>Hampir selalu penyebabnya DNS yang belum aktif. Tunggu 30 menit sampai beberapa jam, lalu coba lagi di jendela browser baru.</p><p>Cek juga isi data A di tempat Anda membeli alamat: nilainya harus sama persis dengan IP server di bagian 2.</p></div></details>
              <details><summary>Browser bilang situs tidak aman</summary><div><p>Sertifikat HTTPS dibuat saat alamat pertama kali dibuka, setelah alamat dikonfirmasi. Tunggu satu menit lalu muat ulang. Kalau masih gagal, pastikan alamat itu sudah dikonfirmasi di tab Alamat situs.</p></div></details>
              <details><summary>Alamat saya memakai Cloudflare</summary><div><p>Matikan proxy untuk data A itu (awan oranye jadi abu-abu). Dengan proxy menyala, sertifikat tidak bisa dibuat.</p></div></details>
              <details><summary>Draf AI tidak muncul</summary><div><p>Buka berita itu di Daftar berita. Penulisan butuh sampai dua menit. Kalau muncul pesan gagal, tulis ulang dari Tulis berita. Kalau tetap gagal, cek kartu AI di Kesehatan sistem.</p></div></details>
              <details><summary>Berita tidak mau terbit</summary><div><p>Medianya harus punya alamat situs yang sudah dikonfirmasi. Halaman berita menjelaskan media mana yang kurang. Setelah diperbaiki, tekan Terbitkan lagi.</p></div></details>
              <details><summary>Saya tidak melihat media saya di Tulis berita</summary><div><p>Minta pemilik menghubungkan media itu ke akun Anda di Tim dan akses. Anda tidak bisa mengubah daftar ini sendiri.</p></div></details>
              <details><summary>Saya salah ketik setelah terbit</summary><div><p>Buka link berita dari Daftar berita, lalu tekan Edit di situs. Anda juga bisa memakai Edit berita di halaman berita itu. Perbaikannya langsung tayang di semua media.</p></div></details>
              <details><summary>Foto tampil hitam putih di situs</summary><div><p>Itu gaya tampilan situs berita. Isi keterangan foto saat mengunggah, karena keterangan ikut tampil di bawah foto.</p></div></details>
              <details><summary>Lupa kata sandi</summary><div><p>Minta Admin Anda mengatur ulang akun di Tim dan akses.</p></div></details>
            </div>
          </section>

          <section id="istilah" className="guide-section">
            <h2>Arti istilah</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Istilah</th><th>Artinya</th></tr></thead>
                <tbody>
                  <tr><td><b>Media</b></td><td>Satu situs berita yang Anda kelola.</td></tr>
                  <tr><td><b>Alamat situs (domain)</b></td><td>Nama yang diketik pembaca, misalnya beritakota.id.</td></tr>
                  <tr><td><b>DNS</b></td><td>Daftar yang memberi tahu internet di server mana sebuah alamat berada.</td></tr>
                  <tr><td><b>Data A</b></td><td>Satu baris di DNS yang menghubungkan alamat ke IP server.</td></tr>
                  <tr><td><b>IP server</b></td><td>Deretan angka yang menjadi &quot;nomor rumah&quot; server kami.</td></tr>
                  <tr><td><b>HTTPS (gembok)</b></td><td>Tanda bahwa sambungan ke situs terenkripsi.</td></tr>
                  <tr><td><b>Draf</b></td><td>Naskah buatan AI yang belum Anda setujui.</td></tr>
                  <tr><td><b>Sumber dan bukti</b></td><td>Bahan yang mendasari fakta di naskah, misalnya tautan berita lain.</td></tr>
                  <tr><td><b>Kategori</b></td><td>Rubrik berita, misalnya Ekonomi atau Olahraga.</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
