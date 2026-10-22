"use client";

import { useState, useEffect, FormEvent, useMemo, useRef } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, Timestamp, orderBy, where, updateDoc, doc, increment } from 'firebase/firestore';
import { Loader2, Users, Wallet, Upload, Image as ImageIcon, X, AlertCircle, Phone } from 'lucide-react';

// --- INTERFACES ---
interface Lokasi {
  id: string;
  nama: string;
  nomorWa?: string;
}

// Pilihan rencana program (hardcode)
const PROGRAM_OPTIONS = ['Daycare', 'Playgroup', 'TK', 'TK + Daycare'] as const;

interface JadwalTrial {
  id: string;
  lokasi: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string; // HH:mm
  tipe?: 'gratis' | 'berbayar';
  nominal?: number;
  kuota?: number;
}

interface FormData {
  lokasi: string;
  tanggal: string;
  waktu: string;
  program: string;
  namaAnak: string;
  namaPanggilan: string;
  alamat: string;
  nomorWa: string;
}

const EMPTY_FORM: FormData = {
  lokasi: '',
  tanggal: '',
  waktu: '',
  program: '',
  namaAnak: '',
  namaPanggilan: '',
  alamat: '',
  nomorWa: '',
};

// Nomor admin yang ditampilkan saat kuota habis (ubah sesuai kebutuhan).
const ADMIN_WA_NUMBER = '6281234567890';
const ADMIN_WA_TEXT = encodeURIComponent(
  'Halo Admin, saya ingin mendaftar Trial Class namun kuota sudah habis. Mohon informasi ketersediaan selanjutnya.'
);

