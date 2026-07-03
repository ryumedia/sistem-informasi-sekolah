"use client";

import { useState, useEffect } from 'react';
import { db, auth } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from 'firebase/auth';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';

// --- INTERFACES ---
interface JenisBiaya {
  id: string;
  nama: string;
  nominal: number;
  // Struktur baru untuk penerapan
  penerapan: 'semua' | 'cabang_tertentu' | 'kelas_tertentu';
  cabangIds?: string[];
  kelasIds?: string[];
  // For display
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

const initialFormData = {
  nama: "",
  nominal: 0,
  penerapan: 'semua' as 'semua' | 'cabang_tertentu' | 'kelas_tertentu',
  cabangIds: [] as string[],
  kelasIds: [] as string[],
};

export default function JenisBiayaPage() {
  // --- STATE MANAGEMENT ---
  const [jenisBiayaList, setJenisBiayaList] = useState<JenisBiaya[]>([]);
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(initialFormData);

  // Filter State
  const [filterCabang, setFilterCabang] = useState<string>("");
  const [filteredJenisBiayaList, setFilteredJenisBiayaList] = useState<JenisBiaya[]>([]);
  const [filteredKelasList, setFilteredKelasList] = useState<Kelas[]>([]);

  // --- DATA FETCHING & AUTH ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && user.email) {
        const qGuru = query(collection(db, "guru"), where("email", "==", user.email));
        const snapGuru = await getDocs(qGuru);
        if (!snapGuru.empty) {
          setCurrentUser({ id: snapGuru.docs[0].id, ...snapGuru.docs[0].data() });
        } else {
          setCurrentUser(null); // Or handle other roles if necessary
        }
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const [cabangSnap, kelasSnap, jenisBiayaSnap] = await Promise.all([
          getDocs(query(collection(db, "cabang"), orderBy("nama", "asc"))),
          getDocs(query(collection(db, "kelas"), orderBy("namaKelas", "asc"))),
          getDocs(query(collection(db, "jenis_biaya"), orderBy("nama", "asc")))
        ]);

        const cabangData = cabangSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cabang));
        const kelasData = kelasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Kelas));
        
        setCabangList(cabangData);
        setKelasList(kelasData);
        
        const jenisBiayaData = jenisBiayaSnap.docs.map(doc => {
          const data = doc.data() as JenisBiaya;
          return {
            ...data,
            id: doc.id,
          };
        });

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
    let filtered = jenisBiayaList;
    if (filterCabang) {
      // Filter jika item berlaku untuk 'semua' atau jika ID cabang ada di dalam array cabangIds
      filtered = filtered.filter(item => item.penerapan === 'semua' || (item.cabangIds && item.cabangIds.includes(filterCabang)));
    }
    setFilteredJenisBiayaList(filtered);
  }, [filterCabang, jenisBiayaList]);

  useEffect(() => {
    // Jika penerapan adalah 'kelas_tertentu' dan ada cabang yang dipilih, filter kelasnya
    if (formData.penerapan === 'kelas_tertentu' && formData.cabangIds && formData.cabangIds.length > 0) {
      const selectedCabangNames = cabangList
        .filter(c => formData.cabangIds.includes(c.id))
        .map(c => c.nama);
      setFilteredKelasList(kelasList.filter(k => selectedCabangNames.includes(k.cabang)));
    } else {
      setFilteredKelasList([]);
    }
  }, [formData.penerapan, formData.cabangIds, kelasList, cabangList]);

  // --- HANDLER FUNCTIONS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'penerapan') {
      // Reset pilihan saat mode penerapan diubah
      setFormData(prev => ({
        ...prev,
        penerapan: value as any,
        cabangIds: [],
        kelasIds: [],
      }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    const numericValue = rawValue ? parseInt(rawValue, 10) : 0;
    setFormData(prev => ({ ...prev, nominal: numericValue }));
  };

  const handleMultiSelectChange = (e: React.ChangeEvent<HTMLSelectElement>, field: 'cabangIds' | 'kelasIds') => {
    const options = Array.from(e.target.selectedOptions, option => option.value);
    setFormData(prev => ({ ...prev, [field]: options }));
  };

  const openModal = (item: JenisBiaya | null = null) => {
    if (item) {
      setEditingId(item.id);
      setFormData({
        nama: item.nama,
        nominal: item.nominal,
        penerapan: item.penerapan,
        cabangIds: item.cabangIds || [],
        kelasIds: item.kelasIds || [],
      });
    } else {
      setEditingId(null);
      setFormData(initialFormData);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Siapkan data untuk disimpan, hapus field yang tidak perlu sesuai mode penerapan
    const dataToSave: any = {
      nama: formData.nama,
      nominal: formData.nominal,
      penerapan: formData.penerapan,
    };
    if (formData.penerapan === 'cabang_tertentu') {
      dataToSave.cabangIds = formData.cabangIds;
    } else if (formData.penerapan === 'kelas_tertentu') {
      dataToSave.cabangIds = formData.cabangIds; // Simpan juga info cabangnya
      dataToSave.kelasIds = formData.kelasIds;
    }

    try {
      if (editingId) {
        await updateDoc(doc(db, "jenis_biaya", editingId), dataToSave);
        alert("Jenis biaya berhasil diperbarui.");
      } else {
        await addDoc(collection(db, "jenis_biaya"), dataToSave);
        alert("Jenis biaya berhasil ditambahkan.");
      }
      // Re-fetch data to show changes
      if (currentUser) {
        setCurrentUser((prev: any) => ({ ...prev }));
      }
      closeModal();
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus jenis biaya ini?")) return;
    try {
      await deleteDoc(doc(db, "jenis_biaya", id));
      alert("Data berhasil dihapus.");
      setJenisBiayaList(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Error deleting data:", error);
      alert("Gagal menghapus data.");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Jenis Biaya Sekolah</h1>
        <button
          onClick={() => openModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Jenis
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
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
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16 text-center">No.</th>
                <th className="p-4">Jenis Biaya</th>
                <th className="p-4">Berlaku Untuk</th>
                <th className="p-4">Nominal</th>
                <th className="p-4 w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : filteredJenisBiayaList.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Belum ada data.</td></tr>
              ) : (
                filteredJenisBiayaList.map((item, i) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{i + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                    <td className="p-4">
                      {item.penerapan === 'semua' && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Semua Cabang & Kelas</span>}
                      {item.penerapan === 'cabang_tertentu' && (
                        <div className="flex flex-wrap gap-1">
                          {item.cabangIds?.map(id => <span key={id} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-md">{cabangList.find(c=>c.id===id)?.nama}</span>)}
                        </div>
                      )}
                      {item.penerapan === 'kelas_tertentu' && (
                        <div className="flex flex-wrap gap-1">
                          {item.kelasIds?.map(id => <span key={id} className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-md">{kelasList.find(k=>k.id===id)?.namaKelas}</span>)}
                        </div>
                      )}
                    </td>
                    <td className="p-4">{formatCurrency(item.nominal)}</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => openModal(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editingId ? 'Edit' : 'Tambah'} Jenis Biaya</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Biaya</label>
                <input type="text" name="nama" value={formData.nama} onChange={handleInputChange} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Berlaku Untuk</label>
                <select name="penerapan" value={formData.penerapan} onChange={handleInputChange} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" required>
                  <option value="semua">Semua Cabang & Kelas</option>
                  <option value="cabang_tertentu">Cabang Tertentu</option>
                  <option value="kelas_tertentu">Kelas Tertentu</option>
                </select>
              </div>

              {/* Conditional Inputs */}
              {formData.penerapan === 'cabang_tertentu' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Cabang (bisa lebih dari satu)</label>
                  <select name="cabangIds" value={formData.cabangIds} onChange={(e) => handleMultiSelectChange(e, 'cabangIds')} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" multiple required>
                    {cabangList.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Tahan Ctrl (atau Cmd di Mac) untuk memilih beberapa.</p>
                </div>
              )}

              {formData.penerapan === 'kelas_tertentu' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Cabang (hanya satu)</label>
                    <select name="cabangIds" value={formData.cabangIds[0] || ''} onChange={(e) => setFormData(prev => ({ ...prev, cabangIds: [e.target.value], kelasIds: [] }))} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" required>
                      <option value="">Pilih Cabang Dulu</option>
                      {cabangList.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Kelas (bisa lebih dari satu)</label>
                    <select name="kelasIds" value={formData.kelasIds} onChange={(e) => handleMultiSelectChange(e, 'kelasIds')} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" multiple required disabled={formData.cabangIds.length === 0}>
                      {filteredKelasList.map(k => <option key={k.id} value={k.id}>{k.namaKelas}</option>)}
                    </select>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nominal</label>
                <input type="text" name="nominal" value={new Intl.NumberFormat('id-ID').format(formData.nominal)} onChange={handleNominalChange} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" required />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
                <button type="submit" disabled={isSubmitting} className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}