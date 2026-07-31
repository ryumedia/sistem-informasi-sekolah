"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { Plus, Pencil, Trash2, X, Loader2 } from "lucide-react";

interface Pekerjaan {
  id: string;
  nama: string;
  urutan: number;
}

export default function PengaturanPekerjaanPage() {
  const [pekerjaanList, setPekerjaanList] = useState<Pekerjaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nama: "", urutan: 0 });

  const fetchPekerjaan = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "pekerjaan"), orderBy("urutan", "asc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as Pekerjaan)
      );
      setPekerjaanList(data);
    } catch (error) {
      console.error("Error fetching pekerjaan:", error);
      alert("Gagal mengambil data pekerjaan.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPekerjaan();
  }, []);

  const openModal = (pekerjaan: Pekerjaan | null = null) => {
    if (pekerjaan) {
      setEditId(pekerjaan.id);
      setFormData({ nama: pekerjaan.nama, urutan: pekerjaan.urutan });
    } else {
      setEditId(null);
      const nextUrutan = pekerjaanList.length > 0 ? Math.max(...pekerjaanList.map(p => p.urutan)) + 1 : 1;
      setFormData({ nama: "", urutan: nextUrutan });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setFormData({ nama: "", urutan: 0 });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama) {
      alert("Nama pekerjaan tidak boleh kosong.");
      return;
    }
    setSubmitting(true);
    try {
      const dataToSave = {
        nama: formData.nama,
        urutan: Number(formData.urutan) || 0,
      };

      if (editId) {
        await updateDoc(doc(db, "pekerjaan", editId), dataToSave);
        alert("Pekerjaan berhasil diperbarui.");
      } else {
        await addDoc(collection(db, "pekerjaan"), dataToSave);
        alert("Pekerjaan berhasil ditambahkan.");
      }
      fetchPekerjaan();
      closeModal();
    } catch (error) {
      console.error("Error saving pekerjaan:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus pekerjaan ini?")) {
      try {
        await deleteDoc(doc(db, "pekerjaan", id));
        alert("Pekerjaan berhasil dihapus.");
        fetchPekerjaan();
      } catch (error) {
        console.error("Error deleting pekerjaan:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan Pekerjaan</h1>
        <button
          onClick={() => openModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Pekerjaan
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-24">Nomor Urut</th>
                <th className="p-4">Jenis Pekerjaan</th>
                <th className="p-4 w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={3} className="p-8 text-center">Memuat data...</td></tr>
              ) : pekerjaanList.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center">Data tidak ditemukan.</td></tr>
              ) : (
                pekerjaanList.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center font-medium">{item.urutan}</td>
                    <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                    <td className="p-4 flex gap-2">
                      <button onClick={() => openModal(item)} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
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
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-gray-800">{editId ? "Edit Pekerjaan" : "Tambah Pekerjaan"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label htmlFor="nama" className="block text-sm font-medium text-gray-700 mb-1">Jenis Pekerjaan</label>
                  <input id="nama" type="text" value={formData.nama} onChange={(e) => setFormData({ ...formData, nama: e.target.value })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" required />
                </div>
                <div>
                  <label htmlFor="urutan" className="block text-sm font-medium text-gray-700 mb-1">Nomor Urut</label>
                  <input id="urutan" type="number" value={formData.urutan} onChange={(e) => setFormData({ ...formData, urutan: Number(e.target.value) })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" required />
                </div>
              </div>
              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium flex items-center justify-center gap-2 disabled:opacity-50">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}