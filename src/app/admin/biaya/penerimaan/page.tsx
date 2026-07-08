"use client";

import { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { Loader2, PlusCircle, X } from 'lucide-react';
import { format } from 'date-fns';

// --- INTERFACES ---
interface Pembayaran {
  id: string;
  tagihanId: string;
  siswaId: string;
  jumlahBayar: number;
  tanggalBayar: Timestamp;
  dicatatOleh: string;
  sudahMasukArusKas?: boolean;
  transactionId?: string; // ID dari Midtrans, opsional
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

interface Nomenklatur {
  id: string;
  kode: string;
  nama: string;
  kategori: string;
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

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPenerimaan, setSelectedPenerimaan] = useState<LaporanPenerimaan | null>(null);
  const [selectedNomenklatur, setSelectedNomenklatur] = useState<string>("");
  const [selectedCabangInModal, setSelectedCabangInModal] = useState<string>("");
  const [nomenklaturPemasukanList, setNomenklaturPemasukanList] = useState<Nomenklatur[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch all necessary data in parallel for efficiency
        const [pembayaranSnap, siswaSnap, tagihanSnap, cabangSnap, nomenklaturSnap] = await Promise.all([
          getDocs(query(collection(db, "pembayaran"), orderBy("tanggalBayar", "desc"))),
          getDocs(collection(db, "siswa")),
          getDocs(collection(db, "tagihan_siswa")),
          getDocs(query(collection(db, "cabang"), orderBy("nama", "asc"))),
          getDocs(query(collection(db, "nomenklatur"), where("kategori", "==", "Pemasukan"), orderBy("kode", "asc"))),
        ]);

        // Create maps for quick lookups to avoid N+1 query problem
        const siswaMap = new Map(siswaSnap.docs.map(doc => [doc.id, doc.data() as Siswa]));
        const tagihanMap = new Map(tagihanSnap.docs.map(doc => [doc.id, doc.data() as Tagihan]));

        const cabangData = cabangSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cabang));
        setCabangList(cabangData);

        const nomenklaturData = nomenklaturSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Nomenklatur));
        setNomenklaturPemasukanList(nomenklaturData);

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

  const openModal = (penerimaan: LaporanPenerimaan) => {
    setSelectedPenerimaan(penerimaan);
    setSelectedCabangInModal(penerimaan.cabangSiswa); // Set default cabang di modal
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedPenerimaan(null);
    setSelectedCabangInModal("");
    setSelectedNomenklatur("");
    setIsSubmitting(false);
  };

  const handleTambahPemasukan = async () => {
    if (!selectedPenerimaan || !selectedNomenklatur) {
      alert("Silakan pilih nomenklatur terlebih dahulu.");
      return;
    }
    setIsSubmitting(true);
    try {
      const arusKasCollection = collection(db, 'arus_kas');
      await addDoc(arusKasCollection, {
        tanggal: selectedPenerimaan.tanggalBayar,
        jenis: 'Masuk',
        nominal: selectedPenerimaan.jumlahBayar,
        keterangan: `${selectedPenerimaan.jenisBiaya} ${selectedPenerimaan.namaSiswa}`, // Pastikan namaSiswa ada di LaporanPenerimaan
        nomenklatur: selectedNomenklatur,
        cabang: selectedCabangInModal,
        refId: selectedPenerimaan.id, // Referensi ke dokumen pembayaran
        dicatatOleh: 'Sistem (dari Laporan Penerimaan)',
      });

      // 1. Tandai bahwa pembayaran ini sudah masuk ke arus kas di database
      const pembayaranRef = doc(db, "pembayaran", selectedPenerimaan.id);
      await updateDoc(pembayaranRef, {
        sudahMasukArusKas: true
      });

      // 2. Perbarui state lokal agar UI langsung berubah tanpa perlu refresh
      setFilteredLaporanList(prevList => 
        prevList.map(item => 
          item.id === selectedPenerimaan.id 
            ? { ...item, sudahMasukArusKas: true } 
            : item
        )
      );

      alert('Pemasukan berhasil ditambahkan ke Arus Kas!');
      closeModal();

    } catch (error) {
      console.error("Error adding to cash flow: ", error);
      alert("Gagal menambahkan pemasukan. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
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
                <th className="p-4">ID Transaksi</th>
                <th className="p-4">Nominal Pembayaran</th>
                <th className="p-4">Dicatat Oleh</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : filteredLaporanList.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-gray-500">Tidak ada data penerimaan yang cocok.</td></tr>
              ) : (
                filteredLaporanList.map((item, i) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{i + 1}</td>
                    <td className="p-4">{format(item.tanggalBayar.toDate(), 'dd MMMM yyyy')}</td>
                    <td className="p-4 font-medium text-gray-900">{item.namaSiswa}</td>
                    <td className="p-4">{item.cabangSiswa}</td>
                    <td className="p-4">{item.kelasSiswa}</td>
                    <td className="p-4">{item.jenisBiaya}</td>
                    <td className="p-4 text-xs text-gray-500 font-mono">
                      {item.transactionId || '-'}
                    </td>
                    <td className="p-4 font-semibold text-green-600">{formatCurrency(item.jumlahBayar)}</td>
                    <td className="p-4">{item.dicatatOleh}</td>
                    <td className="p-4 text-center">
                      <button 
                        onClick={() => openModal(item)}
                        disabled={item.sudahMasukArusKas}
                        className="text-green-600 hover:text-green-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                        title="Tambahkan ke Arus Kas"
                      >
                        <PlusCircle className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Pemasukan ke Arus Kas */}
      {isModalOpen && selectedPenerimaan && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Tambah Pemasukan ke Arus Kas</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {/* Detail Transaksi */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between"><span>Tanggal:</span><span className="font-medium text-right">{format(selectedPenerimaan.tanggalBayar.toDate(), 'dd MMMM yyyy')}</span></div>
                <div className="flex justify-between"><span>Nama Siswa:</span><span className="font-medium text-right">{selectedPenerimaan.namaSiswa}</span></div>                
                <div className="flex justify-between"><span>Jenis Biaya:</span><span className="font-medium text-right">{selectedPenerimaan.jenisBiaya}</span></div>
                <div className="flex justify-between text-base"><span>Nominal:</span><span className="font-bold text-green-600 text-right">{formatCurrency(selectedPenerimaan.jumlahBayar)}</span></div>
              </div>

              {/* Pilihan Cabang & Nomenklatur */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                <select 
                  value={selectedCabangInModal} 
                  onChange={(e) => setSelectedCabangInModal(e.target.value)} 
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm bg-white"
                >
                  <option value="">Pilih Cabang</option>
                  {cabangList.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nomenklatur Pemasukan</label>
                <select 
                  value={selectedNomenklatur} 
                  onChange={(e) => setSelectedNomenklatur(e.target.value)} 
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm bg-white"
                >
                  <option value="">Pilih Nomenklatur</option>
                  {nomenklaturPemasukanList.map(n => {
                    const displayText = `${n.kode} - ${n.nama}`;
                    return (
                      <option key={n.id} value={displayText}>{displayText}</option>
                    );
                  })}
                </select>
              </div>

            </div>
            <div className="p-4 bg-gray-50 border-t rounded-b-xl">
              <button 
                onClick={handleTambahPemasukan} 
                disabled={isSubmitting || !selectedNomenklatur} 
                className="w-full bg-[#581c87] text-white py-3 rounded-lg hover:bg-[#45156b] transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
                {isSubmitting ? 'Menyimpan...' : 'Tambah Pemasukan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}