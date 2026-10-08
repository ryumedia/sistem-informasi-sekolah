﻿﻿"use client";

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
import { Eye, Send, Loader2, Plus, X, Search } from 'lucide-react';

// --- INTERFACES ---
interface Siswa {
  id: string;
  nama: string;
  cabang: string;
  kelas: string;
  noWA?: string;
}

interface Tagihan {
  id: string;
  siswaId: string;
  bulan: string;
  tahun: string;
  status: 'Lunas' | 'Belum Lunas';
  nominal?: number;
  jenisBiaya?: string;
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
  diskon?: number; // Persentase diskon (0-100)
  penerapan: 'semua' | 'cabang_tertentu' | 'kelas_tertentu';
  cabangIds?: string[];
  kelasIds?: string[];
}

// Hitung nominal setelah diskon
const hitungSetelahDiskon = (nominal: number, diskon?: number) => {
  const nilaiDiskon = Math.min(Math.max(diskon || 0, 0), 100);
  return Math.round(nominal * (1 - nilaiDiskon / 100));
};

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
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all'|'paid'|'unpaid'>('all');
  const [filterCabang, setFilterCabang] = useState<string>("");
  const [userRole, setUserRole] = useState<string>("");
  const [userCabangNama, setUserCabangNama] = useState<string>("");
  const [filterKelas, setFilterKelas] = useState<string>("");
  const [filteredSiswaList, setFilteredSiswaList] = useState<SiswaWithStatus[]>([]);
  const [kelasOptions, setKelasOptions] = useState<Kelas[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Bulk Add Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [sendingTagihanId, setSendingTagihanId] = useState<string | null>(null);

  // Peta siswaId -> tagihan sesuai filter bulan/tahun yang dipilih
  const tagihanBySiswa = useMemo(() => {
    const map: Record<string, Tagihan | undefined> = {};
    tagihanList.forEach(t => {
      if (t.bulan === filterBulan && t.tahun === filterTahun) {
        map[t.siswaId] = t;
      }
    });
    return map;
  }, [tagihanList, filterBulan, filterTahun]);

  // Ringkasan sesuai filter: jumlah siswa & total nominal tagihan
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };
  const ringkasan = useMemo(() => {
    const jumlahSiswa = filteredSiswaList.length;
    // Total nominal tagihan dari siswa yang tampil (sesuai filter) untuk periode terpilih
    let totalNominal = 0;
    filteredSiswaList.forEach(s => {
      const t = tagihanBySiswa[s.id];
      if (t && t.nominal) totalNominal += t.nominal;
    });
    return { jumlahSiswa, totalNominal };
  }, [filteredSiswaList, tagihanBySiswa]);

  // --- KIRIM NOTIFIKASI TAGIHAN ---
  const handleKirimTagihan = async (siswaId: string) => {
    // Cari tagihan siswa yang sesuai filter bulan/tahun dan belum lunas
    const tagihan = tagihanList.find(t =>
      t.siswaId === siswaId &&
      t.bulan === filterBulan &&
      t.tahun === filterTahun
    );

    if (!tagihan) {
      alert(`Tidak ada tagihan untuk ${filterBulan} ${filterTahun}.`);
      return;
    }

    setSendingTagihanId(tagihan.id);
    try {
      const response = await fetch('/api/notifikasi/tagihan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagihanId: tagihan.id }),
      });
      const data = await response.json();

      if (data.skipped) {
        alert(`Notifikasi dilewati: ${data.reason}`);
      } else if (data.sent) {
        alert('Notifikasi tagihan berhasil dikirim ke WhatsApp siswa.');
      } else if (data.error) {
        alert(`Gagal mengirim: ${data.error}`);
      }
    } catch (error) {
      console.error('Error mengirim notifikasi tagihan:', error);
      alert('Terjadi kesalahan saat mengirim notifikasi.');
    } finally {
      setSendingTagihanId(null);
    }
  };

  // --- DATA FETCHING & AUTH ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user?.email) {
        try {
          const q = query(collection(db, "guru"), where("email", "==", user.email));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const userData = snap.docs[0].data();
            setUserRole(userData.role);
            if (userData.cabang) setUserCabangNama(userData.cabang);
          }
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Kunci filter cabang sesuai cabang Kepala Sekolah (butuh cabangList untuk resolve ID)
  useEffect(() => {
    if (userRole === "Kepala Sekolah" && userCabangNama && cabangList.length > 0) {
      const cabangKS = cabangList.find(c => c.nama === userCabangNama);
      if (cabangKS) setFilterCabang(cabangKS.id);
    }
  }, [userRole, userCabangNama, cabangList]);

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [cabangSnap, kelasSnap, siswaSnap, tagihanSnap, jenisBiayaSnap] = await Promise.all([
          getDocs(query(collection(db, "cabang"), orderBy("nama", "asc"))),
          getDocs(query(collection(db, "kelas"), orderBy("namaKelas", "asc"))),
          getDocs(query(collection(db, "siswa"), where("status", "==", "Aktif"), orderBy("nama", "asc"))),
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

    if (statusFilter === 'paid') {
      filtered = filtered.filter(siswa => siswa.statusPembayaran === 'Lunas');
    } else if (statusFilter === 'unpaid') {
      filtered = filtered.filter(siswa => siswa.statusPembayaran === 'Belum Lunas');
    }

    if (searchTerm.trim()) {
      const normalizedSearchTerm = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(siswa =>
        siswa.nama.toLowerCase().includes(normalizedSearchTerm)
      );
    }

    if (filterKelas) {
      const selectedKelas = kelasList.find(k => k.id === filterKelas);
      if (selectedKelas) {
        filtered = filtered.filter(siswa => siswa.kelas === selectedKelas.namaKelas);
      }
    }

    setFilteredSiswaList(filtered);
  }, [filterCabang, filterKelas, filterTahun, filterBulan, searchTerm, statusFilter, siswaList, tagihanList, cabangList, kelasList]);

  // Reset ke halaman 1 saat filter/data berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [filterCabang, filterKelas, filterTahun, filterBulan, searchTerm, statusFilter, siswaList]);

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSiswaList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredSiswaList.length / itemsPerPage);

  const getPageNumbers = () => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 3) return [1, 2, 3, 4, 5];
    if (currentPage >= totalPages - 2) {
      return Array.from({ length: maxButtons }, (_, i) => totalPages - maxButtons + 1 + i);
    }
    return [currentPage - 2, currentPage - 1, currentPage, currentPage + 1, currentPage + 2];
  };

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Cabang</label>
          <select
            value={filterCabang}
            onChange={(e) => setFilterCabang(e.target.value)}
            disabled={userRole === "Kepala Sekolah"}
            className={`w-full max-w-xs border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm ${userRole === "Kepala Sekolah" ? "bg-gray-100 cursor-not-allowed" : ""}`}
          >
            {userRole !== "Kepala Sekolah" && <option value="">Semua Cabang</option>}
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
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Status Pembayaran</label>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'paid' | 'unpaid')} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm">
            <option value="all">Semua Status</option>
            <option value="paid">Lunas</option>
            <option value="unpaid">Belum Lunas</option>
          </select>
        </div>
        <div className="flex-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="search-siswa" className="block text-sm font-medium text-gray-700">Cari Nama Siswa</label>
            {/* Ringkasan mengikuti filter aktif */}
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-500">
                Siswa: <span className="font-bold text-[#581c87]">{ringkasan.jumlahSiswa}</span>
              </span>
              <span className="text-gray-500">
                Total Tagihan: <span className="font-bold text-green-700">{formatCurrency(ringkasan.totalNominal)}</span>
              </span>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              id="search-siswa"
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Ketik nama siswa..."
              className="w-full border rounded-lg p-2 pl-9 focus:ring-2 focus:ring-[#581c87] outline-none text-sm"
            />
          </div>
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
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Tidak ada data siswa yang cocok.</td></tr>
              ) : (
                currentItems.map((siswa, i) => (
                  <tr key={siswa.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{indexOfFirstItem + i + 1}</td>
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
                                            {siswa.statusPembayaran !== 'Lunas' && (
                        <button
                          onClick={() => handleKirimTagihan(siswa.id)}
                          disabled={sendingTagihanId !== null}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Kirim Notifikasi Tagihan via WhatsApp"
                        >
                          {sendingTagihanId === tagihanBySiswa[siswa.id]?.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Send className="w-4 h-4" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && filteredSiswaList.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-sm text-gray-600">
            Menampilkan <span className="font-semibold">{indexOfFirstItem + 1}</span>–{" "}
            <span className="font-semibold">{Math.min(indexOfLastItem, filteredSiswaList.length)}</span> dari{" "}
            <span className="font-semibold">{filteredSiswaList.length}</span> siswa
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            {getPageNumbers().map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${
                  currentPage === page
                    ? "bg-[#581c87] text-white font-medium"
                    : "border border-gray-300 text-gray-600 hover:bg-gray-50"
                }`}
              >
                {page}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

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
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };
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

  const selectedJenisBiayaDiskon = useMemo(() => {
    const selected = jenisBiayaList.find(jb => jb.id === formData.jenisBiayaId);
    return selected?.diskon || 0;
  }, [formData.jenisBiayaId, jenisBiayaList]);

  const handleJenisBiayaChange = (id: string) => {
    const selected = jenisBiayaList.find(jb => jb.id === id);
    // Terapkan diskon dari jenis biaya (jika ada) ke nominal tagihan
    setFormData(prev => ({
      ...prev,
      jenisBiayaId: id,
      nominal: selected ? hitungSetelahDiskon(selected.nominal, selected.diskon) : 0,
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
          <div><label className="block text-sm font-medium text-gray-700 mb-1">Jenis Biaya</label><select required value={formData.jenisBiayaId} onChange={e => handleJenisBiayaChange(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" disabled={!formData.kelasId}><option value="">Pilih Jenis Biaya</option>{filteredJenisBiaya.map(jb => <option key={jb.id} value={jb.id}>{jb.nama}{(jb.diskon || 0) > 0 ? ` (diskon ${jb.diskon}%)` : ''}</option>)}</select></div>
          {selectedJenisBiayaDiskon > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm flex justify-between items-center">
              <span className="text-orange-800">Diskon diterapkan: <strong>{selectedJenisBiayaDiskon}%</strong></span>
              <span className="text-orange-900">Nilai setelah diskon: <strong>{formatCurrency(formData.nominal)}</strong></span>
            </div>
          )}
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