// src/app/admin/pengaturan/kelas/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { Plus, X, Pencil, Trash2 } from "lucide-react";

interface Kelas {
  id: string;
  namaKelas: string;
  cabang: string;
  guruKelas: string[]; // Array of teacher names
}

interface Guru {
    id: string;
    nama: string;
    cabang: string;
}

export default function PengaturanKelasPage() {
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // State Form
  const [formData, setFormData] = useState<{
    namaKelas: string;
    cabang: string;
    guruKelas: string[];
  }>({
    namaKelas: "",
    cabang: "",
    guruKelas: [],
  });

  // Fetch all necessary data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Kelas
      const kelasQuery = query(collection(db, "kelas"), orderBy("namaKelas", "asc"));
      const kelasSnapshot = await getDocs(kelasQuery);
      const kelasData = kelasSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Kelas[];
      setKelasList(kelasData);

      // Fetch Guru
      const guruQuery = query(collection(db, "guru"), where("role", "==", "Guru"), orderBy("nama", "asc"));
      const guruSnapshot = await getDocs(guruQuery);
      const guruData = guruSnapshot.docs.map((doc) => ({
        id: doc.id,
        nama: doc.data().nama,
        cabang: doc.data().cabang,
      })) as Guru[];
      setGuruList(guruData);

      // Fetch Cabang
      const cabangQuery = query(collection(db, "cabang"), orderBy("nama", "asc"));
      const cabangSnapshot = await getDocs(cabangQuery);
      const cabangData = cabangSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setCabangList(cabangData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Submit (Tambah/Edit)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.guruKelas.length === 0) {
        alert("Pilih minimal satu guru kelas.");
        return;
    }
    setSubmitting(true);
    try {
      if (editId) {
        await updateDoc(doc(db, "kelas", editId), formData);
        alert("Data kelas berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "kelas"), {
          ...formData,
          createdAt: new Date(),
        });
        alert("Kelas baru berhasil ditambahkan!");
      }
      closeModal();
      fetchData();
    } catch (error) {
      console.error("Error saving kelas:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus data kelas ini?")) {
      try {
        await deleteDoc(doc(db, "kelas", id));
        alert("Data kelas berhasil dihapus.");
        fetchData();
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  const handleEdit = (kelas: Kelas) => {
    setEditId(kelas.id);
    setFormData({
      namaKelas: kelas.namaKelas,
      cabang: kelas.cabang,
      guruKelas: kelas.guruKelas || [], // Ensure it's an array
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setFormData({ namaKelas: "", cabang: "", guruKelas: [] });
  };

  // Handle multi-select change for teachers
  const handleGuruSelection = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
    setFormData({ ...formData, guruKelas: selectedOptions });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan Kelas</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Kelas
        </button>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4 w-16">No</th>
              <th className="p-4">Nama Kelas</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Guru Kelas</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={5} className="p-8 text-center">Memuat data...</td></tr>
            ) : kelasList.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center">Belum ada data kelas.</td></tr>
            ) : (
              kelasList.map((kelas, index) => (
                <tr key={kelas.id} className="hover:bg-gray-50">
                  <td className="p-4 text-center">{index + 1}</td>
                  <td className="p-4 font-medium text-gray-900">{kelas.namaKelas}</td>
                  <td className="p-4">{kelas.cabang}</td>
                  <td className="p-4">{kelas.guruKelas.join(", ")}</td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => handleEdit(kelas)} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(kelas.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Tambah/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editId ? "Edit Data Kelas" : "Tambah Kelas Baru"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kelas</label>
                <input required type="text" placeholder="Contoh: TK A" className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none"
                  value={formData.namaKelas} onChange={(e) => setFormData({...formData, namaKelas: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cabang</label>
                <select required className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none"
                  value={formData.cabang} onChange={(e) => setFormData({...formData, cabang: e.target.value})}>
                  <option value="">Pilih Cabang</option>
                  {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guru Kelas (bisa pilih lebih dari satu)</label>
                <select 
                  multiple 
                  required
                  className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none h-32"
                  value={formData.guruKelas} 
                  onChange={handleGuruSelection}
                >
                  {guruList
                    .filter((guru) => !formData.cabang || guru.cabang === formData.cabang)
                    .map((guru) => (
                    <option key={guru.id} value={guru.nama}>{guru.nama}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Tahan Ctrl (atau Cmd di Mac) untuk memilih beberapa guru.</p>
              </div>

              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2">
                {submitting ? "Menyimpan..." : "Simpan Data"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}