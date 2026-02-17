"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, deleteDoc, doc, query, orderBy, addDoc, serverTimestamp, updateDoc, where, Timestamp } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Edit, Trash2, Plus, Loader2, X, Save, Filter, Eye } from "lucide-react";

export default function KegiatanPage() {
  const [dataKegiatan, setDataKegiatan] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [kelasList, setKelasList] = useState<any[]>([]);
  const [semesterList, setSemesterList] = useState<any[]>([]);

  const [filterCabang, setFilterCabang] = useState("");
  const [userRole, setUserRole] = useState<string>("");
  const [userCabang, setUserCabang] = useState<string>("");
  const [viewDetail, setViewDetail] = useState<any | null>(null);

  const [formData, setFormData] = useState({
    cabang: "",
    kelas: "",
    semester: "",
    bulan: "",
    tema: "",
    term: "",
    waktuKegiatan: "",
    pembiasaan: "",
    tujuanPembelajaran: "",
    week1: "",
    week2: "",
    week3: "",
    week4: "",
    catatan: ""
  });

  const bulanList = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "kegiatan"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDataKegiatan(items);
    } catch (error) {
      console.warn("Could not fetch with ordering, likely missing Firestore index on 'kegiatan' collection for 'createdAt' field (desc). Fetching without ordering.", error);
      // Fallback to fetching without ordering
      const q = collection(db, "kegiatan");
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setDataKegiatan(items);
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
    const fetchKelas = async () => {
      try {
        const q = query(collection(db, "kelas"), orderBy("namaKelas", "asc"));
        const querySnapshot = await getDocs(q);
        setKelasList(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching kelas:", error);
      }
    };
    const fetchSemester = async () => {
      try {
        const q = query(collection(db, "kpi_periode"), where("isDefault", "==", true));
        const querySnapshot = await getDocs(q);
        setSemesterList(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching semester:", error);
      }
    };
    fetchCabang();
    fetchKelas();
    fetchSemester();
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
        await updateDoc(doc(db, "kegiatan", editingId), formData);
        alert("Kegiatan berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "kegiatan"), {
          ...formData,
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
      setFormData({ 
        cabang: userCabang || "", 
        kelas: "",
        semester: "",
        bulan: "",
        tema: "",
        term: "",
        waktuKegiatan: "",
        pembiasaan: "",
        tujuanPembelajaran: "",
        week1: "",
        week2: "",
        week3: "",
        week4: "",
        catatan: ""
      });
      setEditingId(null);
  }

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      cabang: item.cabang || "",
      kelas: item.kelas || "",
      semester: item.semester || "",
      bulan: item.bulan || "",
      tema: item.tema || "",
      term: item.term || "",
      waktuKegiatan: item.waktuKegiatan || "",
      pembiasaan: item.pembiasaan || "",
      tujuanPembelajaran: item.tujuanPembelajaran || "",
      week1: item.week1 || "",
      week2: item.week2 || "",
      week3: item.week3 || "",
      week4: item.week4 || "",
      catatan: item.catatan || ""
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
        <table className="w-full text-sm text-left min-w-[1000px]">
          <thead className="bg-gray-50 text-gray-700 font-semibold border-b">
            <tr>
              <th className="p-4 w-16 text-center">No</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Kelas</th>
              <th className="p-4">Semester</th>
              <th className="p-4">Bulan</th>
              <th className="p-4">Tema</th>
              <th className="p-4 text-center w-40">Aksi</th>
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
                  <td className="p-4 text-gray-600">{item.kelas}</td>
                  <td className="p-4 text-gray-600">{item.semester}</td>
                  <td className="p-4 text-gray-600">{item.bulan}</td>
                  <td className="p-4 font-semibold text-[#581c87]">{item.tema}</td>
                  <td className="p-4">
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() => setViewDetail(item)}
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition"
                        title="Lihat Detail"
                      >
                        <Eye className="w-4 h-4" />
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
                        title="Hapus"
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[95vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-gray-800">{editingId ? "Edit Kegiatan" : "Tambah Kegiatan"}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pilih Cabang</label>
                  <select
                    required
                    className={`w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none ${userRole === "Kepala Sekolah" || userRole === "Guru" ? "bg-gray-100 cursor-not-allowed" : "bg-white"}`}
                    value={formData.cabang}
                    onChange={(e) => setFormData({ ...formData, cabang: e.target.value, kelas: "" })}
                    disabled={userRole === "Kepala Sekolah" || userRole === "Guru"}
                  >
                    <option value="">Pilih Cabang</option>
                    {cabangList.map((c) => (
                      <option key={c.id} value={c.nama}>{c.nama}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pilih Kelas</label>
                  <select
                    required
                    className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none bg-white disabled:bg-gray-100"
                    value={formData.kelas}
                    onChange={(e) => setFormData({ ...formData, kelas: e.target.value })}
                    disabled={!formData.cabang}
                  >
                    <option value="">Pilih Kelas</option>
                    {kelasList
                      .filter((k) => !formData.cabang || k.cabang === formData.cabang)
                      .map((k) => <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pilih Semester</label>
                  <select
                    required
                    className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none bg-white"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                  >
                    <option value="">Pilih Semester</option>
                    {semesterList.map((s) => <option key={s.id} value={s.namaPeriode}>{s.namaPeriode}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pilih Bulan</label>
                  <select
                    required
                    className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none bg-white"
                    value={formData.bulan}
                    onChange={(e) => setFormData({ ...formData, bulan: e.target.value })}
                  >
                    <option value="">Pilih Bulan</option>
                    {bulanList.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tema</label>
                  <input required type="text" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.tema} onChange={(e) => setFormData({ ...formData, tema: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Term</label>
                  <input required type="text" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.term} onChange={(e) => setFormData({ ...formData, term: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Waktu Kegiatan</label>
                  <input required type="text" className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.waktuKegiatan} onChange={(e) => setFormData({ ...formData, waktuKegiatan: e.target.value })} placeholder="Contoh: Minggu ke-3" />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Pembiasaan dan Islamic Behavior</label>
                  <textarea rows={4} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.pembiasaan} onChange={(e) => setFormData({ ...formData, pembiasaan: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Tujuan Pembelajaran</label>
                  <textarea rows={4} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.tujuanPembelajaran} onChange={(e) => setFormData({ ...formData, tujuanPembelajaran: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Week 1</label>
                  <textarea rows={4} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.week1} onChange={(e) => setFormData({ ...formData, week1: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Week 2</label>
                  <textarea rows={4} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.week2} onChange={(e) => setFormData({ ...formData, week2: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Week 3</label>
                  <textarea rows={4} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.week3} onChange={(e) => setFormData({ ...formData, week3: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Week 4</label>
                  <textarea rows={4} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.week4} onChange={(e) => setFormData({ ...formData, week4: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Catatan</label>
                  <textarea rows={4} className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none"
                    value={formData.catatan} onChange={(e) => setFormData({ ...formData, catatan: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">
                  Batal
                </button>
                <button type="submit" disabled={isSaving} className="bg-[#581c87] text-white px-4 py-2 rounded-lg hover:bg-[#45156b] transition text-sm font-medium flex items-center gap-2 disabled:opacity-70">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewDetail(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-gray-800">Detail Kegiatan</h3>
              <button onClick={() => setViewDetail(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div><p className="text-gray-500 text-xs">Cabang</p><p className="font-medium">{viewDetail.cabang}</p></div>
                <div><p className="text-gray-500 text-xs">Kelas</p><p className="font-medium">{viewDetail.kelas}</p></div>
                <div><p className="text-gray-500 text-xs">Semester</p><p className="font-medium">{viewDetail.semester}</p></div>
                <div><p className="text-gray-500 text-xs">Bulan</p><p className="font-medium">{viewDetail.bulan}</p></div>
                <div><p className="text-gray-500 text-xs">Tema</p><p className="font-medium">{viewDetail.tema}</p></div>
                <div><p className="text-gray-500 text-xs">Term</p><p className="font-medium">{viewDetail.term}</p></div>
                <div className="sm:col-span-3"><p className="text-gray-500 text-xs">Waktu Kegiatan</p><p className="font-medium">{viewDetail.waktuKegiatan}</p></div>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="border-t pt-3">
                    <p className="text-gray-500 text-xs mb-1">Pembiasaan dan Islamic Behavior</p>
                    <p className="font-medium whitespace-pre-wrap">{viewDetail.pembiasaan || "-"}</p>
                </div>
                <div className="border-t pt-3">
                    <p className="text-gray-500 text-xs mb-1">Tujuan Pembelajaran</p>
                    <p className="font-medium whitespace-pre-wrap">{viewDetail.tujuanPembelajaran || "-"}</p>
                </div>
                <div className="border-t pt-3">
                    <p className="text-gray-500 text-xs mb-1">Week 1</p>
                    <p className="font-medium whitespace-pre-wrap">{viewDetail.week1 || "-"}</p>
                </div>
                <div className="border-t pt-3">
                    <p className="text-gray-500 text-xs mb-1">Week 2</p>
                    <p className="font-medium whitespace-pre-wrap">{viewDetail.week2 || "-"}</p>
                </div>
                <div className="border-t pt-3">
                    <p className="text-gray-500 text-xs mb-1">Week 3</p>
                    <p className="font-medium whitespace-pre-wrap">{viewDetail.week3 || "-"}</p>
                </div>
                <div className="border-t pt-3">
                    <p className="text-gray-500 text-xs mb-1">Week 4</p>
                    <p className="font-medium whitespace-pre-wrap">{viewDetail.week4 || "-"}</p>
                </div>
                <div className="border-t pt-3">
                    <p className="text-gray-500 text-xs mb-1">Catatan</p>
                    <p className="font-medium whitespace-pre-wrap">{viewDetail.catatan || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}