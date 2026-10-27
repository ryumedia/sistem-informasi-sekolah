"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Plus, Pencil, Trash2, X, Loader2, ListPlus } from "lucide-react";

interface IndikatorGroup {
  id: string;
  nama: string;
  jenjang: string;
}

interface Jenjang {
  id: string;
  nama: string;
}

export default function IndikatorPage() {
  // State untuk Parent (Indikator Group)
  const [groups, setGroups] = useState<IndikatorGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupFormData, setGroupFormData] = useState({ nama: "", jenjang: "" });
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [isSubmittingGroup, setIsSubmittingGroup] = useState(false);

  // State untuk Jenjang
  const [jenjangList, setJenjangList] = useState<Jenjang[]>([]);

  useEffect(() => {
    fetchJenjang();
  }, []);

  const fetchJenjang = async () => {
    try {
      const q = query(collection(db, "jenjang_kelas"), orderBy("nama", "asc"));
      const querySnapshot = await getDocs(q);
      const items: Jenjang[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Jenjang));
      setJenjangList(items);
    } catch (error) {
      console.error("Error fetching jenjang:", error);
    }
  };


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
      setGroupFormData({ nama: "", jenjang: "" });
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
      setGroupFormData({ nama: item.nama, jenjang: item.jenjang });
    } else {
      setEditingGroupId(null);
      setGroupFormData({ nama: "", jenjang: "" });
    }
    setIsGroupModalOpen(true);
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
                <th className="p-4">Jenjang</th>
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
                  <td colSpan={4} className="p-8 text-center">
                    Belum ada data indikator.
                  </td>
                </tr>
              ) : (
                groups.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                    <td className="p-4">{item.jenjang}</td>
                    <td className="p-4 flex gap-2">
                      <button
                        onClick={() => openGroupModal(item)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit Indikator"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <Link
                        href={`/admin/Akademik/indikator/${item.id}`}
                        className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition"
                        title="Kelola Sub Indikator"
                      >
                        <ListPlus className="w-4 h-4" />
                      </Link>
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
                  onChange={(e) => setGroupFormData(prev => ({ ...prev, nama: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jenjang
                </label>
                <select
                  required
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 bg-white"
                  value={groupFormData.jenjang}
                  onChange={(e) => setGroupFormData(prev => ({ ...prev, jenjang: e.target.value }))}
                >
                  <option value="">Pilih Jenjang</option>
                  {jenjangList.map(j => <option key={j.id} value={j.nama}>{j.nama}</option>)}
                </select>
              </div>
              <button
                disabled={isSubmittingGroup}
                type="submit"
                className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium disabled:opacity-50"
              >
                {isSubmittingGroup ? "Menyimpan..." : "Simpan"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
