// src/app/admin/pengaturan/keuangan/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { Plus, X, Pencil, Trash2 } from "lucide-react";

interface Nomenklatur {
  id: string;
  nama: string;
  kategori: string;
}

export default function PengaturanKeuanganPage() {
  const [dataList, setDataList] = useState<Nomenklatur[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nama: "",
    kategori: "Pemasukan",
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "nomenklatur_keuangan"), orderBy("nama", "asc"));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Nomenklatur[];
      setDataList(data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editId) {
        await updateDoc(doc(db, "nomenklatur_keuangan", editId), formData);
        alert("Data berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "nomenklatur_keuangan"), {
          ...formData,
          createdAt: new Date(),
        });
        alert("Data berhasil ditambahkan!");
      }
      closeModal();
      fetchData();
    } catch (error) {
      console.error("Error saving:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus nomenklatur ini?")) {
      try {
        await deleteDoc(doc(db, "nomenklatur_keuangan", id));
        fetchData();
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  const handleEdit = (item: Nomenklatur) => {
    setEditId(item.id);
    setFormData({ nama: item.nama, kategori: item.kategori });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormData({ nama: "", kategori: "Pemasukan" });
    setEditId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan Keuangan</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Nomenklatur
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="font-semibold text-gray-700">Daftar Nomenklatur Keuangan</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[600px]">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4 w-16">No</th>
              <th className="p-4">Nomenklatur</th>
              <th className="p-4">Kategori</th>
              <th className="p-4 w-32">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="p-8 text-center">Memuat data...</td></tr>
            ) : dataList.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center">Belum ada data.</td></tr>
            ) : (
              dataList.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4 text-center">{index + 1}</td>
                  <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      item.kategori === 'Pemasukan' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {item.kategori}
                    </span>
                  </td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => handleEdit(item)} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition">
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editId ? "Edit Nomenklatur" : "Tambah Nomenklatur"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Nomenklatur</label>
                <input 
                  required 
                  type="text" 
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  placeholder="Contoh: SPP, Uang Gedung, Gaji Guru"
                  value={formData.nama} 
                  onChange={(e) => setFormData({...formData, nama: e.target.value})} 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select 
                  className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={formData.kategori} 
                  onChange={(e) => setFormData({...formData, kategori: e.target.value})}
                >
                  <option value="Pemasukan">Pemasukan</option>
                  <option value="Pengeluaran">Pengeluaran</option>
                </select>
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
