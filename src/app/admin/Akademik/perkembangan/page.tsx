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
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Pencil, Trash2, X, Loader2, ListPlus } from "lucide-react";

interface KelompokUsia {
  id: string;
  usia: string;
}

interface TahapPerkembangan {
  id: string;
  kelompokUsiaId: string;
  lingkup: string;
  deskripsi: string;
}

export default function TahapPerkembanganPage() {
  // State untuk Kelompok Usia (Parent)
  const [ageGroups, setAgeGroups] = useState<KelompokUsia[]>([]);
  const [loadingAges, setLoadingAges] = useState(true);
  const [isAgeModalOpen, setIsAgeModalOpen] = useState(false);
  const [ageFormData, setAgeFormData] = useState({ usia: "" });
  const [editingAgeId, setEditingAgeId] = useState<string | null>(null);
  const [isSubmittingAge, setIsSubmittingAge] = useState(false);

  // State untuk Detail Perkembangan (Child)
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<KelompokUsia | null>(null);
  const [details, setDetails] = useState<TahapPerkembangan[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailFormData, setDetailFormData] = useState({ lingkup: "", deskripsi: "" });
  const [editingDetailId, setEditingDetailId] = useState<string | null>(null);
  const [isSubmittingDetail, setIsSubmittingDetail] = useState(false);

  // --- Functions untuk Kelompok Usia ---

  const fetchAgeGroups = async () => {
    setLoadingAges(true);
    try {
      const q = query(collection(db, "kelompok_usia"), orderBy("usia", "asc"));
      const querySnapshot = await getDocs(q);
      const items: KelompokUsia[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as KelompokUsia);
      });
      setAgeGroups(items);
    } catch (error) {
      console.error("Error fetching age groups:", error);
    } finally {
      setLoadingAges(false);
    }
  };

  useEffect(() => {
    fetchAgeGroups();
  }, []);

  const handleSaveAgeGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAge(true);
    try {
      if (editingAgeId) {
        await updateDoc(doc(db, "kelompok_usia", editingAgeId), ageFormData);
        alert("Data Usia berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "kelompok_usia"), {
          ...ageFormData,
          createdAt: new Date(),
        });
        alert("Data Usia berhasil ditambahkan!");
      }
      setIsAgeModalOpen(false);
      setAgeFormData({ usia: "" });
      setEditingAgeId(null);
      fetchAgeGroups();
    } catch (error) {
      console.error("Error saving age group:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmittingAge(false);
    }
  };

  const handleDeleteAgeGroup = async (id: string) => {
    if (!confirm("Yakin ingin menghapus Kelompok Usia ini?")) return;
    try {
      await deleteDoc(doc(db, "kelompok_usia", id));
      // Opsional: Hapus juga child documents di tahap_perkembangan jika perlu
      alert("Data berhasil dihapus.");
      fetchAgeGroups();
    } catch (error) {
      console.error("Error deleting age group:", error);
      alert("Gagal menghapus data.");
    }
  };

  const openAgeModal = (item?: KelompokUsia) => {
    if (item) {
      setEditingAgeId(item.id);
      setAgeFormData({ usia: item.usia });
    } else {
      setEditingAgeId(null);
      setAgeFormData({ usia: "" });
    }
    setIsAgeModalOpen(true);
  };

  // --- Functions untuk Detail Perkembangan ---

  const openDetailModal = async (ageGroup: KelompokUsia) => {
    setSelectedAgeGroup(ageGroup);
    setIsDetailModalOpen(true);
    setDetailFormData({ lingkup: "", deskripsi: "" });
    setEditingDetailId(null);
    await fetchDetails(ageGroup.id);
  };

  const fetchDetails = async (ageGroupId: string) => {
    setLoadingDetails(true);
    try {
      const q = query(
        collection(db, "tahap_perkembangan"),
        where("kelompokUsiaId", "==", ageGroupId)
      );
      const querySnapshot = await getDocs(q);
      const items: TahapPerkembangan[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as TahapPerkembangan);
      });
      setDetails(items);
    } catch (error) {
      console.error("Error fetching details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSaveDetail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgeGroup) return;
    setIsSubmittingDetail(true);
    try {
      if (editingDetailId) {
        await updateDoc(doc(db, "tahap_perkembangan", editingDetailId), {
          ...detailFormData,
          kelompokUsiaId: selectedAgeGroup.id,
        });
        alert("Detail perkembangan berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "tahap_perkembangan"), {
          ...detailFormData,
          kelompokUsiaId: selectedAgeGroup.id,
          createdAt: new Date(),
        });
        alert("Detail perkembangan berhasil ditambahkan!");
      }
      setDetailFormData({ lingkup: "", deskripsi: "" });
      setEditingDetailId(null);
      fetchDetails(selectedAgeGroup.id);
    } catch (error) {
      console.error("Error saving detail:", error);
      alert("Gagal menyimpan detail.");
    } finally {
      setIsSubmittingDetail(false);
    }
  };

  const handleEditDetail = (item: TahapPerkembangan) => {
    setEditingDetailId(item.id);
    setDetailFormData({ lingkup: item.lingkup, deskripsi: item.deskripsi });
  };

  const handleDeleteDetail = async (id: string) => {
    if (!confirm("Hapus detail perkembangan ini?")) return;
    try {
      await deleteDoc(doc(db, "tahap_perkembangan", id));
      if (selectedAgeGroup) fetchDetails(selectedAgeGroup.id);
    } catch (error) {
      console.error("Error deleting detail:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Utama */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Tahap Perkembangan (STPPA)</h1>
        <button
          onClick={() => openAgeModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Data
        </button>
      </div>

      {/* Tabel Utama (Kelompok Usia) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16">No</th>
                <th className="p-4">Usia</th>
                <th className="p-4 w-48">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingAges ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" />
                  </td>
                </tr>
              ) : ageGroups.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center">
                    Belum ada data kelompok usia.
                  </td>
                </tr>
              ) : (
                ageGroups.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{item.usia}</td>
                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() => openAgeModal(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit Usia"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openDetailModal(item)}
                        className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition"
                        title="Kelola Daftar Perkembangan"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAgeGroup(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Hapus Usia"
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

      {/* Modal Tambah/Edit Usia */}
      {isAgeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                {editingAgeId ? "Edit Kelompok Usia" : "Tambah Kelompok Usia"}
              </h3>
              <button
                onClick={() => setIsAgeModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAgeGroup} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kelompok Usia
                </label>
                <input
                  required
                  type="text"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  placeholder="Contoh: 4-5 Tahun"
                  value={ageFormData.usia}
                  onChange={(e) => setAgeFormData({ ...ageFormData, usia: e.target.value })}
                />
              </div>
              <button
                disabled={isSubmittingAge}
                type="submit"
                className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 disabled:opacity-50"
              >
                {isSubmittingAge ? "Menyimpan..." : "Simpan"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kelola Detail Perkembangan */}
      {isDetailModalOpen && selectedAgeGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                Daftar Perkembangan: {selectedAgeGroup.usia}
              </h3>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Form Tambah Detail */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-700 mb-3 text-sm">
                  {editingDetailId ? "Edit Item Perkembangan" : "Tambah Item Perkembangan Baru"}
                </h4>
                <form onSubmit={handleSaveDetail} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Lingkup
                      </label>
                      <select
                        required
                        className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                        value={detailFormData.lingkup}
                        onChange={(e) =>
                          setDetailFormData({ ...detailFormData, lingkup: e.target.value })
                        }
                      >
                        <option value="">Pilih Lingkup</option>
                        <option value="Motorik Kasar">Motorik Kasar</option>
                        <option value="Motorik Halus & Adaptif">Motorik Halus & Adaptif</option>
                        <option value="Bicara & Bahasa">Bicara & Bahasa</option>
                        <option value="Sosialisasi & Kemandirian">Sosialisasi & Kemandirian</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Deskripsi
                      </label>
                      <input
                        required
                        type="text"
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                        placeholder="Deskripsi pencapaian..."
                        value={detailFormData.deskripsi}
                        onChange={(e) =>
                          setDetailFormData({ ...detailFormData, deskripsi: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingDetailId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDetailId(null);
                          setDetailFormData({ lingkup: "", deskripsi: "" });
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      disabled={isSubmittingDetail}
                      type="submit"
                      className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50"
                    >
                      {isSubmittingDetail ? "Menyimpan..." : editingDetailId ? "Update Item" : "Tambah Item"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Tabel Detail */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
                    <tr>
                      <th className="p-3 w-12 text-center">No</th>
                      <th className="p-3 w-40">Lingkup</th>
                      <th className="p-3">Deskripsi</th>
                      <th className="p-3 w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loadingDetails ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#581c87]" />
                        </td>
                      </tr>
                    ) : details.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-gray-500">
                          Belum ada item perkembangan untuk usia ini.
                        </td>
                      </tr>
                    ) : (
                      details.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="p-3 text-center">{index + 1}</td>
                          <td className="p-3 font-medium">{item.lingkup}</td>
                          <td className="p-3">{item.deskripsi}</td>
                          <td className="p-3 flex justify-center gap-2">
                            <button
                              onClick={() => handleEditDetail(item)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteDetail(item.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                              title="Hapus"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      )}
    </div>
  );
}
