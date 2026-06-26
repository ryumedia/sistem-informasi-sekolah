"use client";

import { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  where,
  Timestamp,
} from "firebase/firestore";
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';

// --- INTERFACES ---
interface Pembayaran {
  id: string;
  tagihanId: string;
  siswaId: string;
  jumlahBayar: number;
  tanggalBayar: Timestamp;
  dicatatOleh: string;
}

interface Siswa {
  id: string;
  nama: string;
  cabang: string;
  kelas: string;
}

interface Tagihan {
  id: string;
  jenisBiaya: string;
  bulan: string;
  tahun: string;
}

interface Cabang {
  id: string;
  nama: string;
}

interface LaporanPenerimaan extends Pembayaran {
  namaSiswa: string;
  cabangSiswa: string;
  kelasSiswa: string;
  jenisBiaya: string;
}

export default function PenerimaanPage() {
  // --- STATE MANAGEMENT ---
  const [laporanList, setLaporanList] = useState<LaporanPenerimaan[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [filterCabang, setFilterCabang] = useState<string>("");
  const [filterTanggalMulai, setFilterTanggalMulai] = useState<string>("");
  const [filterTanggalSelesai, setFilterTanggalSelesai] = useState<string>("");
  const [filteredLaporanList, setFilteredLaporanList] = useState<LaporanPenerimaan[]>([]);
  const [totalPenerimaan, setTotalPenerimaan] = useState<number>(0);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all necessary data in parallel for efficiency
        const [pembayaranSnap, siswaSnap, tagihanSnap, cabangSnap] = await Promise.all([
          getDocs(query(collection(db, "pembayaran"), orderBy("tanggalBayar", "desc"))),
          getDocs(collection(db, "siswa")),
          getDocs(collection(db, "tagihan_siswa")),
          getDocs(query(collection(db, "cabang"), orderBy("nama", "asc"))),
        ]);

        // Create maps for quick lookups to avoid N+1 query problem
        const siswaMap = new Map(siswaSnap.docs.map(doc => [doc.id, doc.data() as Siswa]));
        const tagihanMap = new Map(tagihanSnap.docs.map(doc => [doc.id, doc.data() as Tagihan]));

        const cabangData = cabangSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cabang));
        setCabangList(cabangData);

        // Process and join data
        const laporanData = pembayaranSnap.docs.map(doc => {
          const pembayaran = { id: doc.id, ...doc.data() } as Pembayaran;
          const siswa = siswaMap.get(pembayaran.siswaId);
          const tagihan = tagihanMap.get(pembayaran.tagihanId);

          return {
            ...pembayaran,
            namaSiswa: siswa?.nama || "Siswa Dihapus",
            cabangSiswa: siswa?.cabang || "N/A",
            kelasSiswa: siswa?.kelas || "N/A",
            jenisBiaya: tagihan 
              ? `${tagihan.jenisBiaya} ${tagihan.bulan} ${tagihan.tahun}` 
              : "Tagihan Dihapus",
          };
        });

        setLaporanList(laporanData);
        setFilteredLaporanList(laporanData);

      } catch (error) {
        console.error("Error fetching data: ", error);
        alert("Gagal memuat data laporan. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // --- FILTERING LOGIC ---
  useEffect(() => {
    let filtered = laporanList;

    if (filterCabang) {
      const selectedCabang = cabangList.find(c => c.id === filterCabang);
      if (selectedCabang) {
        filtered = filtered.filter(item => item.cabangSiswa === selectedCabang.nama);
      }
    }

    if (filterTanggalMulai) {
      const startDate = new Date(filterTanggalMulai);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(item => item.tanggalBayar.toDate() >= startDate);
    }

    if (filterTanggalSelesai) {
      const endDate = new Date(filterTanggalSelesai);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(item => item.tanggalBayar.toDate() <= endDate);
    }

    setFilteredLaporanList(filtered);
  }, [filterCabang, filterTanggalMulai, filterTanggalSelesai, laporanList, cabangList]);

  // --- CALCULATE TOTAL ---
  useEffect(() => {
    const total = filteredLaporanList.reduce((sum, item) => sum + item.jumlahBayar, 0);
    setTotalPenerimaan(total);
  }, [filteredLaporanList]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Laporan Penerimaan</h1>

      {/* Filters & Total */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Cabang</label>
          <select value={filterCabang} onChange={(e) => setFilterCabang(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm">
            <option value="">Semua Cabang</option>
            {cabangList.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
          <input type="date" value={filterTanggalMulai} onChange={(e) => setFilterTanggalMulai(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Selesai</label>
          <input type="date" value={filterTanggalSelesai} onChange={(e) => setFilterTanggalSelesai(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm" />
        </div>
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-center h-full flex flex-col justify-center">
            <p className="text-sm text-green-800 font-medium">Total Penerimaan (Filtered)</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{formatCurrency(totalPenerimaan)}</p>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16 text-center">No.</th>
                <th className="p-4">Tanggal Bayar</th>
                <th className="p-4">Nama Siswa</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Kelas</th>
                <th className="p-4">Jenis Biaya</th>
                <th className="p-4">Nominal Pembayaran</th>
                <th className="p-4">Dicatat Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : filteredLaporanList.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Tidak ada data penerimaan yang cocok.</td></tr>
              ) : (
                filteredLaporanList.map((item, i) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{i + 1}</td>
                    <td className="p-4">{format(item.tanggalBayar.toDate(), 'dd MMMM yyyy')}</td>
                    <td className="p-4 font-medium text-gray-900">{item.namaSiswa}</td>
                    <td className="p-4">{item.cabangSiswa}</td>
                    <td className="p-4">{item.kelasSiswa}</td>
                    <td className="p-4">{item.jenisBiaya}</td>
                    <td className="p-4 font-semibold text-green-600">{formatCurrency(item.jumlahBayar)}</td>
                    <td className="p-4">{item.dicatatOleh}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}