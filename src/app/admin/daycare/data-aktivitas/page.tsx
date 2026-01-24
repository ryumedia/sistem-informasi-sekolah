"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  where,
} from "firebase/firestore";
import { Plus, Pencil, Trash2, X, Loader2, ListPlus } from "lucide-react";

// Main component for Daycare Activities
export default function DataAktivitasPage() {
  // State for Parent (Aktivitas)
  const [aktivitasList, setAktivitasList] = useState<any[]>([]);
  const [loadingAktivitas, setLoadingAktivitas] = useState(true);
  const [isAktivitasModalOpen, setIsAktivitasModalOpen] = useState(false);
  const [aktivitasFormData, setAktivitasFormData] = useState({ nama: "" });
  const [editingAktivitasId, setEditingAktivitasId] = useState<string | null>(
    null
  );
  const [isSubmittingAktivitas, setIsSubmittingAktivitas] = useState(false);

  // State for Child (Sub Aktivitas)
  const [selectedAktivitas, setSelectedAktivitas] = useState<any | null>(null);
  const [subAktivitasList, setSubAktivitasList] = useState<any[]>([]);
  const [loadingSubAktivitas, setLoadingSubAktivitas] = useState(false);
  const [isSubAktivitasModalOpen, setIsSubAktivitasModalOpen] =
    useState(false);
  const [subAktivitasFormData, setSubAktivitasFormData] = useState({
    deskripsi: "",
    opsiJawaban: [] as string[],
  });
  const [editingSubAktivitasId, setEditingSubAktivitasId] = useState<
    string | null
  >(null);
  const [isSubmittingSubAktivitas, setIsSubmittingSubAktivitas] =
    useState(false);

  // --- Functions for Parent (Aktivitas) ---
  const fetchAktivitas = async () => {
    setLoadingAktivitas(true);
    try {
      const q = query(
        collection(db, "daycare_aktivitas"),
        orderBy("urutan", "asc")
      );
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map((doc, index) => ({
        id: doc.id,
        ...doc.data(),
        // Fallback jika field 'urutan' belum ada di data lama
        urutan: doc.data().urutan ?? index,
      }));
      setAktivitasList(items);
    } catch (error) {
      console.error("Error fetching daycare activities:", error);
      alert(
        "Gagal memuat data. Pastikan Anda telah membuat index Firestore untuk koleksi 'daycare_aktivitas' dengan field 'urutan' (asc)."
      );
    } finally {
      setLoadingAktivitas(false);
    }
  };

  useEffect(() => {
    fetchAktivitas();
  }, []);

  const handleSaveAktivitas = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingAktivitas(true);
    try {
      if (editingAktivitasId) {
        await updateDoc(
          doc(db, "daycare_aktivitas", editingAktivitasId),
          aktivitasFormData
        );
        alert("Aktivitas berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "daycare_aktivitas"), {
          ...aktivitasFormData,
          createdAt: new Date(),
          urutan: aktivitasList.length, // Menambahkan item baru di urutan terakhir
        });
        alert("Aktivitas berhasil ditambahkan!");
      }
      setIsAktivitasModalOpen(false);
      setAktivitasFormData({ nama: "" });
      setEditingAktivitasId(null);
      fetchAktivitas();
    } catch (error) {
      console.error("Error saving activity:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmittingAktivitas(false);
    }
  };

  const handleDeleteAktivitas = async (id: string) => {
    if (
      !confirm(
        "Yakin ingin menghapus Aktivitas ini? Semua sub-aktivitas terkait juga akan terhapus."
      )
    )
      return;
    try {
      // Optional: Delete all sub-activities first
      const subQ = query(
        collection(db, "daycare_sub_aktivitas"),
        where("aktivitasId", "==", id)
      );
      const subSnapshot = await getDocs(subQ);
      const deletePromises = subSnapshot.docs.map((d) => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      // Delete the main activity
      await deleteDoc(doc(db, "daycare_aktivitas", id));
      alert("Data berhasil dihapus.");
      fetchAktivitas();
    } catch (error) {
      console.error("Error deleting activity:", error);
      alert("Gagal menghapus data.");
    }
  };

  const openAktivitasModal = (item: any = null) => {
    if (item) {
      setEditingAktivitasId(item.id);
      setAktivitasFormData({ nama: item.nama });
    } else {
      setEditingAktivitasId(null);
      setAktivitasFormData({ nama: "" });
    }
    setIsAktivitasModalOpen(true);
  };

  const handleUpdateUrutan = async (
    collectionName: string,
    id: string,
    newUrutan: string
  ) => {
    const urutan = parseInt(newUrutan);
    if (isNaN(urutan)) return;

    try {
      await updateDoc(doc(db, collectionName, id), { urutan });
      // Refresh data agar urutan terupdate di tampilan
      if (collectionName === "daycare_aktivitas") {
        fetchAktivitas();
      } else if (
        collectionName === "daycare_sub_aktivitas" &&
        selectedAktivitas
      ) {
        fetchSubAktivitas(selectedAktivitas.id);
      }
    } catch (error) {
      console.error("Error updating urutan:", error);
      alert("Gagal mengupdate urutan.");
    }
  };

  // --- Functions for Child (Sub Aktivitas) ---
  const openSubAktivitasModal = async (aktivitas: any) => {
    setSelectedAktivitas(aktivitas);
    setIsSubAktivitasModalOpen(true);
    setSubAktivitasFormData({ deskripsi: "", opsiJawaban: [] });
    setEditingSubAktivitasId(null);
    await fetchSubAktivitas(aktivitas.id);
  };

  const fetchSubAktivitas = async (aktivitasId: string) => {
    setLoadingSubAktivitas(true);
    try {
      const q = query(
        collection(db, "daycare_sub_aktivitas"),
        where("aktivitasId", "==", aktivitasId),
        orderBy("urutan", "asc")
      );
      const querySnapshot = await getDocs(q);
      const items = querySnapshot.docs.map((d, index) => ({
        id: d.id,
        ...d.data(),
        urutan: d.data().urutan ?? index,
      }));
      setSubAktivitasList(items);
    } catch (error) {
      console.error("Error fetching sub-activities:", error);
      alert(
        "Gagal memuat sub-aktivitas. Pastikan Anda telah membuat index Firestore untuk koleksi 'daycare_sub_aktivitas' dengan field 'aktivitasId' dan 'urutan'."
      );
    } finally {
      setLoadingSubAktivitas(false);
    }
  };

  const handleSaveSubAktivitas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAktivitas) return;
    setIsSubmittingSubAktivitas(true);
    try {
      if (editingSubAktivitasId) {
        await updateDoc(
          doc(db, "daycare_sub_aktivitas", editingSubAktivitasId),
          {
            ...subAktivitasFormData,
            aktivitasId: selectedAktivitas.id,
          }
        );
        alert("Sub Aktivitas berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "daycare_sub_aktivitas"), {
          ...subAktivitasFormData,
          aktivitasId: selectedAktivitas.id,
          createdAt: new Date(),
          urutan: subAktivitasList.length,
        });
        alert("Sub Aktivitas berhasil ditambahkan!");
      }
      setSubAktivitasFormData({ deskripsi: "", opsiJawaban: [] });
      setEditingSubAktivitasId(null);
      fetchSubAktivitas(selectedAktivitas.id);
    } catch (error) {
      console.error("Error saving sub-activity:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmittingSubAktivitas(false);
    }
  };

  const handleEditSubAktivitas = (item: any) => {
    setEditingSubAktivitasId(item.id);
    setSubAktivitasFormData({
      deskripsi: item.deskripsi,
      opsiJawaban: item.opsiJawaban || [],
    });
  };

  const handleDeleteSubAktivitas = async (id: string) => {
    if (!confirm("Hapus sub aktivitas ini?")) return;
    try {
      await deleteDoc(doc(db, "daycare_sub_aktivitas", id));
      if (selectedAktivitas) fetchSubAktivitas(selectedAktivitas.id);
    } catch (error) {
      console.error("Error deleting sub-activity:", error);
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...subAktivitasFormData.opsiJawaban];
    newOptions[index] = value;
    setSubAktivitasFormData({
      ...subAktivitasFormData,
      opsiJawaban: newOptions,
    });
  };

  const handleRemoveOption = (index: number) => {
    const newOptions = [...subAktivitasFormData.opsiJawaban];
    newOptions.splice(index, 1);
    setSubAktivitasFormData({
      ...subAktivitasFormData,
      opsiJawaban: newOptions,
    });
  };

  const handleAddOption = () => {
    setSubAktivitasFormData({
      ...subAktivitasFormData,
      opsiJawaban: [...subAktivitasFormData.opsiJawaban, ""],
    });
  };

  const handleAddLainnyaOption = () => {
    if (!subAktivitasFormData.opsiJawaban.includes("Lainnya")) {
      setSubAktivitasFormData({
        ...subAktivitasFormData,
        opsiJawaban: [...subAktivitasFormData.opsiJawaban, "Lainnya"],
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">
          Data Aktivitas Daycare
        </h1>
        <button
          onClick={() => openAktivitasModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Aktivitas
        </button>
      </div>

      {/* Main Activity Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16 text-center">No.</th>
                <th className="p-4 w-24 text-center">Urutan</th>
                <th className="p-4">Aktivitas</th>
                <th className="p-4 w-48 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingAktivitas ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" />
                  </td>
                </tr>
              ) : aktivitasList.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    Belum ada data aktivitas.
                  </td>
                </tr>
              ) : (
                aktivitasList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 text-center">
                      <input
                        type="number"
                        defaultValue={item.urutan}
                        onBlur={(e) =>
                          handleUpdateUrutan(
                            "daycare_aktivitas",
                            item.id,
                            e.target.value
                          )
                        }
                        className="w-16 border rounded p-1 text-center focus:ring-2 focus:ring-[#581c87] outline-none"
                      />
                    </td>
                    <td className="p-4 font-medium text-gray-900">
                      {item.nama}
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                      <button
                        onClick={() => openSubAktivitasModal(item)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                        title="Lihat/Tambah Sub Aktivitas"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openAktivitasModal(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit Aktivitas"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteAktivitas(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Hapus Aktivitas"
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

      {/* Modal for Main Activity */}
      {isAktivitasModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                {editingAktivitasId ? "Edit Aktivitas" : "Tambah Aktivitas"}
              </h3>
              <button
                onClick={() => setIsAktivitasModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveAktivitas} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Aktivitas
                </label>
                <input
                  required
                  type="text"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  placeholder="Contoh: Makan Siang"
                  value={aktivitasFormData.nama}
                  onChange={(e) =>
                    setAktivitasFormData({
                      ...aktivitasFormData,
                      nama: e.target.value,
                    })
                  }
                />
              </div>
              <button
                disabled={isSubmittingAktivitas}
                type="submit"
                className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 disabled:opacity-50"
              >
                {isSubmittingAktivitas ? "Menyimpan..." : "Simpan"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Sub Activity */}
      {isSubAktivitasModalOpen && selectedAktivitas && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl flex flex-col h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                Sub Aktivitas: {selectedAktivitas.nama}
              </h3>
              <button
                onClick={() => setIsSubAktivitasModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-700 mb-3 text-sm">
                  {editingSubAktivitasId
                    ? "Edit Sub Aktivitas"
                    : "Tambah Sub Aktivitas Baru"}
                </h4>
                <form onSubmit={handleSaveSubAktivitas} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Deskripsi / Pertanyaan
                    </label>
                    <input
                      required
                      type="text"
                      className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                      placeholder="Deskripsi sub aktivitas..."
                      value={subAktivitasFormData.deskripsi}
                      onChange={(e) =>
                        setSubAktivitasFormData({
                          ...subAktivitasFormData,
                          deskripsi: e.target.value,
                        })
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-2">
                      Opsi Jawaban
                    </label>
                    <div className="space-y-2">
                      {subAktivitasFormData.opsiJawaban.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                            placeholder={`Opsi ${index + 1}`}
                            value={option}
                            onChange={(e) =>
                              handleOptionChange(index, e.target.value)
                            }
                            disabled={option === "Lainnya"}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(index)}
                            className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={handleAddOption}
                        className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        Tambah Opsi
                      </button>
                      <button
                        type="button"
                        onClick={handleAddLainnyaOption}
                        disabled={subAktivitasFormData.opsiJawaban.includes(
                          "Lainnya"
                        )}
                        className="text-sm bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Tambah Opsi 'Lainnya'
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    {editingSubAktivitasId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubAktivitasId(null);
                          setSubAktivitasFormData({
                            deskripsi: "",
                            opsiJawaban: [],
                          });
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      disabled={isSubmittingSubAktivitas}
                      type="submit"
                      className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50"
                    >
                      {isSubmittingSubAktivitas
                        ? "Menyimpan..."
                        : editingSubAktivitasId
                        ? "Update"
                        : "Tambah"}
                    </button>
                  </div>
                </form>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
                    <tr>
                      <th className="p-3 w-12 text-center">No</th>
                      <th className="p-3 w-20 text-center">Urutan</th>
                      <th className="p-3">Deskripsi</th>
                      <th className="p-3">Opsi Jawaban</th>
                      <th className="p-3 w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loadingSubAktivitas ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#581c87]" />
                        </td>
                      </tr>
                    ) : subAktivitasList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-gray-500">
                          Belum ada sub aktivitas.
                        </td>
                      </tr>
                    ) : (
                      subAktivitasList.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="p-3 text-center">{index + 1}</td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              defaultValue={item.urutan}
                              onBlur={(e) =>
                                handleUpdateUrutan(
                                  "daycare_sub_aktivitas",
                                  item.id,
                                  e.target.value
                                )
                              }
                              className="w-14 border rounded p-1 text-center focus:ring-2 focus:ring-[#581c87] outline-none"
                            />
                          </td>
                          <td className="p-3">{item.deskripsi}</td>
                          <td className="p-3 text-xs text-gray-500 max-w-xs">
                            {item.opsiJawaban?.join(", ")}
                          </td>
                          <td className="p-3 flex justify-center gap-2">
                            <button
                              onClick={() => handleEditSubAktivitas(item)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteSubAktivitas(item.id)
                              }
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