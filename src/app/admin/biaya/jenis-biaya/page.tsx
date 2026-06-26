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
  cabangId: string;
  kelasId: string;
  nominal: number;
  // For display
  namaCabang?: string;
  namaKelas?: string;
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
  cabangId: "",
  kelasId: "",
  nominal: 0,
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
          const cabang = cabangData.find(c => c.id === data.cabangId);
          const kelas = kelasData.find(k => k.id === data.kelasId);
          return {
            ...data,
            id: doc.id,
            namaCabang: cabang?.nama || "N/A",
            namaKelas: kelas?.namaKelas || "N/A",
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
      filtered = filtered.filter(item => item.cabangId === filterCabang);
    }
    setFilteredJenisBiayaList(filtered);
  }, [filterCabang, jenisBiayaList]);

  useEffect(() => {
    if (formData.cabangId) {
      const selectedCabang = cabangList.find(c => c.id === formData.cabangId);
      setFilteredKelasList(kelasList.filter(k => k.cabang === selectedCabang?.nama));
    } else {
      setFilteredKelasList([]);
    }
    // Hanya reset kelasId jika sedang dalam mode 'Tambah' (editingId null)
    if (!editingId) {
      setFormData(prev => ({ ...prev, kelasId: '' }));
    }
  }, [formData.cabangId, kelasList, cabangList, editingId]); // Tambahkan editingId sebagai dependency

  // --- HANDLER FUNCTIONS ---
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNominalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9]/g, '');
    const numericValue = rawValue ? parseInt(rawValue, 10) : 0;
    setFormData(prev => ({ ...prev, nominal: numericValue }));
  };

  const openModal = (item: JenisBiaya | null = null) => {
    if (item) {
      // Saat edit, langsung filter kelas berdasarkan cabang yang ada
      const selectedCabang = cabangList.find(c => c.id === item.cabangId);
      setFilteredKelasList(kelasList.filter(k => k.cabang === selectedCabang?.nama));
      setEditingId(item.id);
      setFormData({
        nama: item.nama,
        cabangId: item.cabangId,
        kelasId: item.kelasId,
        nominal: item.nominal,
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
    try {
      if (editingId) {
        await updateDoc(doc(db, "jenis_biaya", editingId), formData);
        alert("Jenis biaya berhasil diperbarui.");
      } else {
        await addDoc(collection(db, "jenis_biaya"), formData);
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
            name="filterCabang"
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
                <th className="p-4">Cabang</th>
                <th className="p-4">Kelas</th>
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
                    <td className="p-4">{item.namaCabang}</td>
                    <td className="p-4">{item.namaKelas}</td>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                  <select name="cabangId" value={formData.cabangId} onChange={handleInputChange} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" required>
                    <option value="">Pilih Cabang</option>
                    {cabangList.map(c => <option key={c.id} value={c.id}>{c.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                  <select name="kelasId" value={formData.kelasId} onChange={handleInputChange} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" disabled={!formData.cabangId} required>
                    <option value="">Pilih Kelas</option>
                    {filteredKelasList.map(k => <option key={k.id} value={k.id}>{k.namaKelas}</option>)}
                  </select>
                </div>
              </div>
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