// src/app/admin/pengaturan/performance/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, writeBatch, where } from "firebase/firestore";
import { Plus, X, Pencil, Trash2, CheckCircle2 } from "lucide-react";

interface Semester {
  id: string;
  namaPeriode: string;
  isDefault: boolean;
}

export default function PengaturanSemesterPage() {
  const [semesterList, setSemesterList] = useState<Semester[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ namaPeriode: "", isDefault: false });

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "kpi_periode"), orderBy("namaPeriode", "asc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Semester[];
      setSemesterList(data);
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
    if (!formData.namaPeriode) {
      alert("Nama Periode tidak boleh kosong.");
      return;
    }
    setSubmitting(true);
    try {
      // Jika dijadikan default, reset default pada semester lain
      if (formData.isDefault) {
        const q = query(collection(db, "kpi_periode"), where("isDefault", "==", true));
        const querySnapshot = await getDocs(q);
        const batch = writeBatch(db);
        
        querySnapshot.forEach((docSnap) => {
          if (docSnap.id !== editId) {
            batch.update(doc(db, "kpi_periode", docSnap.id), { isDefault: false });
          }
        });
        await batch.commit();
      }

      if (editId) {
        await updateDoc(doc(db, "kpi_periode", editId), formData);
        alert("Semester berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "kpi_periode"), {
          ...formData,
          createdAt: new Date(),
        });
        alert("Semester baru berhasil ditambahkan!");
      }
      closeModal();
      fetchData();
    } catch (error) {
      console.error("Error saving data:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus semester ini?")) {
      try {
        await deleteDoc(doc(db, "kpi_periode", id));
        alert("Semester berhasil dihapus.");
        fetchData();
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  const handleEdit = (item: Semester) => {
    setEditId(item.id);
    setFormData({ namaPeriode: item.namaPeriode, isDefault: item.isDefault || false });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setFormData({ namaPeriode: "", isDefault: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan Semester</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Semester
        </button>
      </div>

      {/* Tabel Data */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[500px]">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4 w-16">No</th>
              <th className="p-4">Nama Semester</th>
              <th className="p-4">Status</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center">Memuat data...</td></tr>
            ) : semesterList.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center">Belum ada data semester.</td></tr>
            ) : (
              semesterList.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4 text-center">{index + 1}</td>
                  <td className="p-4 font-medium text-gray-900">{item.namaPeriode}</td>
                  <td className="p-4">
                    {item.isDefault && (
                      <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3" /> Default
                      </span>
                    )}
                  </td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => handleEdit(item)} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition" title="Edit">
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

      {/* Modal Tambah/Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editId ? "Edit Semester" : "Tambah Semester Baru"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Semester</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Contoh: Semester Ganjil 2024/2025" 
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={formData.namaPeriode} 
                  onChange={(e) => setFormData({ ...formData, namaPeriode: e.target.value })} 
                />
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  id="isDefault"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                  className="w-4 h-4 text-[#581c87] focus:ring-[#581c87] border-gray-300 rounded"
                />
                <label htmlFor="isDefault" className="text-sm text-gray-700 cursor-pointer select-none">
                  Jadikan Default
                </label>
              </div>
              <p className="text-xs text-gray-500">
                *Jika dicentang, semester ini akan menjadi pilihan default di seluruh sistem.
              </p>

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
