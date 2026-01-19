"use client";

import { useState, useEffect, useCallback } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { Plus, Pencil, Trash2, X, Save, Loader2, FileText } from "lucide-react";
import Link from "next/link";

export default function InfoTambahanPage() {
  const [dataList, setDataList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Master Data
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [semesterList, setSemesterList] = useState<any[]>([]);

  // Form State
  const [formData, setFormData] = useState({
    cabang: "",
    kelas: "",
    semester: "", 
  });

  // Fetch Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "info_tambahan_rapor"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDataList(items);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const fetchMaster = async () => {
      try {
        // Fetch Cabang
        const cabQuery = query(collection(db, "cabang"), orderBy("nama", "asc"));
        const cabSnap = await getDocs(cabQuery);
        setCabangList(cabSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Kelas
        const kelQuery = query(collection(db, "kelas"), orderBy("namaKelas", "asc"));
        const kelSnap = await getDocs(kelQuery);
        setKelasList(kelSnap.docs.map(d => ({ id: d.id, ...d.data() })));

        // Fetch Semester (Tahun Ajaran)
        const semQuery = query(collection(db, "kpi_periode"), orderBy("createdAt", "desc"));
        const semSnap = await getDocs(semQuery);
        const sems = semSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        setSemesterList(sems);

        // Set Default Semester
        const defaultSem = sems.find((s: any) => s.isDefault);
        if (defaultSem) {
          setFormData(prev => ({ ...prev, semester: defaultSem.namaPeriode }));
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMaster();
  }, [fetchData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "info_tambahan_rapor", editingId), {
          cabang: formData.cabang,
          kelas: formData.kelas,
          semester: formData.semester,
        });
        alert("Data berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "info_tambahan_rapor"), {
          cabang: formData.cabang,
          kelas: formData.kelas,
          semester: formData.semester,
          createdAt: serverTimestamp(),
        });
        alert("Data berhasil ditambahkan!");
      }
      setIsModalOpen(false);
      setEditingId(null);
      
      const defaultSem = semesterList.find((s: any) => s.isDefault);
      setFormData({ cabang: "", kelas: "", semester: defaultSem ? defaultSem.namaPeriode : "" });
      
      fetchData();
    } catch (error) {
      console.error("Error saving:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Yakin ingin menghapus data ini?")) return;
    try {
      await deleteDoc(doc(db, "info_tambahan_rapor", id));
      setDataList(prev => prev.filter(item => item.id !== id));
      alert("Data berhasil dihapus.");
    } catch (error) {
      console.error("Error deleting:", error);
      alert("Gagal menghapus data.");
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      cabang: item.cabang,
      kelas: item.kelas,
      semester: item.semester,
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Informasi Tambahan Rapor</h1>
            <p className="text-gray-500 text-sm">Kelola informasi tambahan untuk rapor cetak.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            const defaultSem = semesterList.find((s: any) => s.isDefault);
            setFormData({ cabang: "", kelas: "", semester: defaultSem ? defaultSem.namaPeriode : "" });
            setIsModalOpen(true);
          }}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg hover:bg-[#45156b] transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> Tambah Info
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[800px]">
            <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
              <tr>
                <th className="p-4 w-16 text-center">No</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Kelas</th>
                <th className="p-4">Semester</th>
                <th className="p-4 text-center w-48">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center">Memuat data...</td></tr>
              ) : dataList.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Belum ada data.</td></tr>
              ) : (
                dataList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4">{item.cabang}</td>
                    <td className="p-4">{item.kelas}</td>
                    <td className="p-4">{item.semester}</td>
                    <td className="p-4 flex justify-center gap-2">
                      {/* Tombol Tambah Info (Detail) - Placeholder Link */}
                      <Link 
                          href={`/admin/penilaian/detail-info?id=${item.id}`}
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                          title="Isi Detail Informasi"
                      >
                          <FileText className="w-4 h-4" />
                      </Link>
                      <button onClick={() => handleEdit(item)} className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition" title="Hapus">
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
              <h3 className="font-bold text-gray-800">{editingId ? "Edit Data" : "Tambah Data"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cabang</label>
                <select
                  required
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                  value={formData.cabang}
                  onChange={(e) => setFormData({ ...formData, cabang: e.target.value, kelas: "" })}
                >
                  <option value="">Pilih Cabang</option>
                  {cabangList.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Kelas</label>
                <select
                  required
                  disabled={!formData.cabang}
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none disabled:bg-gray-100"
                  value={formData.kelas}
                  onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                >
                  <option value="">Pilih Kelas</option>
                  {kelasList.filter(k => k.cabang === formData.cabang).map(k => (
                    <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Semester</label>
                <select
                  required
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                  value={formData.semester}
                  onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                >
                  <option value="">Pilih Semester</option>
                  {semesterList.map(s => <option key={s.id} value={s.namaPeriode}>{s.namaPeriode}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium">Batal</button>
                <button type="submit" disabled={isSaving} className="bg-[#581c87] text-white px-4 py-2 rounded-lg hover:bg-[#45156b] transition text-sm font-medium flex items-center gap-2 disabled:opacity-70">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
