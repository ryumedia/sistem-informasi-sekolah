"use client";

import { useState, useEffect, useMemo } from 'react';
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  Timestamp,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, CreditCard, X, History, ListChecks, ShoppingCart, CheckSquare, Square } from 'lucide-react';

// --- INTERFACES ---
interface Tagihan {
  id: string;
  jenisBiaya: string;
  bulan: string;
  tahun: string;
  nominal: number;
  status: 'Lunas' | 'Belum Lunas';
  dibayar?: number;
  nominalAwal?: number; // Nominal sebelum diskon
  diskonJenis?: number; // Diskon dari jenis biaya (%)
  diskonIndividual?: number; // Diskon individual per siswa (%)
}

interface Pembayaran {
  id: string;
  tagihanId?: string;
  tagihanIds?: string[]; // Mode keranjang: beberapa tagihan dalam satu transaksi
  transactionId?: string; // order_id dari Midtrans
  jumlahBayar: number;
  tanggalBayar: Timestamp;
  status: 'pending' | 'settlement' | 'expire' | 'cancel' | 'deny' | string;
  jenisBiaya: string; // Untuk tampilan di riwayat (jenis pertama + "+N lainnya")
  jenisBiayaList?: string[]; // Daftar lengkap semua jenis biaya yang dibayar
  bulan: string;
  tahun: string;
}

const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
};

// Hitung nominal setelah diskon (persentase 0-100)
const hitungSetelahDiskon = (nominal: number, diskon?: number) => {
  const nilaiDiskon = Math.min(Math.max(diskon || 0, 0), 100);
  return Math.round(nominal * (1 - nilaiDiskon / 100));
};

