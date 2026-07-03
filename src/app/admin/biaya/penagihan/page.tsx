"use client";

import { useState, useEffect, useMemo } from 'react';
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  where,
  writeBatch,
} from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';
import Link from 'next/link';
import { Eye, Send, Loader2, Plus, X } from 'lucide-react';

// --- INTERFACES ---
interface Siswa {
  id: string;
  nama: string;
  cabang: string;
  kelas: string;
}

interface Tagihan {
  id: string;
  siswaId: string;
  bulan: string;
  tahun: string;
  status: 'Lunas' | 'Belum Lunas';
}

interface Cabang {
  id: string;
  nama: string;
}

interface Kelas {
  id: string;
  namaKelas: string;
  cabang: string;
}

interface JenisBiaya {
  id: string;
  nama: string;
  nominal: number;
  penerapan: 'semua' | 'cabang_tertentu' | 'kelas_tertentu';
  cabangIds?: string[];
  kelasIds?: string[];
}

interface SiswaWithStatus extends Siswa {
  statusPembayaran: 'Lunas' | 'Belum Lunas';
}

const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

export default function PenagihanPage() {
  // --- STATE MANAGEMENT ---
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [tagihanList, setTagihanList] = useState<Tagihan[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [jenisBiayaList, setJenisBiayaList] = useState<JenisBiaya[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [filterTahun, setFilterTahun] = useState<string>(currentYear.toString());
  const [filterBulan, setFilterBulan] = useState<string>(months[new Date().getMonth()]);
  const [filterCabang, setFilterCabang] = useState<string>("");
  const [filterKelas, setFilterKelas] = useState<string>("");
  const [filteredSiswaList, setFilteredSiswaList] = useState<SiswaWithStatus[]>([]);
  const [kelasOptions, setKelasOptions] = useState<Kelas[]>([]);

  // Bulk Add Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);

  // --- DATA FETCHING & AUTH ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [cabangSnap, kelasSnap, siswaSnap, tagihanSnap, jenisBiayaSnap] = await Promise.all([
          getDocs(query(collection(db, "cabang"), orderBy("nama", "asc"))),
          getDocs(query(collection(db, "kelas"), orderBy("namaKelas", "asc"))),
          getDocs(query(collection(db, "siswa"), orderBy("nama", "asc"))),
          getDocs(collection(db, "tagihan_siswa")), // Ambil semua data tagihan
          getDocs(query(collection(db, "jenis_biaya"), orderBy("nama", "asc"))),
        ]);

        const cabangData = cabangSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cabang));
        const kelasData = kelasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kelas));
        const siswaData = siswaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Siswa));
        const tagihanData = tagihanSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tagihan));
        const jenisBiayaData = jenisBiayaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as JenisBiaya));
        
        setTagihanList(tagihanData);
        setCabangList(cabangData);
        setKelasList(kelasData);
        setSiswaList(siswaData);
        setJenisBiayaList(jenisBiayaData);

      } catch (error) {
        console.error("Error fetching data: ", error);
        alert("Gagal memuat data. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser]);

  // --- FILTERING LOGIC ---
  useEffect(() => {
    // Update kelas options when cabang filter changes
    if (filterCabang) {
      const selectedCabang = cabangList.find(c => c.id === filterCabang);
      setKelasOptions(kelasList.filter(k => k.cabang === selectedCabang?.nama));
    } else {
      setKelasOptions(kelasList);
    }
    // Reset kelas filter if it's not in the new options
    setFilterKelas("");
  }, [filterCabang, cabangList, kelasList]);

  useEffect(() => {
    // Proses siswa untuk menambahkan status pembayaran
    const siswaWithStatus: SiswaWithStatus[] = siswaList.map(siswa => {
      const hasUnpaidBill = tagihanList.some(tagihan => 
        tagihan.siswaId === siswa.id &&
        tagihan.tahun === filterTahun &&
        tagihan.bulan === filterBulan &&
        tagihan.status === 'Belum Lunas'
      );
      return {
        ...siswa,
        statusPembayaran: hasUnpaidBill ? 'Belum Lunas' : 'Lunas'
      };
    });


    // Filter berdasarkan cabang dan kelas
    let filtered = siswaWithStatus;

    if (filterCabang) {
      const selectedCabang = cabangList.find(c => c.id === filterCabang);
      if (selectedCabang) {
        filtered = filtered.filter(siswa => siswa.cabang === selectedCabang.nama);
      }
    }

    if (filterKelas) {
      const selectedKelas = kelasList.find(k => k.id === filterKelas);
      if (selectedKelas) {
        filtered = filtered.filter(siswa => siswa.kelas === selectedKelas.namaKelas);
      }
    }

    setFilteredSiswaList(filtered);
  }, [filterCabang, filterKelas, filterTahun, filterBulan, siswaList, tagihanList, cabangList, kelasList]);

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Penagihan Biaya Sekolah</h1>
        <button
          onClick={() => setIsBulkModalOpen(true)}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Penagihan Massal
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Cabang</label>
          <select
            value={filterCabang}
            onChange={(e) => setFilterCabang(e.target.value)}
            className="w-full max-w-xs border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm"
          >
            <option value="">Semua Cabang</option>
            {cabangList.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Kelas</label>
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="w-full max-w-xs border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm"
            disabled={!filterCabang && kelasOptions.length === kelasList.length}
          >
            <option value="">Semua Kelas</option>
            {kelasOptions.map(k => <option key={k.id} value={k.id}>{k.namaKelas}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Tahun</label>
          <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm">
            {years.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Bulan</label>
          <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm">
            {months.map(month => <option key={month} value={month}>{month}</option>)}
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16 text-center">No.</th>
                <th className="p-4">Nama Siswa</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Kelas</th>
                <th className="p-4">Status Pembayaran</th>
                <th className="p-4 w-48 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : filteredSiswaList.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Tidak ada data siswa yang cocok.</td></tr>
              ) : (
                filteredSiswaList.map((siswa, i) => (
                  <tr key={siswa.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{i + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{siswa.nama}</td>
                    <td className="p-4">{siswa.cabang}</td>
                    <td className="p-4">{siswa.kelas}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        siswa.statusPembayaran === 'Lunas' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {siswa.statusPembayaran}
                      </span>
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                      <Link href={`/admin/biaya/penagihan/${siswa.id}`} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition" title="Lihat Detail Tagihan">
                        <Eye className="w-4 h-4" />
                      </Link>
                      <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition" title="Kirim Tagihan Baru">
                        <Send className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isBulkModalOpen && (
        <BulkTagihanModal
          cabangList={cabangList}
          kelasList={kelasList}
          jenisBiayaList={jenisBiayaList}
          siswaList={siswaList}
          onClose={() => setIsBulkModalOpen(false)}
          onSuccess={() => {
            setIsBulkModalOpen(false);
            // Optionally re-fetch data
          }}
        />
      )}
    </div>
  );
}

// --- BULK ADD MODAL COMPONENT ---
interface BulkModalProps {
  cabangList: Cabang[];
  kelasList: Kelas[];
  jenisBiayaList: JenisBiaya[];
  siswaList: Siswa[];
  onClose: () => void;
  onSuccess: () => void;
}

function BulkTagihanModal({ cabangList, kelasList, jenisBiayaList, siswaList, onClose, onSuccess }: BulkModalProps) {
  const [formData, setFormData] = useState({
    cabangId: "",
    kelasId: "",
    jenisBiayaId: "",
    nominal: 0,
    bulan: months[new Date().getMonth()],
    tahun: currentYear.toString(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredKelas = useMemo(() => {
    if (!formData.cabangId) return [];
    const selectedCabang = cabangList.find(c => c.id === formData.cabangId);
    return kelasList.filter(k => k.cabang === selectedCabang?.nama);
  }, [formData.cabangId, cabangList, kelasList]);

  const filteredJenisBiaya = useMemo(() => {
    if (!formData.cabangId || !formData.kelasId) return [];
    return jenisBiayaList.filter(jb => {
      if (jb.penerapan === 'semua') return true;
      if (jb.penerapan === 'cabang_tertentu' && jb.cabangIds?.includes(formData.cabangId)) return true;
      if (jb.penerapan === 'kelas_tertentu' && jb.kelasIds?.includes(formData.kelasId)) return true;
      return false;
    });
  }, [formData.cabangId, formData.kelasId, jenisBiayaList]);

  const handleJenisBiayaChange = (id: string) => {
    const selected = jenisBiayaList.find(jb => jb.id === id);
    setFormData(prev => ({
      ...prev,
      jenisBiayaId: id,
      nominal: selected?.nominal || 0,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.cabangId || !formData.kelasId || !formData.jenisBiayaId) {
      alert("Harap lengkapi semua isian.");
      return;
    }
    setIsSubmitting(true);

    try {
      const selectedCabang = cabangList.find(c => c.id === formData.cabangId);
      const selectedKelas = kelasList.find(k => k.id === formData.kelasId);
      const selectedJenisBiaya = jenisBiayaList.find(jb => jb.id === formData.jenisBiayaId);

      if (!selectedCabang || !selectedKelas || !selectedJenisBiaya) {
        throw new Error("Data tidak valid.");
      }

      const targetSiswa = siswaList.filter(s => s.cabang === selectedCabang.nama && s.kelas === selectedKelas.namaKelas);

      if (targetSiswa.length === 0) {
        alert("Tidak ada siswa ditemukan di kelas ini.");
        setIsSubmitting(false);
        return;
      }

      const batch = writeBatch(db);
      targetSiswa.forEach(siswa => {
        const newTagihanRef = doc(collection(db, "tagihan_siswa"));
        batch.set(newTagihanRef, {
          siswaId: siswa.id,
          jenisBiayaId: selectedJenisBiaya.id,
          jenisBiaya: selectedJenisBiaya.nama,
          bulan: formData.bulan,
          tahun: formData.tahun,
          nominal: formData.nominal,
          status: 'Belum Lunas',
          dibayar: 0,
          createdAt: new Date(),
        });
      });

      await batch.commit();
      alert(`Tagihan massal berhasil ditambahkan untuk ${targetSiswa.length} siswa.`);
      onSuccess();
    } catch (error) {
      console.error("Error creating bulk bills:", error);
      alert("Gagal membuat tagihan massal.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Tambah Penagihan Massal</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Pilih Cabang</label><select required value={formData.cabangId} onChange={e => setFormData(prev => ({ ...prev, cabangId: e.target.value, kelasId: "" }))} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none"><option value="">Pilih Cabang</option>{cabangList.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Pilih Kelas</label><select required value={formData.kelasId} onChange={e => setFormData(prev => ({ ...prev, kelasId: e.target.value }))} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" disabled={!formData.cabangId}><option value="">Pilih Kelas</option>{filteredKelas.map(k => <option key={k.id} value={k.id}>{k.namaKelas}</option>)}</select></div>
          </div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Jenis Biaya</label><select required value={formData.jenisBiayaId} onChange={e => handleJenisBiayaChange(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" disabled={!formData.kelasId}><option value="">Pilih Jenis Biaya</option>{filteredJenisBiaya.map(jb => <option key={jb.id} value={jb.id}>{jb.nama}</option>)}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Nominal</label><input type="text" readOnly value={`Rp ${formData.nominal.toLocaleString('id-ID')}`} className="w-full border rounded-lg p-2 bg-gray-100" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Bulan</label><select required value={formData.bulan} onChange={e => setFormData(prev => ({ ...prev, bulan: e.target.value }))} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none">{months.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label><select required value={formData.tahun} onChange={e => setFormData(prev => ({ ...prev, tahun: e.target.value }))} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none">{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
          </div>
          <div className="pt-4 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isSubmitting} className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50 flex items-center gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSubmitting ? 'Memproses...' : 'Tambahkan Tagihan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}