"use client";

import { useState, useEffect } from 'react';
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  addDoc,
  getDocs,
  onSnapshot,
  doc,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';
import { Loader2, PlusCircle, X, RefreshCw, Download } from 'lucide-react';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

// --- INTERFACES ---
interface Pembayaran {
  id: string;
  tagihanId?: string; // field lama (jika ada)
  tagihanIds?: string[]; // field baru: array ID tagihan
  siswaId: string;
  jumlahBayar: number;
  tanggalBayar: Timestamp;
  dicatatOleh: string;
  sudahMasukArusKas?: boolean;
  transactionId?: string; // ID dari Midtrans, opsional
  status?: 'pending' | 'settlement' | 'expire' | 'cancel' | 'deny' | string; // Status dari Midtrans
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
  jenisBiayaList: string[];
}

interface Nomenklatur {
  id: string;
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
  const [userRole, setUserRole] = useState<string>("");
  const [userCabangNama, setUserCabangNama] = useState<string>("");
  const [filterTanggalMulai, setFilterTanggalMulai] = useState<string>("");
  const [filterTanggalSelesai, setFilterTanggalSelesai] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filteredLaporanList, setFilteredLaporanList] = useState<LaporanPenerimaan[]>([]);
  const [totalPenerimaan, setTotalPenerimaan] = useState<number>(0);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPenerimaan, setSelectedPenerimaan] = useState<LaporanPenerimaan | null>(null);
  const [selectedNomenklatur, setSelectedNomenklatur] = useState<string>("");

  // State sinkronisasi manual dengan Midtrans
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [selectedCabangInModal, setSelectedCabangInModal] = useState<string>("");
  const [nomenklaturPemasukanList, setNomenklaturPemasukanList] = useState<Nomenklatur[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- CEK ROLE USER (Kepala Sekolah hanya bisa lihat cabangnya sendiri) ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser?.email) {
        try {
          const q = query(collection(db, "guru"), where("email", "==", currentUser.email));
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

  // --- DATA FETCHING ---
  useEffect(() => {
    setLoading(true);
    // Gunakan real-time listener agar perubahan status dari webhook Midtrans
    // langsung tampil tanpa perlu reload halaman.
    const unsubscribe = onSnapshot(
      query(collection(db, "pembayaran"), orderBy("tanggalBayar", "desc")),
      async (pembayaranSnap) => {
        try {
          // Cek transaksi pending: minta backend sinkronkan dengan Midtrans
          // (cadangan jika webhook tidak tiba). Maksimal 5 terbaru agar ringan.
          const pendingToSync = pembayaranSnap.docs
            .filter(d => d.data().status === 'pending' && d.data().transactionId)
            .slice(0, 5);
          if (pendingToSync.length > 0) {
            await Promise.all(pendingToSync.map(d =>
              fetch('/api/midtrans/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ order_id: d.data().transactionId }),
              }).catch(() => null)
            ));
          }

          const [siswaSnap, tagihanSnap, cabangSnap, nomenklaturSnap] = await Promise.all([
            getDocs(collection(db, "siswa")),
            getDocs(collection(db, "tagihan_siswa")),
            getDocs(query(collection(db, "cabang"), orderBy("nama", "asc"))),
            getDocs(query(collection(db, "nomenklatur_keuangan"), where("kategori", "==", "Pemasukan"), orderBy("nama", "asc"))),
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

            // Dukung field baru (tagihanIds array) dan field lama (tagihanId tunggal)
            const tagihanIds = (pembayaran.tagihanIds && pembayaran.tagihanIds.length > 0)
              ? pembayaran.tagihanIds
              : (pembayaran.tagihanId ? [pembayaran.tagihanId] : []);

            const jenisBiayaList = tagihanIds
              .map(id => {
                const tagihan = tagihanMap.get(id);
                return tagihan
                  ? `${tagihan.jenisBiaya} ${tagihan.bulan} ${tagihan.tahun}`.trim()
                  : null;
              })
              .filter((jb): jb is string => jb !== null);

            const jenisBiaya = jenisBiayaList.length > 0
              ? jenisBiayaList[0] + (jenisBiayaList.length > 1 ? ` +${jenisBiayaList.length - 1} lainnya` : "")
              : "Tagihan Dihapus";

            return {
              ...pembayaran,
              namaSiswa: siswa?.nama || "Siswa Dihapus",
              cabangSiswa: siswa?.cabang || "N/A",
              transactionId: pembayaran.transactionId, // Gunakan transactionId dari pembayaran
              kelasSiswa: siswa?.kelas || "N/A",
              jenisBiaya,
              jenisBiayaList,
            };
          });

          setLaporanList(laporanData);
        } catch (error) {
          console.error("Error fetching data: ", error);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        console.error("Error listening to pembayaran:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
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

    if (filterStatus) {
      filtered = filtered.filter(item => {
        const status = item.status || 'manual';
        switch (filterStatus) {
          case 'sukses':
            return status === 'settlement' || status === 'capture';
          case 'manual':
            return !item.status;
          case 'pending':
            return status === 'pending';
          case 'expire':
            return status === 'expire';
          case 'gagal':
            return status === 'deny' || status === 'cancel' || status === 'error';
          default:
            return status === filterStatus;
        }
      });
    }

    setFilteredLaporanList(filtered); // This line is fine, the dependency array is the issue.
  }, [filterCabang, filterTanggalMulai, filterTanggalSelesai, filterStatus, laporanList, cabangList]);

  // Reset ke halaman 1 saat filter/data berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [filterCabang, filterTanggalMulai, filterTanggalSelesai, filterStatus, laporanList]);

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredLaporanList.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredLaporanList.length / itemsPerPage);

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

  // --- CALCULATE TOTAL & INITIAL FILTERED LIST ---
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

  // --- SINKRONISASI MANUAL DENGAN MIDTRANS ---
  const syncPembayaran = async (transactionIds: string[]) => {
    const results = await Promise.allSettled(
      transactionIds.map(orderId =>
        fetch('/api/midtrans/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId }),
        }).then(async (res) => {
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          return data;
        })
      )
    );
    const gagal = results.filter(r => r.status === 'rejected').length;
    if (gagal > 0) {
      alert(`${gagal} transaksi gagal disinkronkan. Cek log server untuk detail.`);
    }
    // Status di Firestore terupdate otomatis via onSnapshot listener
  };

  const handleSyncAll = async () => {
    const pendingIds = laporanList
      .filter(item => item.status === 'pending' && item.transactionId)
      .map(item => item.transactionId!);
    if (pendingIds.length === 0) {
      alert('Tidak ada transaksi tertunda yang perlu disinkronkan.');
      return;
    }
    setIsSyncingAll(true);
    await syncPembayaran(pendingIds);
    setIsSyncingAll(false);
  };

  const handleSyncOne = async (item: LaporanPenerimaan) => {
    if (!item.transactionId) return;
    setSyncingIds(prev => new Set(prev).add(item.id));
    await syncPembayaran([item.transactionId]);
    setSyncingIds(prev => {
      const next = new Set(prev);
      next.delete(item.id);
      return next;
    });
  };

  // --- DOWNLOAD EXCEL (mengikuti filter aktif) ---
  const handleDownloadExcel = () => {
    if (filteredLaporanList.length === 0) {
      alert('Tidak ada data untuk didownload.');
      return;
    }

    const dataForExcel = filteredLaporanList.map((item, i) => ({
      'No.': i + 1,
      'Tanggal Bayar': format(item.tanggalBayar.toDate(), 'dd MMMM yyyy'),
      'Nama Siswa': item.namaSiswa,
      'Cabang': item.cabangSiswa,
      'Kelas': item.kelasSiswa,
      'Jenis Biaya': item.jenisBiayaList.length > 0 ? item.jenisBiayaList.join('; ') : 'Tagihan Dihapus',
      'ID Transaksi': item.transactionId || '-',
      'Nominal Pembayaran': item.jumlahBayar,
      'Status Pembayaran': !item.status ? 'Manual' : item.status === 'settlement' || item.status === 'capture' ? 'Sukses' : item.status === 'pending' ? 'Tertunda' : item.status === 'expire' ? 'Kedaluwarsa' : item.status === 'deny' || item.status === 'cancel' || item.status === 'error' ? 'Gagal' : item.status,
      'Dicatat Oleh': item.dicatatOleh,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
    worksheet['!cols'] = [
      { wch: 5 }, { wch: 16 }, { wch: 25 }, { wch: 15 }, { wch: 10 },
      { wch: 28 }, { wch: 25 }, { wch: 18 }, { wch: 16 }, { wch: 22 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Penerimaan');

    const cabangNama = filterCabang
      ? cabangList.find(c => c.id === filterCabang)?.nama.replace(/\s+/g, '_')
      : 'Semua_Cabang';
    const tglMulai = filterTanggalMulai ? format(new Date(filterTanggalMulai), 'yyyyMMdd') : 'awal';
    const tglSelesai = filterTanggalSelesai ? format(new Date(filterTanggalSelesai), 'yyyyMMdd') : 'sekarang';

    const statusNama = filterStatus
      ? filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1)
      : 'Semua_Status';
    XLSX.writeFile(workbook, `Laporan_Penerimaan_${cabangNama}_${statusNama}_${tglMulai}-${tglSelesai}.xlsx`);
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Laporan Penerimaan</h1>

      {/* Tombol Aksi */}
      <div className="flex justify-end gap-2">
        <button
          onClick={handleDownloadExcel}
          disabled={loading || filteredLaporanList.length === 0}
          className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Download data sesuai filter yang aktif"
        >
          <Download className="w-4 h-4" />
          Download Excel
        </button>
        <button
          onClick={handleSyncAll}
          disabled={isSyncingAll}
          className="flex items-center gap-2 bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#45156b] transition disabled:opacity-50 disabled:cursor-not-allowed"
          title="Tarik status terbaru semua transaksi tertunda dari Midtrans"
        >
          {isSyncingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {isSyncingAll ? 'Menyinkronkan...' : 'Sinkronkan dengan Midtrans'}
        </button>
      </div>

      {/* Filters & Total */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Cabang</label>
          <select value={filterCabang} onChange={(e) => setFilterCabang(e.target.value)} disabled={userRole === "Kepala Sekolah"} className={`w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm ${userRole === "Kepala Sekolah" ? "bg-gray-100 cursor-not-allowed" : ""}`}>
            {userRole !== "Kepala Sekolah" && <option value="">Semua Cabang</option>}
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm">
            <option value="">Semua Status</option>
            <option value="sukses">Sukses</option>
            <option value="manual">Manual</option>
            <option value="pending">Tertunda</option>
            <option value="expire">Kedaluwarsa</option>
            <option value="gagal">Gagal</option>
          </select>
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
                <th className="p-4 text-center">Status Pembayaran</th>
                <th className="p-4">Dicatat Oleh</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={11} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : filteredLaporanList.length === 0 ? (
                <tr><td colSpan={11} className="p-8 text-center text-gray-500">Tidak ada data penerimaan yang cocok.</td></tr>
              ) : (
                currentItems.map((item, i) => {
                  const getStatusPill = (status?: string) => {
                    if (!status) return <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2 py-1 rounded-full">Manual</span>;
                    switch (status) {
                      case 'settlement':
                      case 'capture':
                        return <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">Sukses</span>;
                      case 'pending':
                        return <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">Tertunda</span>;
                      case 'expire':
                        return <span className="bg-gray-200 text-gray-800 text-xs font-semibold px-2 py-1 rounded-full">Kedaluwarsa</span>;
                      case 'deny':
                      case 'cancel':
                      case 'error':
                        return <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded-full">Gagal</span>;
                      default:
                        return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full">{status}</span>;
                    }
                  };
                  return (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-4 text-center">{i + 1}</td>
                      <td className="p-4">{format(item.tanggalBayar.toDate(), 'dd MMMM yyyy')}</td>
                      <td className="p-4 font-medium text-gray-900">{item.namaSiswa}</td>
                      <td className="p-4">{item.cabangSiswa}</td>
                      <td className="p-4">{item.kelasSiswa}</td>
                      <td className="p-4" title={item.jenisBiayaList.length > 0 ? item.jenisBiayaList.join(', ') : 'Tagihan tidak ditemukan'}>{item.jenisBiaya}</td>
                      <td className="p-4 text-xs text-gray-500 font-mono">
                        {item.transactionId || '-'}
                      </td>
                      <td className="p-4 font-semibold text-green-600">{formatCurrency(item.jumlahBayar)}</td>
                      <td className="p-4 text-center">{getStatusPill(item.status)}</td>
                      <td className="p-4">{item.dicatatOleh}</td>
                      <td className="p-4 text-center">
                        {item.status === 'pending' && item.transactionId && (
                          <button
                            onClick={() => handleSyncOne(item)}
                            disabled={syncingIds.has(item.id)}
                            className="text-[#581c87] hover:text-[#45156b] mr-2 disabled:opacity-50"
                            title="Tarik status terbaru dari Midtrans"
                          >
                            {syncingIds.has(item.id) ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                          </button>
                        )}
                        <button
                          onClick={() => openModal(item)}
                          disabled={item.sudahMasukArusKas || (item.status !== undefined && item.status !== 'settlement' && item.status !== 'capture' && item.status !== 'manual')}
                          className="text-green-600 hover:text-green-800 disabled:text-gray-300 disabled:cursor-not-allowed"
                          title={item.status === 'pending' ? 'Tunggu pembayaran selesai' : item.status === 'expire' || item.status === 'cancel' || item.status === 'deny' || item.status === 'error' ? 'Pembayaran gagal, tidak bisa ditambahkan' : 'Tambahkan ke Arus Kas'}
                        >
                          <PlusCircle className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && filteredLaporanList.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-sm text-gray-600">
            Menampilkan <span className="font-semibold">{indexOfFirstItem + 1}</span>–{" "}
            <span className="font-semibold">{Math.min(indexOfLastItem, filteredLaporanList.length)}</span> dari{" "}
            <span className="font-semibold">{filteredLaporanList.length}</span> transaksi
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
                    return <option key={n.id} value={n.nama}>{n.nama}</option>;
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