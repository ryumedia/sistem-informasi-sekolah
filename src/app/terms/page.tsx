// src/app/terms/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Syarat dan Ketentuan | SIS Main Riang",
  robots: { index: true },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-100 py-10 px-4">
      <article className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 space-y-6 text-gray-800">
        <header className="border-b border-gray-100 pb-4">
          <h1 className="text-2xl font-bold">Syarat dan Ketentuan</h1>
          <p className="text-sm text-gray-500 mt-1">
            Sistem Informasi Sekolah (SIS) Main Riang — Terakhir diperbarui: 12 Oktober 2026
          </p>
        </header>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">1. Penerimaan Ketentuan</h2>
          <p className="text-sm leading-relaxed">
            Dengan mengakses atau menggunakan situs <strong>mainriang.app</strong> dan/atau aplikasi Android
            {" "}<strong>SIS Main Riang</strong> (selanjutnya &ldquo;Aplikasi&rdquo;), Anda menyatakan telah membaca,
            memahami, dan menyetujui Syarat dan Ketentuan ini. Jika Anda tidak setuju, mohon berhenti menggunakan Aplikasi.
          </p>
          <p className="text-sm leading-relaxed">
            Aplikasi ini disediakan oleh <strong>Yayasan Mainriang Indonesia</strong>
            {" "}(izin Kemenkumham: AHU-0440.AH.02.01.TAHUN 2010, selanjutnya &ldquo;Yayasan&rdquo;).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">2. Akun Pengguna</h2>
          <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
            <li>Akun dibuat/diberikan oleh pihak sekolah untuk Siswa, Guru, Caregiver, dan pengelola. Untuk akun anak di bawah umur, tanggung jawab ada pada orang tua/wali.</li>
            <li>Anda bertanggung jawab menjaga kerahasiaan kata sandi dan aktivitas yang terjadi pada akun Anda.</li>
            <li>Dilarang membagikan akun kepada pihak lain atau menggunakan akun milik orang lain.</li>
            <li>Segera lapor kepada sekolah apabila akun Anda digunakan tanpa izin.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">3. Penggunaan yang Diperbolehkan</h2>
          <p className="text-sm leading-relaxed">Anda dilarang:</p>
          <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
            <li>Mengakses, mengubah, atau menghapus data yang bukan haknya (termasuk data siswa lain) melalui cara apa pun, termasuk manipulasi teknis;</li>
            <li>Menyalin, mendistribusikan, atau menjual konten/materi pembelajaran dari Aplikasi tanpa izin tertulis;</li>
            <li>Menggunakan Aplikasi untuk tujuan yang melanggar hukum, serta merusak, mengganggu, atau membebani sistem secara tidak wajar;</li>
            <li>Mengunggah konten yang melanggar hukum, diskriminatif, atau membahayakan.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">4. Fitur Akademik dan Informasi</h2>
          <p className="text-sm leading-relaxed">
            Jadwal, laporan perkembangan, pengumuman, dan materi pembelajaran disediakan untuk keperluan layanan pendidikan.
            Yayasan berhak memperbarui, mengubah, atau menghentikan fitur tertentu sewaktu-waktu sesuai kebijakan sekolah.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">5. Pembayaran Biaya Sekolah</h2>
          <ul className="list-disc pl-5 text-sm leading-relaxed space-y-1">
            <li>Informasi tagihan pada Aplikasi merupakan rujukan administrasi; pembayaran diproses melalui platform <strong>Midtrans</strong> ke rekening resmi Yayasan.</li>
            <li>Apabila terjadi kesalahan nominal, gagal bayar, atau kebutuhan pengembalian dana (refund), silakan hubungi pihak sekolah dengan menyertakan bukti transaksi.</li>
            <li>Status lunas akan diperbarui setelah verifikasi pembayaran oleh pengelola.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">6. Hak Kekayaan Intelektual</h2>
          <p className="text-sm leading-relaxed">
            Seluruh konten, logo, merek, dan materi dalam Aplikasi merupakan milik Yayasan Mainriang Indonesia
            atau pemberi lisensinya, dan dilindungi hukum. Penggunaan di luar keperluan pribadi/non-komersial
            memerlukan izin tertulis.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">7. Batasan Tanggung Jawab</h2>
          <p className="text-sm leading-relaxed">
            Aplikasi disediakan &ldquo;sebagaimana adanya&rdquo;. Yayasan tidak menjamin Aplikasi bebas dari gangguan,
            kesalahan, atau jeda layanan. Sepanjang diizinkan oleh hukum, Yayasan tidak bertanggung jawab atas kerugian
            tidak langsung yang timbul akibat penggunaan Aplikasi.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">8. Pengakhiran Akses</h2>
          <p className="text-sm leading-relaxed">
            Yayasan dapat menonaktifkan atau menghentikan akses akun yang melanggar ketentuan ini, atau yang
            berakhir karena kelulusan/pencabutan registrasi, dengan pemberitahuan melalui kontak yang tersedia.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">9. Hukum yang Berlaku</h2>
          <p className="text-sm leading-relaxed">
            Syarat dan Ketentuan ini tunduk pada hukum Republik Indonesia, termasuk UU No. 27 Tahun 2022 tentang
            Pelindungan Data Pribadi. Perkara yang tidak diatur akan diselesaikan secara musyawarah.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold">10. Kontak</h2>
          <p className="text-sm leading-relaxed">
            <strong>Yayasan Mainriang Indonesia</strong><br />
            Izin Kemenkumham: AHU-0440.AH.02.01.TAHUN 2010<br />
            Email: <a href="mailto:mainriang@gmail.com" className="text-[#581c87] underline">mainriang@gmail.com</a><br />
            Kebijakan Privasi: <a href="/privacy" className="text-[#581c87] underline">/privacy</a>
          </p>
        </section>
      </article>
    </main>
  );
}
