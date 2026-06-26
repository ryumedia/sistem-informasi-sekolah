"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, X, CircleDollarSign } from 'lucide-react';
import Link from 'next/link';

// --- INTERFACES ---
interface Siswa {
  id: string;
  nama: string;
  cabang: string;
  kelas: string;
}

interface Tagihan {
  id: string;
  jenisBiayaId: string;
  jenisBiaya: string;
  bulan: string;
  tahun: string;
  nominal: number;
  status: 'Lunas' | 'Belum Lunas';
  dibayar?: number; // Jumlah yang sudah dibayar
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
  cabangId: string;
  kelasId: string;
}

const initialTagihanItem = {
  jenisBiayaId: "",
  bulan: new Date().toLocaleString('default', { month: 'long' }),
  tahun: new Date().getFullYear().toString(),
  nominal: 0,
};

export default function DetailPenagihanPage() {
  const params = useParams();
  const router = useRouter();
  const siswaId = params.id as string;

  const [siswa, setSiswa] = useState<Siswa | null>(null);
  const [tagihanList, setTagihanList] = useState<Tagihan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter state
  const [filteredTagihanList, setFilteredTagihanList] = useState<Tagihan[]>([]);
  const [filterTahun, setFilterTahun] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  // Modal State
  const [editingTagihan, setEditingTagihan] = useState<Tagihan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [availableJenisBiaya, setAvailableJenisBiaya] = useState<JenisBiaya[]>([]);
  const [newTagihanItems, setNewTagihanItems] = useState<any[]>([]);
  const [currentItem, setCurrentItem] = useState<any>(initialTagihanItem);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [selectedTagihanForPayment, setSelectedTagihanForPayment] = useState<Tagihan | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    jumlahBayar: 0,
    tanggalBayar: new Date().toISOString().split('T')[0],
  });


  const fetchData = useCallback(async () => {
    if (!siswaId) return;
      setLoading(true);
      try {
        // Parallel fetching
        const [siswaSnap, jenisBiayaSnap, tagihanSnap, cabangSnap, kelasSnap] = await Promise.all([
          getDoc(doc(db, "siswa", siswaId)),
          getDocs(query(collection(db, "jenis_biaya"))),
          getDocs(query(collection(db, "tagihan_siswa"), where("siswaId", "==", siswaId), orderBy("tahun", "desc"))),
          getDocs(collection(db, "cabang")),
          getDocs(collection(db, "kelas")),
        ]);

        if (!siswaSnap.exists()) {
          alert("Data siswa tidak ditemukan.");
          router.push('/admin/biaya/penagihan');
          return;
        }
        const siswaData = { id: siswaSnap.id, ...siswaSnap.data() } as Siswa;
        setSiswa(siswaData);

        // Filter jenis biaya yang sesuai dengan cabang & kelas siswa
        const cabangData = cabangSnap.docs.map(d => ({ id: d.id, ...d.data() } as Cabang));
        const kelasData = kelasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Kelas));

        const siswaCabang = cabangData.find(c => c.nama === siswaData.cabang);
        const siswaKelas = kelasData.find(k => k.namaKelas === siswaData.kelas && k.cabang === siswaData.cabang);

        if (siswaCabang && siswaKelas) {
          const allJenisBiaya = jenisBiayaSnap.docs.map(d => ({ id: d.id, ...d.data() } as JenisBiaya));
          const filteredJenisBiaya = allJenisBiaya.filter(jb => 
            jb.cabangId === siswaCabang.id && jb.kelasId === siswaKelas.id
          );
          setAvailableJenisBiaya(filteredJenisBiaya);
        }

        // Set riwayat tagihan
        const tagihanData = tagihanSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tagihan));
        setTagihanList(tagihanData);

      } catch (error) {
        console.error("Error fetching detail tagihan: ", error);
        alert("Gagal memuat detail data.");
      } finally {
        setLoading(false);
      }
  }, [siswaId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- FILTERING LOGIC ---
  useEffect(() => {
    let filtered = tagihanList;

    if (filterTahun) {
      filtered = filtered.filter(t => t.tahun === filterTahun);
    }

    if (filterStatus) {
      filtered = filtered.filter(t => t.status === filterStatus);
    }

    setFilteredTagihanList(filtered);
  }, [tagihanList, filterTahun, filterStatus]);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  // --- MODAL HANDLERS ---
  const openModal = (tagihan: Tagihan | null = null) => {
    if (tagihan) {
      // Mode Edit
      setEditingTagihan(tagihan);
      setCurrentItem({
        jenisBiayaId: tagihan.jenisBiayaId,
        bulan: tagihan.bulan,
        tahun: tagihan.tahun,
        nominal: tagihan.nominal,
        status: tagihan.status,
      });
    } else {
      // Mode Tambah
      setEditingTagihan(null);
      setNewTagihanItems([]);
      setCurrentItem(initialTagihanItem);
    }
    setIsModalOpen(true);
  };
  
  const closeModal = () => {
    setIsModalOpen(false);
    setIsPaymentModalOpen(false);
  };

  const handleItemChange = (field: string, value: any) => {
    const updatedItem = { ...currentItem, [field]: value };

    if (field === 'jenisBiayaId') {
      const selected = availableJenisBiaya.find(jb => jb.id === value);
      updatedItem.nominal = selected ? selected.nominal : 0;
    }
    setCurrentItem(updatedItem);
  };

  const handleAddItem = () => {
    if (!currentItem.jenisBiayaId || !currentItem.bulan || !currentItem.tahun) {
      alert("Harap lengkapi Jenis Biaya, Bulan, dan Tahun.");
      return;
    }
    const selectedJenisBiaya = availableJenisBiaya.find(jb => jb.id === currentItem.jenisBiayaId);
    const newItem = {
      ...currentItem,
      jenisBiaya: selectedJenisBiaya?.nama,
      tempId: Date.now() + Math.random(), // Add unique temp key
    };
    setNewTagihanItems([...newTagihanItems, newItem]);
    setCurrentItem(initialTagihanItem); // Reset for next item
  };

  const handleRemoveItem = (index: number) => {
    setNewTagihanItems(newTagihanItems.filter((_, i) => i !== index));
  };

  const handleSaveTagihan = async () => {
    setIsSubmitting(true);
    // --- LOGIKA EDIT ---
    if (editingTagihan) {
      try {
        const tagihanRef = doc(db, "tagihan_siswa", editingTagihan.id);
        const nominalDibayar = currentItem.dibayar || 0;
        const sisaPembayaran = currentItem.nominal - nominalDibayar;
        const newStatus = sisaPembayaran <= 0 ? 'Lunas' : 'Belum Lunas';

        const dataToUpdate = {
          ...currentItem,
          dibayar: nominalDibayar,
          status: newStatus,
          jenisBiaya: availableJenisBiaya.find(jb => jb.id === currentItem.jenisBiayaId)?.nama || 'N/A',
        };
        await updateDoc(tagihanRef, dataToUpdate);
        alert("Tagihan berhasil diperbarui.");
        setTagihanList(prev => prev.map(t => t.id === editingTagihan.id ? { ...t, ...dataToUpdate } as Tagihan : t));
        closeModal();
      } catch (error) {
        console.error("Error updating tagihan: ", error);
        alert("Gagal memperbarui tagihan.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // --- LOGIKA TAMBAH BARU (BATCH) ---
    if (newTagihanItems.length === 0 && !editingTagihan) {
      alert("Tidak ada item tagihan untuk disimpan.");
      return;
    }
    try {
      const batch = writeBatch(db);
      newTagihanItems.forEach(item => {
        const newTagihanRef = doc(collection(db, "tagihan_siswa"));
        batch.set(newTagihanRef, {
          siswaId: siswaId,
          jenisBiayaId: item.jenisBiayaId,
          jenisBiaya: item.jenisBiaya,
          bulan: item.bulan,
          tahun: item.tahun,
          nominal: item.nominal,
          status: 'Belum Lunas',
          dibayar: 0, // Inisialisasi dibayar dengan 0
          createdAt: new Date(),
        });
      });
      await batch.commit();
      alert(`${newTagihanItems.length} tagihan berhasil disimpan.`);
      // Refresh data from server to get correct IDs
      if (siswaId) {
        await fetchData(); // Re-fetch all data for simplicity and accuracy
      }
      closeModal();
    } catch (error) {
      console.error("Error saving tagihan: ", error);
      alert("Gagal menyimpan tagihan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTagihan = async (tagihanId: string) => {
    if (!confirm("Yakin ingin menghapus tagihan ini?")) return;
    try {
      await deleteDoc(doc(db, "tagihan_siswa", tagihanId));
      setTagihanList(prev => prev.filter(t => t.id !== tagihanId));
      alert("Tagihan berhasil dihapus.");
    } catch (error) {
      console.error("Error deleting tagihan: ", error);
      alert("Gagal menghapus tagihan.");
    }
  };

  // --- PAYMENT HANDLERS ---
  const openPaymentModal = (tagihan: Tagihan) => {
    setSelectedTagihanForPayment(tagihan);
    const sisa = tagihan.nominal - (tagihan.dibayar || 0);
    setPaymentFormData({
      jumlahBayar: sisa > 0 ? sisa : 0,
      tanggalBayar: new Date().toISOString().split('T')[0],
    });
    setIsPaymentModalOpen(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTagihanForPayment || paymentFormData.jumlahBayar <= 0) {
      alert("Jumlah bayar harus lebih dari 0.");
      return;
    }
    setIsSubmittingPayment(true);

    try {
      const batch = writeBatch(db);
      const tagihanRef = doc(db, "tagihan_siswa", selectedTagihanForPayment.id);
      const pembayaranRef = doc(collection(db, "pembayaran"));

      const totalDibayarBaru = (selectedTagihanForPayment.dibayar || 0) + paymentFormData.jumlahBayar;
      const sisaBaru = selectedTagihanForPayment.nominal - totalDibayarBaru;
      const statusBaru = sisaBaru <= 0 ? 'Lunas' : 'Belum Lunas';

      // 1. Update dokumen tagihan
      batch.update(tagihanRef, {
        dibayar: totalDibayarBaru,
        status: statusBaru,
      });

      // 2. Buat dokumen transaksi pembayaran baru
      batch.set(pembayaranRef, {
        tagihanId: selectedTagihanForPayment.id,
        siswaId: siswaId,
        jumlahBayar: paymentFormData.jumlahBayar,
        tanggalBayar: new Date(paymentFormData.tanggalBayar),
        dicatatOleh: "Admin", // Ganti dengan currentUser.nama jika ada
        createdAt: new Date(),
      });

      await batch.commit();
      alert("Pembayaran berhasil dicatat.");
      await fetchData(); // Re-fetch data untuk update tampilan
      closeModal();
    } catch (error) {
      console.error("Error saving payment:", error);
      alert("Gagal mencatat pembayaran.");
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#581c87]" />
      </div>
    );
  }

  const uniqueYears = [...new Set(tagihanList.map(t => t.tahun))].sort((a, b) => parseInt(b) - parseInt(a));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <Link href="/admin/biaya/penagihan" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-2">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Penagihan
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Detail Tagihan: {siswa?.nama}</h1>
          <p className="text-gray-600">Cabang: {siswa?.cabang} / Kelas: {siswa?.kelas}</p>
        </div>
        <button
          onClick={() => openModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Tagihan
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Tahun</label>
          <select
            value={filterTahun}
            onChange={(e) => setFilterTahun(e.target.value)}
            className="w-full max-w-xs border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm"
          >
            <option value="">Semua Tahun</option>
            {uniqueYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full max-w-xs border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm"
          >
            <option value="">Semua Status</option>
            <option value="Belum Lunas">Belum Lunas</option>
            <option value="Lunas">Lunas</option>
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
                <th className="p-4">Jenis Biaya</th>
                <th className="p-4">Periode</th>
                <th className="p-4">Tahun</th>
                <th className="p-4">Total Tagihan</th>
                <th className="p-4">Dibayar</th>
                <th className="p-4">Sisa Pembayaran</th>
                <th className="p-4">Status</th>
                <th className="p-4 w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredTagihanList.length === 0 ? (
                <tr><td colSpan={9} className="p-8 text-center text-gray-500">Belum ada riwayat tagihan untuk siswa ini.</td></tr>
              ) : (
                filteredTagihanList.map((tagihan, i) => {
                  const dibayar = tagihan.dibayar || 0;
                  const sisa = tagihan.nominal - dibayar;
                  return (
                  <tr key={tagihan.id} className="hover:bg-gray-50 text-gray-800">
                    <td className="p-4 text-center">{i + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{tagihan.jenisBiaya}</td>
                    <td className="p-4">{tagihan.bulan}</td>
                    <td className="p-4">{tagihan.tahun}</td>
                    <td className="p-4 font-medium">{formatCurrency(tagihan.nominal)}</td>
                    <td className="p-4 text-green-600">{formatCurrency(dibayar)}</td>
                    <td className="p-4 font-semibold text-red-600">{formatCurrency(sisa)}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        sisa <= 0
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {sisa <= 0 ? 'Lunas' : 'Belum Lunas'}
                      </span>
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => openPaymentModal(tagihan)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition" title="Catat Pembayaran"><CircleDollarSign className="w-4 h-4" /></button>
                      <button onClick={() => openModal(tagihan)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDeleteTagihan(tagihan.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                )})
                )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tambah Tagihan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 sticky top-0">
              <h3 className="font-bold text-gray-800">{editingTagihan ? 'Edit' : 'Tambah'} Tagihan untuk {siswa?.nama}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              {/* Input Form */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end p-3 border rounded-lg bg-gray-50">
                <div className="md:col-span-2">
                  <label className="text-xs font-medium text-gray-600">Jenis Biaya</label>
                  <select value={currentItem.jenisBiayaId} onChange={e => handleItemChange('jenisBiayaId', e.target.value)} className="w-full border rounded-lg p-2 text-sm mt-1">
                    <option value="">Pilih Jenis Biaya</option>
                    {availableJenisBiaya.map(jb => <option key={jb.id} value={jb.id}>{jb.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Nominal</label>
                  <input type="number" value={currentItem.nominal} onChange={e => handleItemChange('nominal', parseInt(e.target.value) || 0)} className="w-full border rounded-lg p-2 text-sm mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Bulan</label>
                    <select value={currentItem.bulan} onChange={e => handleItemChange('bulan', e.target.value)} className="w-full border rounded-lg p-2 text-sm mt-1">
                      {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Tahun</label>
                    <input type="number" value={currentItem.tahun} onChange={e => handleItemChange('tahun', e.target.value)} className="w-full border rounded-lg p-2 text-sm mt-1" />
                  </div>
                </div>
                {!editingTagihan && (
                  <button onClick={handleAddItem} className="bg-green-600 text-white p-2 rounded-lg flex items-center justify-center gap-2 hover:bg-green-700 h-10">
                    <Plus className="w-4 h-4" /> Tambah
                  </button>
                )}
              </div>

              {/* Status Editor (hanya muncul saat mode edit) */}
              {editingTagihan && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Dibayar</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">Rp</span>
                    <input type="number" value={currentItem.dibayar || ''} onChange={e => handleItemChange('dibayar', parseInt(e.target.value) || 0)} className="w-full max-w-xs border rounded-lg p-2 pl-8 text-sm mt-1" placeholder="0" />
                  </div>
                </div>
              )}

              {/* Added Items Table (hanya muncul saat mode tambah) */}
              {!editingTagihan && (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left">Jenis Biaya</th>
                        <th className="p-2 text-left">Periode</th>
                        <th className="p-2 text-right">Nominal</th>
                        <th className="p-2 w-16 text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newTagihanItems.length === 0 ? (
                        <tr><td colSpan={4} className="p-4 text-center text-gray-500">Belum ada item yang ditambahkan.</td></tr>
                      ) : (
                        newTagihanItems.map((item, index) => (
                          <tr key={item.tempId} className="border-b">
                            <td className="p-2">{item.jenisBiaya}</td>
                            <td className="p-2">{item.bulan} {item.tahun}</td>
                            <td className="p-2 text-right">{formatCurrency(item.nominal)}</td>
                            <td className="p-2 text-center">
                              <button onClick={() => handleRemoveItem(index)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 sticky bottom-0">
              <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
              <button onClick={handleSaveTagihan} disabled={isSubmitting || (!editingTagihan && newTagihanItems.length === 0)} className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50">
                {isSubmitting ? 'Menyimpan...' : (editingTagihan ? 'Simpan Perubahan' : `Simpan ${newTagihanItems.length} Tagihan`)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catat Pembayaran Modal */}
      {isPaymentModalOpen && selectedTagihanForPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">Catat Pembayaran</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSavePayment} className="p-6 space-y-4">
              <div className='bg-gray-50 p-3 rounded-lg text-sm'>
                <p><span className='font-semibold'>Siswa:</span> {siswa?.nama}</p>
                <p><span className='font-semibold'>Tagihan:</span> {selectedTagihanForPayment.jenisBiaya} ({selectedTagihanForPayment.bulan} {selectedTagihanForPayment.tahun})</p>
                <p><span className='font-semibold'>Sisa:</span> {formatCurrency(selectedTagihanForPayment.nominal - (selectedTagihanForPayment.dibayar || 0))}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jumlah Dibayar</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">Rp</span>
                  <input 
                    type="number" 
                    value={paymentFormData.jumlahBayar} 
                    onChange={e => setPaymentFormData({...paymentFormData, jumlahBayar: parseInt(e.target.value) || 0})} 
                    className="w-full border rounded-lg p-2 pl-8 text-sm mt-1" 
                    required 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Bayar</label>
                <input type="date" value={paymentFormData.tanggalBayar} onChange={e => setPaymentFormData({...paymentFormData, tanggalBayar: e.target.value})} className="w-full border rounded-lg p-2 text-sm mt-1" required />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
                <button type="submit" disabled={isSubmittingPayment} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition disabled:opacity-50">
                  {isSubmittingPayment ? 'Menyimpan...' : 'Simpan Pembayaran'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
