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

interface IndikatorGroup {
  id: string;
  nama: string;
}

interface SubIndikator {
  id: string;
  groupId: string;
  kode: string;
  deskripsi: string;
}

export default function IndikatorPage() {
  // State untuk Parent (Indikator Group)
  const [groups, setGroups] = useState<IndikatorGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupFormData, setGroupFormData] = useState({ nama: "" });
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  // State untuk Child (Sub Indikator)
  const [selectedGroup, setSelectedGroup] = useState<IndikatorGroup | null>(null);
  const [subIndikators, setSubIndikators] = useState<SubIndikator[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subFormData, setSubFormData] = useState({ kode: "", deskripsi: "" });
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);

  // --- Functions untuk Parent ---

  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const q = query(collection(db, "indikator_groups"), orderBy("nama", "asc"));
      const querySnapshot = await getDocs(q);
      const items: IndikatorGroup[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as IndikatorGroup);
      });
      setGroups(items);
    } catch (error) {
      console.error("Error fetching groups:", error);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingGroup(true);
    try {
      if (editingGroupId) {
        await updateDoc(doc(db, "indikator_groups", editingGroupId), groupFormData);
        alert("Indikator berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "indikator_groups"), {
          ...groupFormData,
          createdAt: new Date(),
        });
        alert("Indikator berhasil ditambahkan!");
      }
      setIsGroupModalOpen(false);
      setGroupFormData({ nama: "" });
      setEditingGroupId(null);
      fetchGroups();
    } catch (error) {
      console.error("Error saving group:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmittingGroup(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Yakin ingin menghapus Indikator ini?")) return;
    try {
      await deleteDoc(doc(db, "indikator_groups", id));
      alert("Data berhasil dihapus.");
      fetchGroups();
    } catch (error) {
      console.error("Error deleting group:", error);
      alert("Gagal menghapus data.");
    }
  };

  const openGroupModal = (item?: IndikatorGroup) => {
    if (item) {
      setEditingGroupId(item.id);
      setGroupFormData({ nama: item.nama });
    } else {
      setEditingGroupId(null);
      setGroupFormData({ nama: "" });
    }
    setIsGroupModalOpen(true);
  };

  // --- Functions untuk Child ---

  const openSubModal = async (group: IndikatorGroup) => {
    setSelectedGroup(group);
    setIsSubModalOpen(true);
    setSubFormData({ kode: "", deskripsi: "" });
    setEditingSubId(null);
    await fetchSubIndikators(group.id);
  };

  const fetchSubIndikators = async (groupId: string) => {
    setLoadingSubs(true);
    try {
      const q = query(
        collection(db, "sub_indikators"),
        where("groupId", "==", groupId)
      );
      const querySnapshot = await getDocs(q);
      const items: SubIndikator[] = [];
      querySnapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as SubIndikator);
      });
      // Sort manual by kode
      items.sort((a, b) => a.kode.localeCompare(b.kode));
      setSubIndikators(items);
    } catch (error) {
      console.error("Error fetching sub indikators:", error);
    } finally {
      setLoadingSubs(false);
    }
  };

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    setIsSubmittingSub(true);
    try {
      if (editingSubId) {
        await updateDoc(doc(db, "sub_indikators", editingSubId), {
          ...subFormData,
          groupId: selectedGroup.id,
        });
        alert("Sub Indikator berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "sub_indikators"), {
          ...subFormData,
          groupId: selectedGroup.id,
          createdAt: new Date(),
        });
        alert("Sub Indikator berhasil ditambahkan!");
      }
      setSubFormData({ kode: "", deskripsi: "" });
      setEditingSubId(null);
      fetchSubIndikators(selectedGroup.id);
    } catch (error) {
      console.error("Error saving sub indikator:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const handleEditSub = (item: SubIndikator) => {
    setEditingSubId(item.id);
    setSubFormData({ kode: item.kode, deskripsi: item.deskripsi });
  };

  const handleDeleteSub = async (id: string) => {
    if (!confirm("Hapus sub indikator ini?")) return;
    try {
      await deleteDoc(doc(db, "sub_indikators", id));
      if (selectedGroup) fetchSubIndikators(selectedGroup.id);
    } catch (error) {
      console.error("Error deleting sub indikator:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Indikator Pembelajaran</h1>
        <button
          onClick={() => openGroupModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Data
        </button>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16">No</th>
                <th className="p-4">Indikator</th>
                <th className="p-4 w-48">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingGroups ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" />
                  </td>
                </tr>
              ) : groups.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center">
                    Belum ada data indikator.
                  </td>
                </tr>
              ) : (
                groups.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() => openGroupModal(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit Indikator"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openSubModal(item)}
                        className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition"
                        title="Tambah Sub Indikator"
                      >
                        <ListPlus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteGroup(item.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Hapus Indikator"
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

      {/* Modal Parent */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                {editingGroupId ? "Edit Indikator" : "Tambah Indikator"}
              </h3>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveGroup} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Indikator / Lingkup
                </label>
                <input
                  required
                  type="text"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  placeholder="Contoh: Nilai Agama dan Moral"
                  value={groupFormData.nama}
                  onChange={(e) => setGroupFormData({ ...groupFormData, nama: e.target.value })}
                />
              </div>
              <button
                disabled={isSubmittingGroup}
                type="submit"
                className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 disabled:opacity-50"
              >
                {isSubmittingGroup ? "Menyimpan..." : "Simpan"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Child */}
      {isSubModalOpen && selectedGroup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                Sub Indikator: {selectedGroup.nama}
              </h3>
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Form Child */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <h4 className="font-semibold text-gray-700 mb-3 text-sm">
                  {editingSubId ? "Edit Sub Indikator" : "Tambah Sub Indikator Baru"}
                </h4>
                <form onSubmit={handleSaveSub} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Kode
                      </label>
                      <input
                        required
                        type="text"
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                        placeholder="Contoh: 1.1"
                        value={subFormData.kode}
                        onChange={(e) =>
                          setSubFormData({ ...subFormData, kode: e.target.value })
                        }
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Deskripsi
                      </label>
                      <input
                        required
                        type="text"
                        className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                        placeholder="Deskripsi indikator..."
                        value={subFormData.deskripsi}
                        onChange={(e) =>
                          setSubFormData({ ...subFormData, deskripsi: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    {editingSubId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingSubId(null);
                          setSubFormData({ kode: "", deskripsi: "" });
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                      >
                        Batal
                      </button>
                    )}
                    <button
                      disabled={isSubmittingSub}
                      type="submit"
                      className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50"
                    >
                      {isSubmittingSub ? "Menyimpan..." : editingSubId ? "Update" : "Tambah"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Table Child */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
                    <tr>
                      <th className="p-3 w-12 text-center">No</th>
                      <th className="p-3 w-24">Kode</th>
                      <th className="p-3">Deskripsi</th>
                      <th className="p-3 w-24 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loadingSubs ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#581c87]" />
                        </td>
                      </tr>
                    ) : subIndikators.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-gray-500">
                          Belum ada sub indikator.
                        </td>
                      </tr>
                    ) : (
                      subIndikators.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="p-3 text-center">{index + 1}</td>
                          <td className="p-3 font-medium">{item.kode}</td>
                          <td className="p-3">{item.deskripsi}</td>
                          <td className="p-3 flex justify-center gap-2">
                            <button
                              onClick={() => handleEditSub(item)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSub(item.id)}
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