export default function PembayaranView({ userData, onBack }: { user: any, userData: any, onBack: () => void }) {
  const router = useRouter();
  const [tagihanList, setTagihanList] = useState<Tagihan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tagihan' | 'riwayat'>('tagihan');
  const [riwayatList, setRiwayatList] = useState<Pembayaran[]>([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(true);
  // State untuk filter dan data turunan
  const [filteredTagihanList, setFilteredTagihanList] = useState<Tagihan[]>([]);
  const [uniqueYears, setUniqueYears] = useState<string[]>([]);
  const [filterTahun, setFilterTahun] = useState<string>('semua');
  const [totalSisa, setTotalSisa] = useState<number>(0);

  // State keranjang pembayaran
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isResumingPayment, setIsResumingPayment] = useState<string | null>(null); // Menyimpan ID pembayaran yang sedang dilanjutkan
  // Modal detail rincian jenis biaya
  const [detailItem, setDetailItem] = useState<Pembayaran | null>(null);


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

        // Urutkan dari yang terbaru ke terlama (tahun desc, lalu bulan desc)
        const monthOrder: { [key: string]: number } = { 'Januari': 1, 'Februari': 2, 'Maret': 3, 'April': 4, 'Mei': 5, 'Juni': 6, 'Juli': 7, 'Agustus': 8, 'September': 9, 'Oktober': 10, 'November': 11, 'Desember': 12 };
        list.sort((a, b) => {
            if (a.tahun !== b.tahun) return parseInt(b.tahun) - parseInt(a.tahun);
            return (monthOrder[b.bulan] || 0) - (monthOrder[a.bulan] || 0);
        });

        setTagihanList(list);
        const years = [...new Set(list.map(t => t.tahun))].sort((a, b) => parseInt(b) - parseInt(a));
        setUniqueYears(years);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTagihan();
  }, [userData?.id]);

  useEffect(() => {
    if (!userData?.id || activeTab !== 'riwayat') return;

    const fetchRiwayat = async () => {
      setLoadingRiwayat(true);
      try {
        // Ambil data tagihan terbaru untuk mapping, jika belum ada
        let localTagihanList = tagihanList;
        if (localTagihanList.length === 0) {
            const tagihanQuery = query(collection(db, "tagihan_siswa"), where("siswaId", "==", userData.id));
            const tagihanSnap = await getDocs(tagihanQuery);
            localTagihanList = tagihanSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tagihan));
        }
        const tagihanMap = new Map(localTagihanList.map(t => [t.id, t]));

        const q = query(
          collection(db, "pembayaran"),
          where("siswaId", "==", userData.id),
          orderBy("tanggalBayar", "desc")
        );
        const snap = await getDocs(q);
        setRiwayatList(snap.docs.map(doc => {
          const pembayaranData = doc.data();
          // Dukung mode keranjang (tagihanIds array) dan mode lama (tagihanId tunggal)
          const ids: string[] = (pembayaranData.tagihanIds && pembayaranData.tagihanIds.length > 0)
            ? pembayaranData.tagihanIds
            : (pembayaranData.tagihanId ? [pembayaranData.tagihanId] : []);

          const jenisBiayaList = ids
            .map(id => tagihanMap.get(id))
            .filter((t): t is Tagihan => !!t)
            .map(t => `${t.jenisBiaya} ${t.bulan} ${t.tahun}`.trim());

          const jenisUtama = jenisBiayaList[0] || 'N/A';
          const sisaCount = jenisBiayaList.length > 1 ? jenisBiayaList.length - 1 : 0;

          return {
            id: doc.id,
            ...pembayaranData,
            jenisBiaya: jenisUtama + (sisaCount > 0 ? ` +${sisaCount} lainnya` : ''),
            jenisBiayaList,
            bulan: '',
            tahun: '',
          } as Pembayaran;
        }));
      } catch (error) {
        console.error("Error fetching payment history:", error);
      } finally {
        setLoadingRiwayat(false);
      }
    };
    fetchRiwayat();
  }, [userData?.id, activeTab, tagihanList]);

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

  // Hapus pilihan yang tidak lagi valid (misal tagihan sudah lunas / tidak tampil)
  useEffect(() => {
    setSelectedIds(prev => prev.filter(id => {
      const t = tagihanList.find(x => x.id === id);
      return !!t && t.nominal - (t.dibayar || 0) > 0;
    }));
  }, [tagihanList]);

  const sisaTagihan = (t: Tagihan) => t.nominal - (t.dibayar || 0);

  const belumLunasList = useMemo(
    () => filteredTagihanList.filter(t => sisaTagihan(t) > 0),
    [filteredTagihanList]
  );

  const toggleSelect = (tagihan: Tagihan) => {
    setSelectedIds(prev =>
      prev.includes(tagihan.id)
        ? prev.filter(id => id !== tagihan.id)
        : [...prev, tagihan.id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === belumLunasList.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(belumLunasList.map(t => t.id));
    }
  };

  const selectedTagihans = useMemo(
    () => tagihanList.filter(t => selectedIds.includes(t.id)),
    [tagihanList, selectedIds]
  );

  const totalSelected = useMemo(
    () => selectedTagihans.reduce((sum, t) => sum + sisaTagihan(t), 0),
    [selectedTagihans]
  );

  const handleLanjutPembayaran = async () => {
    if (selectedTagihans.length === 0 || !userData) return;
    setIsSubmittingPayment(true);

    try {
      // Satu transaksi Midtrans untuk semua tagihan terpilih.
      // Setiap tagihan dibayar PENUH sisanya (tanpa pembayaran parsial).
      const tagihanItems = selectedTagihans.map(t => ({
        tagihanId: t.id,
        name: `${t.jenisBiaya} ${t.bulan} ${t.tahun}`.slice(0, 50), // Midtrans membatasi panjang nama item
        price: sisaTagihan(t),
      }));

      const response = await fetch('/api/midtrans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tagihanItems,
          userDetails: {
            nama: userData.nama,
            email: userData.email || 'email@default.com',
          },
        }),
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      // --- ALUR BARU ---
      // 1. Dapatkan order_id dan token dari backend
      const { token: snapToken, order_id: newOrderId } = data;

      // 2. Buat SATU dokumen pembayaran yang merujuk beberapa tagihan (tagihanIds)
      await addDoc(collection(db, "pembayaran"), {
        tagihanIds: selectedTagihans.map(t => t.id),
        siswaId: userData.id,
        siswaNama: userData.nama,
        siswaEmail: userData.email || 'email@default.com',
        jumlahBayar: totalSelected,
        tanggalBayar: Timestamp.now(),
        dicatatOleh: "Midtrans Snap",
        transactionId: newOrderId, // Gunakan Order ID dari backend
        snapToken: snapToken, // Simpan token agar halaman pembayaran bisa membukanya
        status: 'pending'
      });

      // Arahkan ke halaman pembayaran khusus yang mengandung Order ID di URL.
      // Satu Snap untuk semua tagihan yang dipilih.
      router.push(`/pembayaran/${newOrderId}`);
    } catch (error) {
      console.error("Payment initiation failed:", error);
      alert("Gagal memulai sesi pembayaran. Silakan coba lagi.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const handleResumePayment = (paymentItem: Pembayaran) => {
    if (!paymentItem.transactionId) {
      alert("Informasi transaksi tidak lengkap untuk melanjutkan pembayaran.");
      return;
    }
    // Token Snap diambil langsung dari Midtrans oleh halaman pembayaran berdasarkan Order ID ini.
    router.push(`/pembayaran/${paymentItem.transactionId}`);
  };

  return (
    <div className="flex-1 bg-gray-50 min-h-screen flex flex-col">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-800">Riwayat Pembayaran</h1>
      </header>

      <div className="p-4">
        <div className="mb-4 border-b border-gray-200">
          <nav className="flex space-x-4" aria-label="Tabs">
            <button onClick={() => setActiveTab("tagihan")} className={`flex items-center gap-2 px-3 py-2 font-medium text-sm rounded-t-lg ${activeTab === "tagihan" ? "border-b-2 border-purple-500 text-purple-600" : "text-gray-500 hover:text-gray-700"}`}>
              <ListChecks className="w-4 h-4" /> Daftar Tagihan
            </button>
            <button onClick={() => setActiveTab("riwayat")} className={`flex items-center gap-2 px-3 py-2 font-medium text-sm rounded-t-lg ${activeTab === "riwayat" ? "border-b-2 border-purple-500 text-purple-600" : "text-gray-500 hover:text-gray-700"}`}>
              <History className="w-4 h-4" /> Riwayat Pembayaran
            </button>
          </nav>
        </div>

        {activeTab === 'tagihan' && <div className="space-y-6">
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
          <>
            {belumLunasList.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={selectAll}
                  className="flex items-center gap-2 text-sm font-medium text-[#581c87] hover:bg-purple-50 px-3 py-2 rounded-lg transition"
                >
                  {selectedIds.length === belumLunasList.length
                    ? <CheckSquare className="w-4 h-4" />
                    : <Square className="w-4 h-4" />}
                  {selectedIds.length === belumLunasList.length ? 'Batal Pilih Semua' : 'Pilih Semua Tagihan'}
                </button>
              </div>
            )}
            {filteredTagihanList.map(tagihan => {
            const dibayar = tagihan.dibayar || 0;
            const sisa = tagihan.nominal - dibayar;
            const isLunas = sisa <= 0;
            const diskonJenis = tagihan.diskonJenis || 0;
            const diskonIndividual = tagihan.diskonIndividual || 0;
            const adaDiskon = diskonJenis > 0 || diskonIndividual > 0;
            // Nominal awal: pakai field tersimpan, jika belum ada hitung balik dari nominal + diskon
            const nominalAwal = tagihan.nominalAwal
              || (adaDiskon
                ? Math.round(tagihan.nominal / ((1 - diskonJenis / 100) * (1 - diskonIndividual / 100)))
                : tagihan.nominal);
            const nilaiDiskon = nominalAwal - tagihan.nominal;
            const isSelected = selectedIds.includes(tagihan.id);

            return (
              <div
                key={tagihan.id}
                className={`bg-white p-4 rounded-xl shadow-sm border transition ${isSelected ? 'border-[#581c87] ring-2 ring-[#581c87]/30' : 'border-gray-100'} ${!isLunas ? 'cursor-pointer hover:shadow-md' : ''}`}
                onClick={() => !isLunas && toggleSelect(tagihan)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-start gap-3">
                    {!isLunas && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(tagihan); }}
                        className="mt-1 text-[#581c87] hover:text-[#45156b]"
                        aria-label={isSelected ? 'Batalkan pilihan' : 'Pilih tagihan'}
                      >
                        {isSelected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-gray-400" />}
                      </button>
                    )}
                    <div>
                      <h3 className="font-bold text-gray-800">{tagihan.jenisBiaya}</h3>
                      <p className="text-xs text-gray-500">{tagihan.bulan} {tagihan.tahun}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isLunas ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {isLunas ? 'Lunas' : 'Belum Lunas'}
                  </span>
                </div>
                <div className="space-y-2 text-sm border-t pt-3">
                  {/* Rincian harga: harga awal, diskon, lalu jumlah akhir */}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Harga Awal:</span>
                    <span className={`font-medium ${adaDiskon ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{formatCurrency(nominalAwal)}</span>
                  </div>

                  {diskonJenis > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Diskon Jenis Biaya ({diskonJenis}%):</span>
                      <span className="font-medium text-orange-600">
                        - {formatCurrency(Math.round(nominalAwal * (diskonJenis / 100)))}
                      </span>
                    </div>
                  )}

                  {diskonIndividual > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Diskon Siswa ({diskonIndividual}%):</span>
                      <span className="font-medium text-purple-600">
                        - {formatCurrency(
                          Math.round(
                            hitungSetelahDiskon(nominalAwal, diskonJenis) * (diskonIndividual / 100)
                          )
                        )}
                      </span>
                    </div>
                  )}

                  {adaDiskon && (
                    <div className="flex justify-between text-xs text-orange-700 bg-orange-50 -mx-1 px-2 py-1 rounded">
                      <span>Total Potongan:</span>
                      <span className="font-semibold">- {formatCurrency(nilaiDiskon)}</span>
                    </div>
                  )}

                  <div className="flex justify-between border-t pt-2">
                    <span className="font-semibold text-gray-700">Jumlah Akhir Tagihan:</span>
                    <span className="font-bold text-gray-900">{formatCurrency(tagihan.nominal)}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-gray-500">Dibayar:</span><span className="font-medium text-green-600">{formatCurrency(dibayar)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Sisa:</span><span className="font-bold text-red-600">{formatCurrency(sisa)}</span></div>
                </div>
                {!isLunas && (
                  <p className="border-t mt-4 pt-3 text-xs text-gray-400 text-center">
                    Centang tagihan untuk menambahkannya ke pembayaran
                  </p>
                )}
              </div>
            );
            })}
          </>
        )}</div>}

        {activeTab === 'riwayat' && <div className="space-y-4">
          {loadingRiwayat ? (
            <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
          ) : riwayatList.length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-white rounded-lg shadow-sm">
              Belum ada riwayat pembayaran.
            </div>
          ) : (
            riwayatList.map(item => {
              const getStatusPill = (status: string) => {
                switch (status) {
                  case 'settlement':
                  case 'capture':
                    return <span className="bg-green-100 text-green-800 text-xs font-semibold px-2 py-1 rounded-full">Sukses</span>;
                  case 'pending':
                    return <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded-full">Tertunda</span>;
                  case 'expire':
                    return <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2 py-1 rounded-full">Kedaluwarsa</span>;
                  case 'deny':
                  case 'cancel':
                  case 'error':
                    return <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded-full">Gagal</span>;
                  default:
                    return <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-1 rounded-full">{status}</span>;
                }
              };

              return (
                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-gray-800">{item.jenisBiaya}</h3>
                    </div>
                    {getStatusPill(item.status)}
                  </div>                  <div className="space-y-1 text-sm border-t pt-2 mt-2">
                    <div className="flex justify-between"><span>Tanggal Transaksi:</span><span className="font-medium">{new Date(item.tanggalBayar.seconds * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span></div>
                    <div className="flex justify-between"><span>Jumlah Bayar:</span><span className="font-bold text-green-600">{formatCurrency(item.jumlahBayar)}</span></div>
                    <div className="flex justify-between"><span>Order ID:</span><span className="font-mono text-xs text-gray-500">{item.transactionId || '-'}</span></div>
                  </div>
                  {(item.jenisBiayaList?.length ?? 0) > 0 && (
                    <div className="border-t mt-3 pt-3 flex justify-end">
                      <button
                        onClick={() => setDetailItem(item)}
                        className="text-[#581c87] hover:text-[#45156b] text-sm font-medium flex items-center gap-1"
                      >
                        Lihat Detail
                      </button>
                    </div>
                  )}
                  {item.status === 'pending' && (
                    <div className="border-t mt-3 pt-3 flex justify-end">
                      <button 
                        onClick={() => handleResumePayment(item)} 
                        disabled={isResumingPayment === item.id}
                        className="bg-orange-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-orange-600 transition text-sm disabled:opacity-50 disabled:cursor-wait">
                        {isResumingPayment === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                        {isResumingPayment === item.id ? 'Memuat...' : 'Lanjutkan Pembayaran'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>}
      </div>

      {/* Modal Detail Rincian Jenis Biaya */}
      {detailItem && (
        <div
          className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setDetailItem(null)}
        >
          <div
            className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Rincian Pembayaran</h3>
              <button onClick={() => setDetailItem(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto">
              <div className="bg-gray-50 p-3 rounded-lg space-y-2 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tanggal Transaksi:</span>
                  <span className="font-medium">{new Date(detailItem.tanggalBayar.seconds * 1000).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Jumlah Bayar:</span>
                  <span className="font-bold text-green-600">{formatCurrency(detailItem.jumlahBayar)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Status:</span>
                  <span className="font-medium">{detailItem.status === 'settlement' || detailItem.status === 'capture' ? 'Sukses' : detailItem.status === 'pending' ? 'Tertunda' : detailItem.status === 'expire' ? 'Kedaluwarsa' : detailItem.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Order ID:</span>
                  <span className="font-mono text-xs text-gray-500 break-all text-right">{detailItem.transactionId || '-'}</span>
                </div>
              </div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Jenis Biaya Dibayar ({detailItem.jenisBiayaList?.length ?? 0}):</p>
              <ul className="space-y-2">
                {(detailItem.jenisBiayaList ?? []).map((jb, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm bg-white border border-gray-100 rounded-lg px-3 py-2">
                    <CheckSquare className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                    <span className="text-gray-800">{jb}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-4 bg-gray-50 border-t rounded-b-2xl sm:rounded-b-xl">
              <button
                onClick={() => setDetailItem(null)}
                className="w-full bg-[#581c87] text-white py-3 rounded-lg hover:bg-[#45156b] transition font-medium"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bar Keranjang Pembayaran (sticky bottom) */}
      {activeTab === 'tagihan' && selectedIds.length > 0 && (
        <div className="sticky bottom-0 z-20 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
          <div className="max-w-2xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <ShoppingCart className="w-4 h-4" />
                <span>{selectedIds.length} tagihan dipilih</span>
                <button onClick={() => setSelectedIds([])} className="text-gray-400 hover:text-gray-600" title="Bersihkan pilihan">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-400 truncate">
                {selectedTagihans.map(t => `${t.jenisBiaya} ${t.bulan} ${t.tahun}`).join(', ')}
              </p>
              <p className="text-lg font-bold text-gray-900">{formatCurrency(totalSelected)}</p>
            </div>
            <button
              onClick={handleLanjutPembayaran}
              disabled={isSubmittingPayment || totalSelected <= 0}
              className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isSubmittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {isSubmittingPayment ? 'Memproses...' : 'Bayar Sekarang'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}