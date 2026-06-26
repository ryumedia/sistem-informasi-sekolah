"use client";

import { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { ArrowLeft, Loader2, CreditCard, X } from 'lucide-react';

// --- INTERFACES ---
interface Tagihan {
  id: string;
  jenisBiaya: string;
  bulan: string;
  tahun: string;
  nominal: number;
  status: 'Lunas' | 'Belum Lunas';
  dibayar?: number;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

export default function PembayaranView({ userData, onBack }: { user: any, userData: any, onBack: () => void }) {
  const [tagihanList, setTagihanList] = useState<Tagihan[]>([]);
  const [loading, setLoading] = useState(true);
  // State untuk filter dan data turunan
  const [filteredTagihanList, setFilteredTagihanList] = useState<Tagihan[]>([]);
  const [uniqueYears, setUniqueYears] = useState<string[]>([]);
  const [filterTahun, setFilterTahun] = useState<string>('semua');
  const [totalSisa, setTotalSisa] = useState<number>(0);

  // State untuk modal pembayaran
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedTagihan, setSelectedTagihan] = useState<Tagihan | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);


  useEffect(() => {
    if (!userData?.id) return;

    const fetchTagihan = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "tagihan_siswa"),
          where("siswaId", "==", userData.id),
          orderBy("tahun", "desc")
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tagihan));
        
        // Urutkan berdasarkan tahun (terbaru) lalu bulan
        const monthOrder: { [key: string]: number } = { 'Januari': 1, 'Februari': 2, 'Maret': 3, 'April': 4, 'Mei': 5, 'Juni': 6, 'Juli': 7, 'Agustus': 8, 'September': 9, 'Oktober': 10, 'November': 11, 'Desember': 12 };
        list.sort((a, b) => {
            if (a.tahun !== b.tahun) return parseInt(a.tahun) - parseInt(b.tahun);
            return (monthOrder[a.bulan] || 0) - (monthOrder[b.bulan] || 0);
        });

        setTagihanList(list);
        const years = [...new Set(list.map(t => t.tahun))].sort((a, b) => parseInt(b) - parseInt(a));
        setUniqueYears(years);
      } catch (error) {
        console.error("Error fetching tagihan:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTagihan();
  }, [userData]);

  // Efek untuk memfilter data dan menghitung total sisa
  useEffect(() => {
    let filtered = tagihanList;
    if (filterTahun !== 'semua') {
      filtered = tagihanList.filter(t => t.tahun === filterTahun);
    }
    setFilteredTagihanList(filtered);

    // --- LOGIKA BARU UNTUK MENGHITUNG TOTAL SISA ---
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() is 0-indexed, so +1
    const monthOrder: { [key: string]: number } = { 'Januari': 1, 'Februari': 2, 'Maret': 3, 'April': 4, 'Mei': 5, 'Juni': 6, 'Juli': 7, 'Agustus': 8, 'September': 9, 'Oktober': 10, 'November': 11, 'Desember': 12 };

    const total = filtered
      .filter(item => {
        const itemYear = parseInt(item.tahun);
        const itemMonth = monthOrder[item.bulan];
        // Hanya hitung jika tahun item lebih kecil ATAU jika tahun sama dan bulan item lebih kecil atau sama dengan bulan sekarang
        return itemYear < currentYear || (itemYear === currentYear && itemMonth <= currentMonth);
      })
      .reduce((sum, item) => {
      const sisa = item.nominal - (item.dibayar || 0);
      return sum + (sisa > 0 ? sisa : 0);
    }, 0);
    setTotalSisa(total);
  }, [tagihanList, filterTahun]);

  const openPaymentModal = (tagihan: Tagihan) => {
    const sisa = tagihan.nominal - (tagihan.dibayar || 0);
    setSelectedTagihan(tagihan);
    setPaymentAmount(sisa > 0 ? sisa : 0);
    setIsPaymentModalOpen(true);
  };

  const closePaymentModal = () => {
    setIsPaymentModalOpen(false);
    setSelectedTagihan(null);
    setPaymentAmount(0);
  };

  const handlePaymentAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    const numericValue = rawValue ? parseInt(rawValue, 10) : 0;
    setPaymentAmount(numericValue);
  };

  const handleLanjutPembayaran = () => {
    // Logika untuk integrasi payment gateway akan ditambahkan di sini
    console.log(`Lanjut pembayaran untuk tagihan ${selectedTagihan?.id} sebesar ${formatCurrency(paymentAmount)}`);
    alert("Fitur ini akan segera diintegrasikan dengan Payment Gateway.");
  };

  return (
    <div className="flex-1 bg-gray-50 min-h-screen flex flex-col">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-800">Riwayat Pembayaran</h1>
      </header>

      <div className="p-4 space-y-6">
        {/* Filter dan Ringkasan */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl shadow-sm">
            <label className="block text-xs font-medium text-gray-500 mb-1">Filter Berdasarkan Tahun</label>
            <select value={filterTahun} onChange={e => setFilterTahun(e.target.value)} className="w-full border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87]">
              <option value="semua">Semua Tahun</option>
              {uniqueYears.map(year => <option key={year} value={year}>{year}</option>)}
            </select>
          </div>
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-center flex flex-col justify-center">
            <p className="text-sm text-red-800 font-medium">Total Sisa Pembayaran</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{formatCurrency(totalSisa)}</p>
          </div>
        </div>

        {/* Daftar Tagihan */}
        {loading ? (
          <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
        ) : filteredTagihanList.length === 0 ? (
          <div className="text-center py-10 text-gray-500 bg-white rounded-lg shadow-sm">
            {filterTahun === 'semua' ? 'Belum ada riwayat tagihan.' : `Tidak ada tagihan untuk tahun ${filterTahun}.`}
          </div>
        ) : (
          filteredTagihanList.map(tagihan => {
            const dibayar = tagihan.dibayar || 0;
            const sisa = tagihan.nominal - dibayar;
            const isLunas = sisa <= 0;

            return (
              <div key={tagihan.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-bold text-gray-800">{tagihan.jenisBiaya}</h3>
                    <p className="text-xs text-gray-500">{tagihan.bulan} {tagihan.tahun}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isLunas ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {isLunas ? 'Lunas' : 'Belum Lunas'}
                  </span>
                </div>
                <div className="space-y-2 text-sm border-t pt-3">
                  <div className="flex justify-between"><span>Total Tagihan:</span><span className="font-medium">{formatCurrency(tagihan.nominal)}</span></div>
                  <div className="flex justify-between"><span>Dibayar:</span><span className="font-medium text-green-600">{formatCurrency(dibayar)}</span></div>
                  <div className="flex justify-between"><span>Sisa:</span><span className="font-bold text-red-600">{formatCurrency(sisa)}</span></div>
                </div>
                {!isLunas && (
                  <div className="border-t mt-4 pt-4 flex justify-end">
                    <button onClick={() => openPaymentModal(tagihan)} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition text-sm">
                      <CreditCard className="w-4 h-4" /> Bayar Sekarang
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal Pembayaran */}
      {isPaymentModalOpen && selectedTagihan && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Detail Pembayaran</h3>
              <button onClick={closePaymentModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Nama Siswa:</span><span className="font-medium text-right">{userData.nama}</span></div>
                <div className="flex justify-between"><span>Cabang:</span><span className="font-medium text-right">{userData.cabang}</span></div>
                <div className="flex justify-between"><span>Jenis Pembayaran:</span><span className="font-medium text-right">{`${selectedTagihan.jenisBiaya} ${selectedTagihan.bulan} ${selectedTagihan.tahun}`}</span></div>
              </div>
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nominal Pembayaran</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">Rp</span>
                  <input 
                    type="text" 
                    value={new Intl.NumberFormat('id-ID').format(paymentAmount)}
                    onChange={handlePaymentAmountChange}
                    className="w-full border rounded-lg p-2 pl-8 text-lg font-bold text-gray-800 text-right focus:ring-2 focus:ring-[#581c87] outline-none" 
                  />
                </div>
              </div>
              <div className="pt-2">
                <button onClick={handleLanjutPembayaran} className="w-full bg-[#581c87] text-white py-3 rounded-lg hover:bg-[#45156b] transition font-medium">
                  Lanjut Pembayaran
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}