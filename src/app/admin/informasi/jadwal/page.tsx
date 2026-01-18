"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, query, orderBy, addDoc, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { Edit, Trash2, CalendarClock, Plus, Loader2, X, Save } from "lucide-react";

export default function JadwalPage() {
  const [dataJadwal, setDataJadwal] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAturModalOpen, setIsAturModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  
  // State untuk Form Tambah/Edit Jadwal Utama
  const [formData, setFormData] = useState({
    cabang: "",
    kelas: "",
  });

  // State untuk Atur Jadwal (Detail)
  const [selectedJadwal, setSelectedJadwal] = useState<any>(null);
  const [jadwalDetails, setJadwalDetails] = useState<any[]>([]);
  const [detailForm, setDetailForm] = useState({
    hari: "Senin",
    waktu: "",
    aktivitas: ""
  });
  const [loadingDetails, setLoadingDetails] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Mengambil data jadwal, diurutkan berdasarkan createdAt jika ada, atau default
      let q;
      try {
          q = query(collection(db, "jadwal"), orderBy("createdAt", "desc"));
      } catch (e) {
          q = collection(db, "jadwal");
      }
      
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDataJadwal(items);
    } catch (error) {
      console.error("Error fetching jadwal:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const fetchMaster = async () => {
      try {
        const cab = await getDocs(query(collection(db, "cabang"), orderBy("nama", "asc")));
        setCabangList(cab.docs.map((d) => ({ id: d.id, ...d.data() })));

        const kel = await getDocs(query(collection(db, "kelas"), orderBy("namaKelas", "asc")));
        setKelasList(kel.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error) {
        console.error("Error fetching master data:", error);
      }
    };
    fetchMaster();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus jadwal ini?")) return;
    try {
      await deleteDoc(doc(db, "jadwal", id));
      setDataJadwal((prev) => prev.filter((item) => item.id !== id));
      alert("Jadwal berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting jadwal:", error);
      alert("Gagal menghapus jadwal.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        // Update Existing
        await updateDoc(doc(db, "jadwal", editingId), {
          cabang: formData.cabang,
          kelas: formData.kelas,
        });
        alert("Jadwal berhasil diperbarui!");
      } else {
        // Create New
        await addDoc(collection(db, "jadwal"), {
          cabang: formData.cabang,
          kelas: formData.kelas,
          createdAt: serverTimestamp(),
        });
        alert("Jadwal berhasil ditambahkan!");
      }
      setIsModalOpen(false);
      setFormData({ cabang: "", kelas: "" });
      setEditingId(null);
      fetchData();
    } catch (error) {
      console.error("Error saving jadwal:", error);
      alert("Gagal menyimpan jadwal.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      cabang: item.cabang,
      kelas: item.kelas,
    });
    setIsModalOpen(true);
  };

  const handleAturJadwal = async (item: any) => {
    setSelectedJadwal(item);
    setIsAturModalOpen(true);
    setDetailForm({ hari: "Senin", waktu: "", aktivitas: "" });
    fetchJadwalDetails(item.id);
  };

  const fetchJadwalDetails = async (jadwalId: string) => {
    setLoadingDetails(true);
    try {
      const q = query(collection(db, "jadwal_detil"), where("jadwalId", "==", jadwalId));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Custom sort hari Senin-Jumat
      const hariOrder: Record<string, number> = { "Senin": 1, "Selasa": 2, "Rabu": 3, "Kamis": 4, "Jumat": 5, "Sabtu": 6, "Minggu": 7 };
      items.sort((a: any, b: any) => {
        const diff = (hariOrder[a.hari] || 99) - (hariOrder[b.hari] || 99);
        if (diff !== 0) return diff;
        return a.waktu.localeCompare(b.waktu);
      });

      setJadwalDetails(items);
    } catch (error) {
      console.error("Error fetching details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveDetail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJadwal) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, "jadwal_detil"), {
        jadwalId: selectedJadwal.id,
        hari: detailForm.hari,
        waktu: detailForm.waktu,
        aktivitas: detailForm.aktivitas,
        createdAt: serverTimestamp(),
      });
      setDetailForm({ ...detailForm, waktu: "", aktivitas: "" }); // Reset input partial
      fetchJadwalDetails(selectedJadwal.id);
    } catch (error) {
      console.error("Error saving detail:", error);
      alert("Gagal menyimpan aktivitas.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDetail = async (id: string) => {
    if (!confirm("Hapus aktivitas ini?")) return;
    try {
      await deleteDoc(doc(db, "jadwal_detil", id));
      setJadwalDetails(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error("Error deleting detail:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Jadwal Kegiatan Siswa</h1>
            <p className="text-gray-500 text-sm">Kelola jadwal pelajaran dan kegiatan untuk setiap kelas.</p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormData({ cabang: "", kelas: "" });
            setIsModalOpen(true);
          }}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg hover:bg-[#45156b] transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Jadwal</span>
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
            <tr>
              <th className="p-4 w-16 text-center">No</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Kelas</th>
              <th className="p-4 text-center w-48">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : dataJadwal.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                  Belum ada data jadwal. Silakan tambah jadwal baru.
                </td>
              </tr>
            ) : (
              dataJadwal.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 text-center text-gray-500">{index + 1}</td>
                  <td className="p-4 font-medium text-gray-800">{item.cabang}</td>
                  <td className="p-4 text-gray-600">{item.kelas}</td>
                  <td className="p-4">
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() => handleAturJadwal(item)}
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                        title="Atur Jadwal"
                      >
                        <CalendarClock className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-gray-800">{editingId ? "Edit Jadwal" : "Tambah Jadwal"}</h3>
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
                  {cabangList.map((c) => (
                    <option key={c.id} value={c.nama}>{c.nama}</option>
                  ))}
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
                  {kelasList
                    .filter((k) => k.cabang === formData.cabang)
                    .map((k) => (
                      <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>
                    ))}
                </select>
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

      {/* Modal Atur Jadwal (Detail) */}
      {isAturModalOpen && selectedJadwal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <div>
                <h3 className="font-bold text-gray-800">Atur Jadwal Kegiatan</h3>
                <p className="text-xs text-gray-500">{selectedJadwal.cabang} - {selectedJadwal.kelas}</p>
              </div>
              <button onClick={() => setIsAturModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              {/* Form Input Aktivitas */}
              <form onSubmit={handleSaveDetail} className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Hari</label>
                  <select
                    required
                    className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={detailForm.hari}
                    onChange={(e) => setDetailForm({ ...detailForm, hari: e.target.value })}
                  >
                    {["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Waktu</label>
                  <input
                    required
                    type="time"
                    className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={detailForm.waktu}
                    onChange={(e) => setDetailForm({ ...detailForm, waktu: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2 flex gap-2">
                  <div className="flex-grow">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Aktivitas</label>
                    <input
                      required
                      type="text"
                      placeholder="Contoh: Upacara Bendera"
                      className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                      value={detailForm.aktivitas}
                      onChange={(e) => setDetailForm({ ...detailForm, aktivitas: e.target.value })}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#581c87] text-white px-3 py-2 rounded-lg hover:bg-[#45156b] transition h-[38px] flex items-center justify-center disabled:opacity-70"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  </button>
                </div>
              </form>

              {/* List Aktivitas */}
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-700 text-sm mb-2">Daftar Kegiatan</h4>
                {loadingDetails ? (
                  <div className="text-center py-4 text-gray-500"><Loader2 className="w-5 h-5 animate-spin mx-auto"/></div>
                ) : jadwalDetails.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm italic py-4">Belum ada kegiatan diatur.</p>
                ) : (
                  jadwalDetails.map((item) => (
                    <div key={item.id} className="flex items-center justify-between bg-white border p-3 rounded-lg shadow-sm hover:shadow-md transition">
                      <div className="flex items-center gap-4">
                        <span className="bg-purple-100 text-[#581c87] text-xs font-bold px-2 py-1 rounded w-16 text-center">{item.hari}</span>
                        <span className="text-gray-500 text-xs font-mono bg-gray-100 px-2 py-1 rounded">{item.waktu}</span>
                        <span className="text-gray-800 text-sm font-medium">{item.aktivitas}</span>
                      </div>
                      <button onClick={() => handleDeleteDetail(item.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}