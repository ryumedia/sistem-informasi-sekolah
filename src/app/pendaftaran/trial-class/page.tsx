"use client";

import { useState, useEffect, FormEvent, useMemo } from 'react';
import Image from 'next/image';
import { db } from '@/lib/firebase';
import { collection, query, getDocs, addDoc, Timestamp, orderBy, where } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

// --- INTERFACES ---
interface Lokasi {
  id: string;
  nama: string;
}

interface Program {
  id: string;
  nama: string;
}

interface JadwalTrial {
  id: string;
  lokasi: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string; // HH:mm
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

export default function TrialClassRegistrationPage() {
  const [formData, setFormData] = useState<FormData>({
    lokasi: '',
    tanggal: '',
    waktu: '',
    program: '',
    namaAnak: '',
    namaPanggilan: '',
    alamat: '',
    nomorWa: '',
  });

  const [lokasiOptions, setLokasiOptions] = useState<Lokasi[]>([]);
  const [programOptions, setProgramOptions] = useState<Program[]>([]);
  const [jadwalOptions, setJadwalOptions] = useState<JadwalTrial[]>([]);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const lokasiQuery = query(collection(db, "lokasi_pendaftaran"), orderBy("nama", "asc"));
        const programQuery = query(collection(db, "program_pendaftaran"), orderBy("nama", "asc"));
        const jadwalQuery = query(collection(db, "jadwal_trial"), orderBy("tanggal", "asc"));

        const [lokasiSnapshot, programSnapshot, jadwalSnapshot] = await Promise.all([
          getDocs(lokasiQuery),
          getDocs(programQuery),
          getDocs(jadwalQuery),
        ]);

        setLokasiOptions(lokasiSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lokasi)));
        setProgramOptions(programSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program)));
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


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await addDoc(collection(db, "pendaftaran_trial"), {
        ...formData,
        tanggalPendaftaran: Timestamp.now(),
        status: "Baru"
      });
      setSuccessMessage("Pendaftaran trial class berhasil! Kami akan segera menghubungi Anda.");
      setFormData({
        lokasi: '',
        tanggal: '',
        waktu: '',
        program: '',
        namaAnak: '',
        namaPanggilan: '',
        alamat: '',
        nomorWa: '',
      });
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

                {/* Program */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pilih rencana program yang akan diambil</label>
                    <select name="program" value={formData.program} onChange={handleInputChange} required className="w-full border rounded-lg p-2.5 bg-white focus:ring-2 focus:ring-blue-500 outline-none">
                        <option value="" disabled>-- Pilih Program--</option>
                        {programOptions.map(opt => <option key={opt.id} value={opt.nama}>{opt.nama}</option>)}
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

                {/* Submit */}
                <div className="pt-4">
                    {successMessage && <div className="mb-4 text-center text-green-700 bg-green-100 p-3 rounded-lg">{successMessage}</div>}
                    {error && <div className="mb-4 text-center text-red-700 bg-red-100 p-3 rounded-lg">{error}</div>}
                    <button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2">
                        {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> Mendaftar...</> : 'Daftar Trial Class'}
                    </button>
                </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}