// src/app/privacy/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | SIS Main Riang",
  robots: { index: true },
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-100 py-10 px-4">
      <article className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 space-y-6 text-gray-800">
        <header className="border-b border-gray-100 pb-4">
          <h1 className="text-2xl font-bold">Kebijakan Privasi</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sistem Informasi Sekolah (SIS) Main Riang — Terakhir diperbarui: 12 Oktober 2026
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Tentang Kebijakan Ini</h2>
          <p className="text-sm leading-relaxed">
            Kebijakan Privasi ini menjelaskan bagaimana <strong>Yayasan Mainriang Indonesia</strong>
            {" "}(izin Kemenkumham: AHU-0440.AH.02.01.TAHUN 2010, selanjutnya disebut &ldquo;Yayasan&rdquo;)
            mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi Anda saat menggunakan
            situs web <strong>mainriang.app</strong> serta aplikasi Android <strong>SIS Main Riang</strong>
            {" "}(secara bersamaan disebut &ldquo;Aplikasi&rdquo;).
          </p>
          <p className="text-sm leading-relaxed">
            Pemrosesan data pribadi ini dilakukan dengan mengacu pada Undang-Undang Republik Indonesia
            Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi (UU PDP).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Data yang Kami Kumpulkan</h2>
          <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
            <li><strong>Data akun:</strong> nama lengkap, alamat email, nomor telepon (jika diisi), peran/role di sekolah (Siswa, Guru, Caregiver, Admin, dll.), NISN/NIY, kelas, dan cabang/lokasi sekolah.</li>
            <li><strong>Data profil:</strong> foto profil yang Anda unggah.</li>
            <li><strong>Data akademik & perkembangan:</strong> jadwal, kegiatan, laporan perkembangan anak, catatan pendidik, nilai/indikator pembelajaran.</li>
            <li><strong>Data keuangan:</strong> jenis biaya, tagihan, status pembayaran, dan riwayat transaksi pembayaran biaya sekolah.</li>
            <li><strong>Data pendaftaran:</strong> data calon siswa yang diisi pada formulir pendaftaran siswa baru/trial class.</li>
            <li><strong>Data teknis:</strong> alamat IP, jenis perangkat, dan log penggunaan yang diperlukan untuk keamanan dan pemecahan masalah.</li>
          </ul>
          <p className="text-sm leading-relaxed">
            <strong>Data anak di bawah umur:</strong> Aplikasi ini memproses data siswa yang umumnya berusia di bawah 18 tahun.
            Data tersebut hanya dikumpulkan dan dikelola melalui akun yang dibuat/diizinkan oleh orang tua/wali atau pihak sekolah,
            dan digunakan semata-mata untuk keperluan layanan pendidikan dan komunikasi sekolah.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Cara Kami Menggunakan Data</h2>
          <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
            <li>Mengelola akun pengguna dan autentikasi (login).</li>
            <li>Menyediakan fitur akademik, jadwal, laporan perkembangan, pengumuman, dan acara.</li>
            <li>Mengelola tagihan dan memfasilitasi pembayaran biaya sekolah.</li>
            <li>Mengirim notifikasi terkait akun, tagihan, dan informasi sekolah.</li>
            <li>Keperluan administrasi, arsip, audit, dan pemenuhan kewajiban hukum.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Penyedia Layanan Pihak Ketiga</h2>
          <p className="text-sm leading-relaxed">Kami menggunakan layanan pihak ketiga terpercaya, dengan kewenangan terbatas hanya untuk menjalankan layanannya:</p>
          <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
            <li><strong>Google Firebase</strong> — autentikasi (Firebase Auth), basis data (Cloud Firestore), dan penyimpanan berkas (Firebase Storage). Kebijakan privasi: https://policies.google.com/privacy</li>
            <li><strong>Midtrans (PT Midtrans Payment / grup GoTo)</strong> — pemrosesan pembayaran. Data kartu/akun pembayaran Anda diproses langsung oleh Midtrans dan <strong>tidak kami simpan</strong> di sistem kami. Kebijakan privasi: https://midtrans.com/id/privacy-policy</li>
            <li><strong>Vercel</strong> — hosting aplikasi web. Kebijakan privasi: https://vercel.com/legal/privacy-policy</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Izin Perangkat yang Kami Minta</h2>
          <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
            <li><strong>Kamera</strong> — digunakan hanya saat Anda mengunggah/mengambil foto (misalnya foto profil atau dokumen pendaftaran).</li>
            <li><strong>Penyimpanan</strong> — untuk memilih berkas yang akan diunggah.</li>
            <li><strong>Lokasi (opsional)</strong> — hanya bila Anda mengaktifkannya dan fitur yang memerlukannya tersedia.</li>
          </ul>
          <p className="text-sm leading-relaxed">Anda dapat menolak atau mencabut izin tersebut melalui pengaturan perangkat; sebagian fitur mungkin tidak berfungsi tanpa izin terkait.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Penyimpanan dan Keamanan</h2>
          <p className="text-sm leading-relaxed">
            Data disimpan pada infrastruktur Google Cloud (Firebase) dengan enkripsi saat transit (HTTPS/TLS).
            Akses data dibatasi berdasarkan peran (role-based) melalui aturan keamanan (security rules).
            Meskipun kami menerapkan langkah keamanan yang wajar, tidak ada sistem yang sepenuhnya bebas dari risiko.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Retensi dan Penghapusan Data</h2>
          <p className="text-sm leading-relaxed">
            Data disimpan selama akun aktif atau selama diperlukan untuk tujuan layanan dan kewajiban hukum.
            Anda dapat meminta penghapusan akun dan data pribadi Anda dengan menghubungi kami (lihat bagian Kontak).
            Data yang diwajibkan oleh hukum atau kepentingan arsip sekolah dapat kami simpan sesuai ketentuan.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Hak Anda</h2>
          <p className="text-sm leading-relaxed">Sesuai UU PDP, Anda berhak untuk:</p>
          <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
            <li>Mengakses dan memperbarui data pribadi Anda;</li>
            <li>Meminta pembatasan atau penghapusan data;</li>
            <li>Menarik persetujuan pemrosesan data;</li>
            <li>Mengajukan keberatan atas pemrosesan tertentu.</li>
          </ul>
          <p className="text-sm leading-relaxed">Permintaan dapat disampaikan melalui kontak di bawah. Kami akan menanggapi dalam waktu yang wajar.</p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Perubahan Kebijakan</h2>
          <p className="text-sm leading-relaxed">
            Kami dapat memperbarui kebijakan ini sewaktu-waktu. Perubahan penting akan diinformasikan melalui Aplikasi
            atau situs web. Penggunaan berkelanjutan setelah perubahan dianggap sebagai persetujuan.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Kontak</h2>
          <p className="text-sm leading-relaxed">
            <strong>Yayasan Mainriang Indonesia</strong><br />
            Izin Kemenkumham: AHU-0440.AH.02.01.TAHUN 2010<br />
            Email: <a href="mailto:mainriang@gmail.com" className="text-[#581c87] underline">mainriang@gmail.com</a><br />
            Situs web: <a href="https://mainriang.app" className="text-[#581c87] underline">https://mainriang.app</a>
          </p>
        </section>
      </article>
    </main>
  );
}
