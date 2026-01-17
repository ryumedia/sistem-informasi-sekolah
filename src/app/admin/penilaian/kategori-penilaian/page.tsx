"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Save,
} from "lucide-react";

interface KategoriPenilaian {
  id: string;
  nama: string;
  createdAt?: any;
}

export default function KategoriPenilaianPage() {
  const [kategoriList, setKategoriList] = useState<KategoriPenilaian[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nama: "" });

  const fetchKategori = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "kategori_penilaian"), orderBy("nama", "asc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as KategoriPenilaian[];
      setKategoriList(data);
    } catch (error) {
      console.error("Error fetching kategori:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKategori();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "kategori_penilaian", editingId), {
          nama: formData.nama,
          updatedAt: Timestamp.now(),
        });
      } else {
        await addDoc(collection(db, "kategori_penilaian"), {
          nama: formData.nama,
          createdAt: Timestamp.now(),
        });
      }
      setIsModalOpen(false);
      setFormData({ nama: "" });
      setEditingId(null);
      fetchKategori();
    } catch (error) {
      console.error("Error saving kategori:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus kategori ini?")) return;
    try {
      await deleteDoc(doc(db, "kategori_penilaian", id));
      fetchKategori();
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Gagal menghapus data.");
    }
  };

  const handleEdit = (item: KategoriPenilaian) => {
    setEditingId(item.id);
    setFormData({ nama: item.nama });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Kategori Penilaian</h1>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ nama: "" });
            setIsModalOpen(true);
          }}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition shadow-lg shadow-purple-200"
        >
          <Plus className="w-4 h-4" /> Tambah Kategori
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12">No</th>
                <th className="p-4">Kategori Penilaian</th>
                <th className="p-4 w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" />
                  </td>
                </tr>
              ) : kategoriList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500">
                    Belum ada data kategori.
                  </td>
                </tr>
              ) : (
                kategoriList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                    <td className="p-4 flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-gray-800">
                {editingId ? "Edit Kategori" : "Tambah Kategori"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nama Kategori</label>
                <input
                  required
                  type="text"
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                  placeholder="Contoh: Agama & Moral"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="bg-[#581c87] text-white px-4 py-2 rounded-lg hover:bg-[#45156b] transition text-sm font-medium flex items-center gap-2 disabled:opacity-70"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}