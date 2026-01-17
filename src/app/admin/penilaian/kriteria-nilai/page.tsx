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
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";

interface KategoriPenilaian {
  id: string;
  nama: string;
}

interface KriteriaNilai {
  id: string;
  nama: string;      // e.g. Berkembang Sangat Baik (BSB)
  keterangan: string; // e.g. Ananda mampu melakukan...
  nilai: number;     // e.g. 4
  kategoriId?: string;
}

export default function KriteriaNilaiPage() {
  const [data, setData] = useState<KriteriaNilai[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriPenilaian[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  // Form State
  const [form, setForm] = useState({
    nama: "",
    keterangan: "",
    nilai: 0,
    kategoriId: "",
  });

  // Realtime Fetch Data
  useEffect(() => {
    // Mengambil data urut berdasarkan nilai angka (tertinggi ke terendah)
    const q = query(collection(db, "kriteria_nilai"), orderBy("nilai", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as KriteriaNilai[];
      setData(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch Kategori untuk Dropdown
  useEffect(() => {
    const fetchKategori = async () => {
      try {
        const q = query(collection(db, "kategori_penilaian"), orderBy("nama", "asc"));
        const snapshot = await getDocs(q);
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as KategoriPenilaian[];
        setKategoriList(items);
      } catch (error) {
        console.error("Error fetching kategori:", error);
      }
    };
    fetchKategori();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing && currentId) {
        await updateDoc(doc(db, "kriteria_nilai", currentId), {
          ...form,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "kriteria_nilai"), {
          ...form,
          createdAt: serverTimestamp(),
        });
      }
      resetForm();
    } catch (error) {
      console.error("Error saving data: ", error);
      alert("Gagal menyimpan data");
    }
  };

  const handleEdit = (item: KriteriaNilai) => {
    setForm({
      nama: item.nama,
      keterangan: item.keterangan,
      nilai: item.nilai,
      kategoriId: item.kategoriId || "",
    });
    setCurrentId(item.id);
    setIsEditing(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus kriteria ini?")) {
      try {
        await deleteDoc(doc(db, "kriteria_nilai", id));
      } catch (error) {
        console.error("Error deleting data: ", error);
        alert("Gagal menghapus data");
      }
    }
  };

  const resetForm = () => {
    setForm({ nama: "", keterangan: "", nilai: 0, kategoriId: "" });
    setIsEditing(false);
    setCurrentId(null);
  };

  const getKategoriName = (id?: string) => {
    if (!id) return "-";
    const kat = kategoriList.find((k) => k.id === id);
    return kat ? kat.nama : "-";
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Manajemen Kriteria Nilai</h1>

      {/* Form Section */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          {isEditing ? "Edit Kriteria Nilai" : "Tambah Kriteria Nilai"}
        </h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-600 mb-1">Kategori</label>
            <select
              required
              value={form.kategoriId}
              onChange={(e) => setForm({ ...form, kategoriId: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
            >
              <option value="">Pilih Kategori</option>
              {kategoriList.map((k) => (
                <option key={k.id} value={k.id}>{k.nama}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-600 mb-1">Nama Nilai</label>
            <input
              type="text"
              required
              value={form.nama}
              onChange={(e) => setForm({ ...form, nama: e.target.value })}
              placeholder="Contoh: BSB"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-600 mb-1">Nilai Angka</label>
            <input
              type="number"
              required
              value={form.nilai}
              onChange={(e) => setForm({ ...form, nilai: Number(e.target.value) })}
              placeholder="Contoh: 4"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-gray-600 mb-1">Keterangan</label>
            <input
              type="text"
              required
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
              placeholder="Keterangan singkat..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2 md:col-span-1">
            <button
              type="submit"
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white transition ${
                isEditing ? "bg-orange-500 hover:bg-orange-600" : "bg-[#581c87] hover:bg-[#45156b]"
              }`}
            >
              {isEditing ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {isEditing ? "Simpan" : "Tambah"}
            </button>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold">
              <tr>
                <th className="p-4 w-16 text-center">No</th>
                <th className="p-4">Kategori</th>
                <th className="p-4">Nama Nilai</th>
                <th className="p-4">Keterangan</th>
                <th className="p-4 text-center">Nilai Angka</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center">Memuat data...</td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center">Belum ada data kriteria nilai.</td>
                </tr>
              ) : (
                data.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 text-gray-600">{getKategoriName(item.kategoriId)}</td>
                    <td className="p-4 font-medium text-gray-800">{item.nama}</td>
                    <td className="p-4">{item.keterangan}</td>
                    <td className="p-4 text-center">
                      <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full font-bold">
                        {item.nilai}
                      </span>
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 text-orange-500 hover:bg-orange-50 rounded-lg transition"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
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
    </div>
  );
}