// Kompres gambar di browser agar payload Firestore tetap di bawah batas 1MB.
const compressImage = (file: File, maxSize = 1000, quality = 0.7): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.onload = () => {
      const img = document.createElement('img');
      img.onerror = () => reject(new Error('File bukan gambar yang valid.'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas tidak didukung browser ini.'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

export default function TrialClassRegistrationPage() {
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);

  const [lokasiOptions, setLokasiOptions] = useState<Lokasi[]>([]);
  const [jadwalOptions, setJadwalOptions] = useState<JadwalTrial[]>([]);

  // Bukti transfer (disimpan sebagai data URL hasil kompresi)
  const [buktiTransfer, setBuktiTransfer] = useState<string | null>(null);
  const [buktiFileName, setBuktiFileName] = useState<string>('');
  const [buktiError, setBuktiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const lokasiQuery = query(collection(db, "lokasi_pendaftaran"), orderBy("nama", "asc"));
        const jadwalQuery = query(collection(db, "jadwal_trial"), orderBy("tanggal", "asc"));

        const [lokasiSnapshot, jadwalSnapshot] = await Promise.all([
          getDocs(lokasiQuery),
          getDocs(jadwalQuery),
        ]);

        setLokasiOptions(lokasiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lokasi)));
        setJadwalOptions(jadwalSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JadwalTrial)));

      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Gagal memuat data. Silakan coba lagi nanti.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
        const newState = { ...prev, [name]: value };
        // Reset dependent fields if their parent changes
        if (name === 'lokasi') {
            newState.tanggal = '';
            newState.waktu = '';
        }
        if (name === 'tanggal') {
            newState.waktu = '';
        }
        return newState;
    });
  };

  const availableDates = useMemo(() => {
    if (!formData.lokasi) return [];
    const dates = jadwalOptions
      .filter(j => j.lokasi === formData.lokasi)
      .map(j => j.tanggal);
    return [...new Set(dates)]; // Unique dates
  }, [formData.lokasi, jadwalOptions]);

  const availableTimes = useMemo(() => {
    if (!formData.lokasi || !formData.tanggal) return [];
    return jadwalOptions
      .filter(j => j.lokasi === formData.lokasi && j.tanggal === formData.tanggal)
      .map(j => j.waktu);
  }, [formData.lokasi, formData.tanggal, jadwalOptions]);

  // Jadwal yang dipilih user (dipakai untuk info kuota & biaya)
  const selectedJadwal = useMemo(() => {
    if (!formData.lokasi || !formData.tanggal || !formData.waktu) return null;
    return (
      jadwalOptions.find(
        j => j.lokasi === formData.lokasi && j.tanggal === formData.tanggal && j.waktu === formData.waktu
      ) || null
    );
  }, [formData.lokasi, formData.tanggal, formData.waktu, jadwalOptions]);

  const isBerbayar = selectedJadwal?.tipe === 'berbayar';
  const nominalPembayaran = isBerbayar ? Number(selectedJadwal?.nominal) || 0 : 0;

  // Field `kuota` pada jadwal_trial adalah kuota tersisa (sudah dikurangi tiap pendaftaran),
  // jadi nilai ini sudah sama dengan yang tampil di halaman admin. Jangan dikurangi lagi.
  const sisaKuotaJadwal = (jadwal: JadwalTrial) => Number(jadwal.kuota) || 0;

  const sisaKuotaSelected = selectedJadwal ? sisaKuotaJadwal(selectedJadwal) : null;
  const kuotaHabis = !!selectedJadwal && (sisaKuotaSelected ?? 0) <= 0;

  // Nomor admin mengikuti nomor WA pada lokasi yang dipilih (fallback ke nomor default)
  const adminWaNumber = useMemo(() => {
    const lokasi = lokasiOptions.find(l => l.nama === formData.lokasi);
    const raw = (lokasi?.nomorWa || '').replace(/\D/g, '');
    if (!raw) return ADMIN_WA_NUMBER;
    if (raw.startsWith('0')) return '62' + raw.slice(1);
    if (raw.startsWith('62')) return raw;
    return '62' + raw;
  }, [lokasiOptions, formData.lokasi]);

  const handleBuktiChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBuktiError(null);

    if (!file.type.startsWith('image/')) {
      setBuktiError('File harus berupa gambar (JPG, PNG, atau WEBP).');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBuktiError('Ukuran file maksimal 5MB.');
      return;
    }

    try {
      const dataUrl = await compressImage(file);
      setBuktiTransfer(dataUrl);
      setBuktiFileName(file.name);
    } catch (err) {
      console.error('Error memproses bukti transfer:', err);
      setBuktiError('Gagal memproses gambar. Silakan coba file lain.');
    }
  };

  const removeBukti = () => {
    setBuktiTransfer(null);
    setBuktiFileName('');
    setBuktiError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    // Semua field wajib diisi (termasuk tanggal & waktu)
    const wajib: Array<[keyof FormData, string]> = [
      ['lokasi', 'Lokasi'],
      ['tanggal', 'Tanggal'],
      ['waktu', 'Waktu'],
      ['program', 'Rencana program'],
      ['namaAnak', 'Nama lengkap anak'],
      ['namaPanggilan', 'Nama panggilan'],
      ['alamat', 'Alamat'],
      ['nomorWa', 'Nomor WA orang tua'],
    ];
    const kosong = wajib.filter(([key]) => !String(formData[key] || '').trim()).map(([, label]) => label);
    if (kosong.length > 0) {
      setError(`Mohon lengkapi data berikut: ${kosong.join(', ')}.`);
      setIsSubmitting(false);
      return;
    }

    if (!selectedJadwal) {
      setError('Jadwal Trial Class yang dipilih tidak ditemukan. Silakan pilih ulang jadwal.');
      setIsSubmitting(false);
      return;
    }

    // Cek ulang sisa kuota terbaru sebelum menyimpan
    try {
      const snapJadwal = await getDocs(query(collection(db, "jadwal_trial"), where("__name__", "==", selectedJadwal.id)));
      const kuotaTersisa = Number(snapJadwal.docs[0]?.data()?.kuota) || 0;
      if (kuotaTersisa <= 0) {
        setError('Kuota Trial Class Sudah Habis, Silakan untuk menghubungi Admin.');
        setIsSubmitting(false);
        return;
      }
    } catch (err) {
      console.error('Error memeriksa kuota:', err);
    }

    // Validasi bukti transfer jika jadwal berbayar
    if (selectedJadwal.tipe === 'berbayar' && !buktiTransfer) {
      setError('Silakan unggah bukti transfer terlebih dahulu karena trial class ini berbayar.');
      setIsSubmitting(false);
      return;
    }

    try {
      const pendaftaranRef = await addDoc(collection(db, "pendaftaran_trial"), {
        ...formData,
        jadwalId: selectedJadwal.id,
        tipe: selectedJadwal.tipe || 'gratis',
        nominal: selectedJadwal.tipe === 'berbayar' ? nominalPembayaran : 0,
        buktiTransfer: selectedJadwal.tipe === 'berbayar' ? buktiTransfer : null,
        tanggalPendaftaran: Timestamp.now(),
        status: "Baru"
      });

      // Kirim notifikasi WhatsApp via server (API key Starsender tetap rahasia)
      try {
        const notificationResponse = await fetch('/api/notifikasi/trial-class', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pendaftaranId: pendaftaranRef.id }),
        });
        if (!notificationResponse.ok) {
          console.error('Notifikasi WhatsApp trial class gagal:', await notificationResponse.text());
        }
      } catch (notificationError) {
        // Pendaftaran tetap berhasil meskipun layanan WhatsApp sedang bermasalah.
        console.error('Error mengirim notifikasi WhatsApp trial class:', notificationError);
      }

      // Kurangi kuota pada dokumen jadwal_trial
      try {
        await updateDoc(doc(db, "jadwal_trial", selectedJadwal.id), { kuota: increment(-1) });
        setJadwalOptions(prev =>
          prev.map(j =>
            j.id === selectedJadwal.id ? { ...j, kuota: Math.max(0, (Number(j.kuota) || 0) - 1) } : j
          )
        );
      } catch (err) {
        console.error('Error mengurangi kuota jadwal:', err);
      }

      setSuccessMessage("Pendaftaran trial class berhasil! Kami akan segera menghubungi Anda.");
      setFormData(EMPTY_FORM);
      removeBukti();
    } catch (err) {
      console.error("Error submitting form:", err);
      setError("Gagal mengirim pendaftaran. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
            <Image src="/logo.png" alt="Logo Main Riang" width={150} height={150} className="mx-auto" />
            <h1 className="text-3xl font-bold text-gray-800 mt-4">Pendaftaran Trial Class</h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 sm:p-8">
          {loading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Jadwal */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Lokasi</label>
                        <select name="lokasi" value={formData.lokasi} onChange={handleInputChange} required className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                            <option value="" disabled>-- Pilih Lokasi --</option>
                            {lokasiOptions.map(opt => <option key={opt.id} value={opt.nama}>{opt.nama}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Tanggal</label>
                        <select name="tanggal" value={formData.tanggal} onChange={handleInputChange} required disabled={!formData.lokasi || availableDates.length === 0} className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100">
                            <option value="" disabled>-- Pilih Tanggal --</option>
                            {availableDates.map(date => <option key={date} value={date}>{new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</option>)}
                        </select>
                        {formData.lokasi && availableDates.length === 0 && !loading && (
                            <p className="text-red-600 text-xs mt-1">Tidak ada jadwal Trial Class untuk lokasi ini</p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Waktu</label>
                        <select name="waktu" value={formData.waktu} onChange={handleInputChange} required disabled={!formData.tanggal || availableTimes.length === 0} className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-100">
                            <option value="" disabled>-- Pilih Waktu --</option>
                            {availableTimes.map(time => <option key={time} value={time}>{time}</option>)}
                        </select>
                    </div>
                </div>

                {/* Info Kuota & Biaya */}
                {formData.lokasi && (
                  <div className={`rounded-lg border p-4 space-y-3 ${kuotaHabis ? 'border-red-200 bg-red-50/70' : 'border-blue-100 bg-blue-50/60'}`}>
                    <div className="flex items-start gap-3">
                      <Users className={`w-5 h-5 mt-0.5 shrink-0 ${kuotaHabis ? 'text-red-600' : 'text-blue-600'}`} />
                      <div className="text-sm">
                        <p className="font-semibold text-gray-800">Kuota Trial Class — {formData.lokasi}</p>
                        {selectedJadwal && (
                          <p className="text-gray-600">
                            Sisa Kuota Sesi Ini : <span className={`font-semibold ${kuotaHabis ? 'text-red-700' : 'text-gray-800'}`}>{Math.max(0, sisaKuotaSelected ?? 0)}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedJadwal && (
                      <div className="flex items-start gap-3 border-t border-blue-100 pt-3">
                        <Wallet className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          {isBerbayar ? (
                            <>
                              <p className="font-semibold text-gray-800">Trial Class Berbayar</p>
                              <p className="text-gray-600">
                                Biaya yang harus dibayar:{' '}
                                <span className="font-bold text-blue-700">Rp {nominalPembayaran.toLocaleString('id-ID')}</span>
                              </p>
                              <p className="text-gray-600 mt-1">
                                Transfer ke No. Rekening Bank Permata <span className="font-semibold text-gray-800">4177384114</span> a.n <span className="font-semibold text-gray-800">Yayasan Teman Ilmu Indonesia</span>
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="font-semibold text-green-700">Trial Class Gratis</p>
                              <p className="text-gray-600">Tidak ada biaya yang perlu dibayarkan.</p>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {kuotaHabis && (
                      <div className="flex items-start gap-3 border-t border-red-200 pt-3">
                        <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                        <div className="text-sm">
                          <p className="font-bold text-red-700">Kuota Trial Class Sudah Habis, Silakan untuk menghubungi Admin.</p>
                          <a
                            href={`https://wa.me/${adminWaNumber}?text=${ADMIN_WA_TEXT}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                          >
                            <Phone className="w-3.5 h-3.5" /> Hubungi Admin
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pilih rencana program yang akan diambil</label>
                    <select name="program" value={formData.program} onChange={handleInputChange} required className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="" disabled>-- Pilih Program --</option>
                        {PROGRAM_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>

                {/* Data Anak */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap Anak</label>
                        <input type="text" name="namaAnak" value={formData.namaAnak} onChange={handleInputChange} required className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Panggilan</label>
                        <input type="text" name="namaPanggilan" value={formData.namaPanggilan} onChange={handleInputChange} required className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
                    </div>
                </div>

                {/* Alamat & Kontak */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
                    <textarea name="alamat" value={formData.alamat} onChange={handleInputChange} required className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" rows={3}></textarea>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nomor WA Orang Tua</label>
                    <input type="tel" name="nomorWa" value={formData.nomorWa} onChange={handleInputChange} required placeholder="Contoh: 08123456789" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>

                {/* Upload Bukti Transfer (hanya jika berbayar) */}
                {isBerbayar && (
                  <div className="border border-dashed border-blue-300 bg-blue-50/40 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-gray-800 mb-1">
                      Upload Bukti Transfer <span className="text-red-600">*</span>
                    </label>
                    <p className="text-xs text-gray-600 mb-3">
                      Transfer sebesar <span className="font-semibold">Rp {nominalPembayaran.toLocaleString('id-ID')}</span> lalu unggah bukti transfer (JPG/PNG/WEBP, maks. 5MB).
                    </p>

                    {buktiTransfer ? (
                      <div className="flex items-center gap-3 bg-white border rounded-lg p-3">
                        <Image
                          src={buktiTransfer}
                          alt="Bukti transfer"
                          width={64}
                          height={64}
                          unoptimized
                          className="w-16 h-16 object-cover rounded border"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{buktiFileName}</p>
                          <p className="text-xs text-green-600">Bukti transfer berhasil diunggah</p>
                        </div>
                        <button type="button" onClick={removeBukti} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-2 cursor-pointer bg-white border rounded-lg p-6 hover:bg-gray-50 transition">
                        <Upload className="w-6 h-6 text-blue-600" />
                        <span className="text-sm text-gray-700">Klik untuk memilih file bukti transfer</span>
                        <span className="text-xs text-gray-500 flex items-center gap-1"><ImageIcon className="w-3 h-3" /> JPG, PNG, atau WEBP</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleBuktiChange}
                          className="hidden"
                        />
                      </label>
                    )}
                    {buktiError && <p className="text-red-600 text-xs mt-2">{buktiError}</p>}
                  </div>
                )}

                {/* Submit */}
                <div className="pt-4">
                    {successMessage && <div className="mb-4 text-center text-green-700 bg-green-100 p-3 rounded-lg">{successMessage}</div>}
                    {error && <div className="mb-4 text-center text-red-700 bg-red-100 p-3 rounded-lg">{error}</div>}
                    <button type="submit" disabled={isSubmitting || kuotaHabis} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                        {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Mendaftar...</> : kuotaHabis ? 'Kuota Sudah Habis' : 'Daftar Trial Class'}
                    </button>
                </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}