"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, query, orderBy, addDoc, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Edit, Trash2, Plus, Loader2, X, Save, MapPin, Calendar, Filter } from "lucide-react";

export default function KegiatanPage() {
  const [dataKegiatan, setDataKegiatan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cabangList, setCabangList] = useState<any[]>([]);

  const [filterCabang, setFilterCabang] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [userCabang, setUserCabang] = useState<string>("");

  const [formData, setFormData] = useState({
    cabang: "",
    nama: "",
    tanggal: "",
    lokasi: "",
    keterangan: ""
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      let q;
      try {
          q = query(collection(db, "kegiatan"), orderBy("tanggal", "desc"));
      } catch (e) {
          q = collection(db, "kegiatan");
      }
      
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDataKegiatan(items);
    } catch (error) {
      console.error("Error fetching kegiatan:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const fetchCabang = async () => {
        try {
            const q = query(collection(db, "cabang"), orderBy("nama", "asc"));
            const snap = await getDocs(q);
            setCabangList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
        }
    }
    fetchCabang();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && cabangList.length > 0) {
        try {
          const q = query(collection(db, "guru"), where("email", "==", currentUser.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            setUserRole(userData.role);

            if (userData.role === "Kepala Sekolah" || userData.role === "Guru") {
              const userCabangName = userData.cabang;
              setFilterCabang(userCabangName);
              setUserCabang(userCabangName);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });
    return () => unsubscribe();
  }, [cabangList]);

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus kegiatan ini?")) return;
    try {
      await deleteDoc(doc(db, "kegiatan", id));
      setDataKegiatan((prev) => prev.filter((item) => item.id !== id));
      alert("Kegiatan berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting kegiatan:", error);
      alert("Gagal menghapus kegiatan.");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, "kegiatan", editingId), {
          cabang: formData.cabang,
          nama: formData.nama,
          tanggal: formData.tanggal,
          lokasi: formData.lokasi,
          keterangan: formData.keterangan,
        });
        alert("Kegiatan berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "kegiatan"), {
          cabang: formData.cabang,
          nama: formData.nama,
          tanggal: formData.tanggal,
          lokasi: formData.lokasi,
          keterangan: formData.keterangan,
          createdAt: serverTimestamp(),
        });
        alert("Kegiatan berhasil ditambahkan!");
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error("Error saving kegiatan:", error);
      alert("Gagal menyimpan kegiatan.");
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
      setFormData({ cabang: userCabang || "", nama: "", tanggal: "", lokasi: "", keterangan: "" });
      setEditingId(null);
  }

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      cabang: item.cabang,
      nama: item.nama,
      tanggal: item.tanggal,
      lokasi: item.lokasi,
      keterangan: item.keterangan
    });
    setIsModalOpen(true);
  };

  // Filter Logic
  const filteredData = dataKegiatan.filter((item) => {
    return filterCabang ? item.cabang === filterCabang : true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-2xl font-bold text-gray-800">Daftar Kegiatan</h1>
            <p className="text-gray-500 text-sm">Kelola agenda kegiatan sekolah.</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg hover:bg-[#45156b] transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kegiatan</span>
        </button>
      </div>

      {/* Filter Section */}
      <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 items-center">
        <div className="flex items-center gap-2 text-gray-600">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">Filter:</span>
        </div>

        <select
          className={`border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] ${userRole === "Kepala Sekolah" || userRole === "Guru" ? "bg-gray-100 cursor-not-allowed" : ""}`}
          value={filterCabang}
          onChange={(e) => setFilterCabang(e.target.value)}
          disabled={userRole === "Kepala Sekolah" || userRole === "Guru"}
        >
          <option value="">Semua Cabang</option>
          {cabangList.map((c) => (
            <option key={c.id} value={c.nama}>{c.nama}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
            <tr>
              <th className="p-4 w-16 text-center">No</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Nama Kegiatan</th>
              <th className="p-4">Tanggal</th>
              <th className="p-4">Lokasi</th>
              <th className="p-4">Keterangan</th>
              <th className="p-4 text-center w-32">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Memuat data...
                  </div>
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500 italic">
                  {filterCabang ? "Tidak ada kegiatan yang sesuai filter." : "Belum ada data kegiatan."}
                </td>
              </tr>
            ) : (
              filteredData.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50 transition">
                  <td className="p-4 text-center text-gray-500">{index + 1}</td>
                  <td className="p-4 font-medium text-gray-800">{item.cabang}</td>
                  <td className="p-4 font-semibold text-[#581c87]">{item.nama}</td>
                  <td className="p-4 text-gray-600 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-gray-400"/>
                          {item.tanggal}
                      </div>
                  </td>
                  <td className="p-4 text-gray-600">
                      <div className="flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-gray-400"/>
                          {item.lokasi}
                      </div>
                  </td>
                  <td className="p-4 text-gray-500 text-xs max-w-xs truncate" title={item.keterangan}>{item.keterangan}</td>
                  <td className="p-4">
                    <div className="flex justify-center items-center gap-2">
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
              <h3 className="font-bold text-gray-800">{editingId ? "Edit Kegiatan" : "Tambah Kegiatan"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Cabang</label>
                <select
                  required
                  className={`w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none ${userRole === "Kepala Sekolah" || userRole === "Guru" ? "bg-gray-100 cursor-not-allowed" : ""}`}
                  value={formData.cabang}
                  onChange={(e) => setFormData({ ...formData, cabang: e.target.value })}
                  disabled={userRole === "Kepala Sekolah" || userRole === "Guru"}
                >
                  <option value="">Pilih Cabang</option>
                  {cabangList.map((c) => (
                    <option key={c.id} value={c.nama}>{c.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nama Kegiatan</label>
                <input
                  required
                  type="text"
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                  value={formData.nama}
                  onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                  placeholder="Contoh: Kunjungan Museum"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Tanggal Kegiatan</label>
                    <input
                    required
                    type="date"
                    className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.tanggal}
                    onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Lokasi</label>
                    <input
                    required
                    type="text"
                    className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.lokasi}
                    onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })}
                    placeholder="Contoh: Aula Sekolah"
                    />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Keterangan</label>
                <textarea
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                  rows={3}
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                  placeholder="Tambahkan detail kegiatan..."
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