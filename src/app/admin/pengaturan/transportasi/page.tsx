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

interface Transportasi {
  id: string;
  nama: string;
}

export default function PengaturanTransportasiPage() {
  const [transportasiList, setTransportasiList] = useState<Transportasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ nama: "" });

  const fetchTransportasi = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "transportasi"), orderBy("nama", "asc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          } as Transportasi)
      );
      setTransportasiList(data);
    } catch (error) {
      console.error("Error fetching transportasi:", error);
      alert("Gagal mengambil data moda transportasi.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransportasi();
  }, []);

  const openModal = (transportasi: Transportasi | null = null) => {
    if (transportasi) {
      setEditId(transportasi.id);
      setFormData({ nama: transportasi.nama });
    } else {
      setEditId(null);
      setFormData({ nama: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setFormData({ nama: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama) {
      alert("Nama moda transportasi tidak boleh kosong.");
      return;
    }
    setSubmitting(true);
    try {
      if (editId) {
        await updateDoc(doc(db, "transportasi", editId), { nama: formData.nama });
        alert("Moda transportasi berhasil diperbarui.");
      } else {
        await addDoc(collection(db, "transportasi"), { nama: formData.nama });
        alert("Moda transportasi berhasil ditambahkan.");
      }
      fetchTransportasi();
      closeModal();
    } catch (error) {
      console.error("Error saving transportasi:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus moda transportasi ini?")) {
      try {
        await deleteDoc(doc(db, "transportasi", id));
        alert("Moda transportasi berhasil dihapus.");
        fetchTransportasi();
      } catch (error) {
        console.error("Error deleting transportasi:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan Moda Transportasi</h1>
        <button
          onClick={() => openModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Moda
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16">No</th>
                <th className="p-4">Moda Transportasi</th>
                <th className="p-4 w-32">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={3} className="p-8 text-center">Memuat data...</td></tr>
              ) : transportasiList.length === 0 ? (
                <tr><td colSpan={3} className="p-8 text-center">Data tidak ditemukan.</td></tr>
              ) : (
                transportasiList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
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
              <h3 className="font-bold text-gray-800">{editId ? "Edit Moda Transportasi" : "Tambah Moda Transportasi"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="nama" className="block text-sm font-medium text-gray-700 mb-1">Nama Moda Transportasi</label>
                <input
                  id="nama"
                  type="text"
                  value={formData.nama}
                  onChange={(e) => setFormData({ nama: e.target.value })}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  required
                />
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