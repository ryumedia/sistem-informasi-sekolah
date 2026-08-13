"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, Timestamp, orderBy, query } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import Image from 'next/image';

interface Option {
  id: string;
  nama: string;
}

export default function PendaftaranSiswaBaruPage() {
  const [lokasiOptions, setLokasiOptions] = useState<Option[]>([]);
  const [programOptions, setProgramOptions] = useState<Option[]>([]);
  const [usiaOptions, setUsiaOptions] = useState<Option[]>([]);

  const [formData, setFormData] = useState({
    lokasi: '',
    program: '',
    namaAnak: '',
    namaPanggilan: '',
    jenisKelamin: '',
    kelompokUsia: '',
    agama: '',
    tempatLahir: '',
    tanggalLahir: '',
    namaAyah: '',
    namaIbu: '',
    anakKe: '',
    email: '',
    noWaAyah: '',
    noWaIbu: '',
    kebutuhanKhusus: 'Tidak',
    infoDari: '',
    infoLainnya: '',
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const [lokasiSnap, programSnap, usiaSnap] = await Promise.all([
          getDocs(query(collection(db, 'lokasi_pendaftaran'), orderBy('nama'))),
          getDocs(query(collection(db, 'program_pendaftaran'), orderBy('nama'))),
          getDocs(query(collection(db, 'kelompok_usia'), orderBy('usia'))),
        ]);

        setLokasiOptions(lokasiSnap.docs.map(doc => ({ id: doc.id, nama: doc.data().nama })));
        setProgramOptions(programSnap.docs.map(doc => ({ id: doc.id, nama: doc.data().nama })));
        setUsiaOptions(usiaSnap.docs.map(doc => ({ id: doc.id, nama: doc.data().usia })));

      } catch (error) {
        console.error("Error fetching options:", error);
        alert("Gagal memuat data pilihan. Silakan muat ulang halaman.");
      } finally {
        setLoading(false);
      }
    };
    fetchOptions();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!confirm("Apakah Anda yakin data yang diisi sudah benar?")) return;

    setSubmitting(true);
    try {
      const infoDetail = formData.infoDari === 'Lainnya' ? formData.infoLainnya : formData.infoDari;

      await addDoc(collection(db, "siswa_baru_registrations"), {
        ...formData,
        anakKe: formData.anakKe ? parseInt(formData.anakKe) : 0,
        infoDari: infoDetail,
        statusPendaftaran: 'Baru',
        createdAt: Timestamp.now(),
      });

      alert("Pendaftaran berhasil dikirim! Terima kasih telah mendaftar di Main Riang.");
      // Reset form
      setFormData({
        lokasi: '',
        program: '',
        namaAnak: '',
        namaPanggilan: '',
        jenisKelamin: '',
        kelompokUsia: '',
        agama: '',
        tempatLahir: '',
        tanggalLahir: '',
        namaAyah: '',
        namaIbu: '',
        anakKe: '',
        email: '',
        noWaAyah: '',
        noWaIbu: '',
        kebutuhanKhusus: 'Tidak',
        infoDari: '',
        infoLainnya: '',
      });

    } catch (error) {
      console.error("Error submitting registration:", error);
      alert("Terjadi kesalahan saat mengirim pendaftaran. Silakan coba lagi.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-10 h-10 animate-spin text-[#581c87]" />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center">
            <Image 
                src="/logo.png" // Pastikan path logo benar dan ada di folder /public
                alt="Logo Main Riang"
                width={150}
                height={150}
                className="mx-auto mb-4"
            />
            <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-800">Formulir Pendaftaran Siswa Baru</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-600">Silakan isi data calon siswa dengan lengkap dan benar.</p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 bg-white p-8 rounded-2xl shadow-lg space-y-6">
          {/* Pilihan Lokasi & Program */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="lokasi" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Pilih Lokasi</label>
              <select id="lokasi" name="lokasi" value={formData.lokasi} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#581c87] focus:border-[#581c87] text-gray-900 dark:text-gray-900">
                <option value="" disabled>-- Pilih Lokasi --</option>
                {lokasiOptions.map(opt => <option key={opt.id} value={opt.nama}>{opt.nama}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="program" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Pilih Program</label>
              <select id="program" name="program" value={formData.program} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-[#581c87] focus:border-[#581c87] text-gray-900 dark:text-gray-900">
                <option value="" disabled>-- Pilih Program --</option>
                {programOptions.map(opt => <option key={opt.id} value={opt.nama}>{opt.nama}</option>)}
              </select>
            </div>
          </div>

          {/* Data Siswa */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-900">Data Diri Siswa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="namaAnak" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Nama Lengkap Siswa</label>
                    <input type="text" name="namaAnak" id="namaAnak" value={formData.namaAnak} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" />
                </div>
                <div>
                    <label htmlFor="namaPanggilan" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Nama Panggilan Siswa</label>
                    <input type="text" name="namaPanggilan" id="namaPanggilan" value={formData.namaPanggilan} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-700">Jenis Kelamin</label>
                    <div className="mt-2 flex gap-4">
                        <label className="inline-flex items-center text-gray-700 dark:text-gray-700"><input type="radio" name="jenisKelamin" value="Laki-laki" checked={formData.jenisKelamin === 'Laki-laki'} onChange={handleChange} required className="form-radio" /> <span className="ml-2">Laki-laki</span></label>
                        <label className="inline-flex items-center text-gray-700 dark:text-gray-700"><input type="radio" name="jenisKelamin" value="Perempuan" checked={formData.jenisKelamin === 'Perempuan'} onChange={handleChange} className="form-radio" /> <span className="ml-2">Perempuan</span></label>
                    </div>
                </div>
                <div>
                    <label htmlFor="kelompokUsia" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Jenjang Usia</label>
                    <select id="kelompokUsia" name="kelompokUsia" value={formData.kelompokUsia} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900">
                        <option value="" disabled>-- Pilih Jenjang Usia --</option>
                        {usiaOptions.map(opt => <option key={opt.id} value={opt.nama}>{opt.nama}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="agama" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Agama</label>
                    <input type="text" name="agama" id="agama" value={formData.agama} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" />
                </div>
                <div>
                    <label htmlFor="anakKe" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Anak Ke-</label>
                    <input type="number" name="anakKe" id="anakKe" value={formData.anakKe} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" />
                </div>
                <div>
                    <label htmlFor="tempatLahir" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Tempat Lahir</label>
                    <input type="text" name="tempatLahir" id="tempatLahir" value={formData.tempatLahir} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" />
                </div>
                <div>
                    <label htmlFor="tanggalLahir" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Tanggal Lahir</label>
                    <input type="date" name="tanggalLahir" id="tanggalLahir" value={formData.tanggalLahir} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" />
                </div>
            </div>
          </div>

          {/* Data Orang Tua */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-900">Data Orang Tua / Wali</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label htmlFor="namaAyah" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Nama Ayah</label>
                    <input type="text" name="namaAyah" id="namaAyah" value={formData.namaAyah} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" />
                </div>
                <div>
                    <label htmlFor="namaIbu" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Nama Ibu</label>
                    <input type="text" name="namaIbu" id="namaIbu" value={formData.namaIbu} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" />
                </div>
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Email</label>
                    <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">Bisa menggunakan email Ayah atau Ibu.</p>
                </div>
                <div></div>
                <div>
                    <label htmlFor="noWaAyah" className="block text-sm font-medium text-gray-700 dark:text-gray-700">No. WA Ayah</label>
                    <input type="tel" name="noWaAyah" id="noWaAyah" value={formData.noWaAyah} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">Jika tidak ada, isi dengan angka 0.</p>
                </div>
                <div>
                    <label htmlFor="noWaIbu" className="block text-sm font-medium text-gray-700 dark:text-gray-700">No. WA Ibu</label>
                    <input type="tel" name="noWaIbu" id="noWaIbu" value={formData.noWaIbu} onChange={handleChange} required className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">Jika tidak ada, isi dengan angka 0.</p>
                </div>
            </div>
          </div>

          {/* Informasi Tambahan */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-900">Informasi Tambahan</h3>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-700">Apakah siswa berkebutuhan khusus?</label>
                <div className="mt-2 flex gap-4">
                    <label className="inline-flex items-center text-gray-700 dark:text-gray-700"><input type="radio" name="kebutuhanKhusus" value="Ya" checked={formData.kebutuhanKhusus === 'Ya'} onChange={handleChange} className="form-radio" /> <span className="ml-2">Ya</span></label>
                    <label className="inline-flex items-center text-gray-700 dark:text-gray-700"><input type="radio" name="kebutuhanKhusus" value="Tidak" checked={formData.kebutuhanKhusus === 'Tidak'} onChange={handleChange} className="form-radio" /> <span className="ml-2">Tidak</span></label>
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-700">Mengetahui info Main Riang dari?</label>
                <div className="mt-2 space-y-2 text-gray-700 dark:text-gray-700">
                    <label className="flex items-center"><input type="radio" name="infoDari" value="Teman" checked={formData.infoDari === 'Teman'} onChange={handleChange} className="form-radio" /> <span className="ml-2">Teman</span></label>
                    <label className="flex items-center"><input type="radio" name="infoDari" value="Media Sosial" checked={formData.infoDari === 'Media Sosial'} onChange={handleChange} className="form-radio" /> <span className="ml-2">Media Sosial</span></label>
                    <label className="flex items-center"><input type="radio" name="infoDari" value="Spanduk" checked={formData.infoDari === 'Spanduk'} onChange={handleChange} className="form-radio" /> <span className="ml-2">Spanduk</span></label>
                    <label className="flex items-center"><input type="radio" name="infoDari" value="Lainnya" checked={formData.infoDari === 'Lainnya'} onChange={handleChange} className="form-radio" /> <span className="ml-2">Lainnya</span></label>
                    {formData.infoDari === 'Lainnya' && (
                        <input 
                            type="text" 
                            name="infoLainnya" 
                            value={formData.infoLainnya} 
                            onChange={handleChange}
                            placeholder="Sebutkan sumber lainnya"
                            className="mt-1 ml-6 block w-full max-w-xs p-2 border border-gray-300 rounded-md shadow-sm text-gray-900 dark:text-gray-900" 
                        />
                    )}
                </div>
            </div>
          </div>

          {/* Tombol Kirim */}
          <div className="pt-6 border-t">
            <button 
              type="submit" 
              disabled={submitting}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[#581c87] hover:bg-[#45156b] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#581c87] disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Kirim Pendaftaran'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}