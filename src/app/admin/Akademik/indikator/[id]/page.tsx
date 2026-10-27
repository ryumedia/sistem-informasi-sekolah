"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Pencil, Trash2, Loader2, Plus, X } from "lucide-react";

interface IndikatorGroup {
  id: string;
  nama: string;
  jenjang: string;
}

interface SubIndikator {
  id: string;
  groupId: string;
  kode: string;
  deskripsi: string;
  periode: string;
}

interface Periode {
  id: string;
  namaPeriode: string;
  isDefault?: boolean;
}

export default function KelolaSubIndikatorPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [selectedGroup, setSelectedGroup] = useState<IndikatorGroup | null>(null);
  const [subIndikators, setSubIndikators] = useState<SubIndikator[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subFormData, setSubFormData] = useState({ kode: "", deskripsi: "", periode: "" });
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);

  // State untuk filter
  const [filterPeriode, setFilterPeriode] = useState("");

  // State untuk Periode KPI
  const [periodeList, setPeriodeList] = useState<Periode[]>([]);
  const [selectedPeriode, setSelectedPeriode] = useState<string>("");
  const [periodeMap, setPeriodeMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchPeriode = async () => {
      try {
        const q = query(collection(db, "kpi_periode"), orderBy("isDefault", "desc"));
        const querySnapshot = await getDocs(q);
        const periods = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Periode));
        const newPeriodeMap = new Map(periods.map((p) => [p.id, p.namaPeriode]));

        setPeriodeList(periods);
        setPeriodeMap(newPeriodeMap);

        const defaultId = periods.length > 0 ? periods[0].id : "";
        setSelectedPeriode(defaultId);
      } catch (error) {
        console.error("Error fetching kpi_periode: ", error);
      }
    };
    fetchPeriode();
  }, []);

  const fetchGroup = async () => {
    if (!groupId) return;
    try {
      const docSnap = await getDoc(doc(db, "indikator_groups", groupId));
      if (!docSnap.exists()) {
        alert("Indikator tidak ditemukan.");
        router.push("/admin/Akademik/indikator");
        return;
      }
      setSelectedGroup({ id: docSnap.id, ...docSnap.data() } as IndikatorGroup);
    } catch (error) {
      console.error("Error fetching group:", error);
    }
  };

  const fetchSubIndikators = async () => {
    if (!groupId) return;
    setLoadingSubs(true);
    try {
      const q = query(collection(db, "sub_indikators"), where("groupId", "==", groupId));
      const querySnapshot = await getDocs(q);
      const items: SubIndikator[] = [];
      querySnapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as SubIndikator);
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

  useEffect(() => {
    fetchGroup();
    fetchSubIndikators();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const openSubModal = (item?: SubIndikator) => {
    if (item) {
      setEditingSubId(item.id);
      setSubFormData({
        kode: item.kode,
        deskripsi: item.deskripsi,
        periode: item.periode || selectedPeriode,
      });
    } else {
      setEditingSubId(null);
      setSubFormData({ kode: "", deskripsi: "", periode: selectedPeriode });
    }
    setIsSubModalOpen(true);
  };

  const closeSubModal = () => {
    setIsSubModalOpen(false);
    setEditingSubId(null);
    setSubFormData({ kode: "", deskripsi: "", periode: selectedPeriode });
  };

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;
    setIsSubmittingSub(true);
    try {
      if (editingSubId) {
        await updateDoc(doc(db, "sub_indikators", editingSubId), {
          ...subFormData,
          groupId,
        });
        alert("Sub Indikator berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "sub_indikators"), {
          ...subFormData,
          groupId,
          createdAt: new Date(),
        });
        alert("Sub Indikator berhasil ditambahkan!");
      }
      closeSubModal();
      fetchSubIndikators();
    } catch (error) {
      console.error("Error saving sub indikator:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const handleDeleteSub = async (id: string) => {
    if (!confirm("Hapus sub indikator ini?")) return;
    try {
      await deleteDoc(doc(db, "sub_indikators", id));
      fetchSubIndikators();
    } catch (error) {
      console.error("Error deleting sub indikator:", error);
    }
  };

  const filteredSubs = useMemo(() => {
    return subIndikators
      .filter((item) => (filterPeriode ? item.periode === filterPeriode : true))
      .slice()
      .sort((a, b) => a.kode.localeCompare(b.kode));
  }, [subIndikators, filterPeriode]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <Link
            href="/admin/Akademik/indikator"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Indikator
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Daftar Sub Indikator</h1>
          <p className="text-gray-600">
            Indikator: {selectedGroup?.nama || "Memuat..."}
            {selectedGroup?.jenjang ? ` (${selectedGroup.jenjang})` : ""}
          </p>
        </div>
        <button
          onClick={() => openSubModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition shrink-0"
        >
          <Plus className="w-4 h-4" /> Tambah Sub Indikator
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="w-full md:w-64">
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter Semester</label>
            <select
              className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
              value={filterPeriode}
              onChange={(e) => setFilterPeriode(e.target.value)}
            >
              <option value="">Semua Semester</option>
              {periodeList.map((p) => (
                <option key={p.id} value={p.id}>{p.namaPeriode}</option>
              ))}
            </select>
          </div>
          {filterPeriode && (
            <button
              onClick={() => setFilterPeriode("")}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              <X className="w-4 h-4" /> Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Tabel Sub Indikator */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3 w-24">Kode</th>
                <th className="p-3">Deskripsi Indikator</th>
                <th className="p-3 w-40">Semester</th>
                <th className="p-3 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingSubs ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#581c87]" />
                  </td>
                </tr>
              ) : filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    {subIndikators.length === 0
                      ? "Belum ada sub indikator untuk indikator ini."
                      : "Tidak ada sub indikator yang sesuai dengan filter."}
                  </td>
                </tr>
              ) : (
                filteredSubs.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-3 text-center">{index + 1}</td>
                    <td className="p-3 font-medium">{item.kode}</td>
                    <td className="p-3">{item.deskripsi}</td>
                    <td className="p-3">{periodeMap.get(item.periode) || "N/A"}</td>
                    <td className="p-3 flex justify-center gap-2">
                      <button
                        onClick={() => openSubModal(item)}
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

      {/* Modal Tambah/Edit Sub Indikator */}
      {isSubModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                {editingSubId ? "Edit Sub Indikator" : "Tambah Sub Indikator"}
              </h3>
              <button onClick={closeSubModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSub} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kode</label>
                <input
                  required
                  type="text"
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  placeholder="Contoh: 1.1"
                  value={subFormData.kode}
                  onChange={(e) => setSubFormData({ ...subFormData, kode: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi Indikator
                </label>
                <textarea
                  required
                  rows={4}
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 resize-y min-h-[100px]"
                  placeholder="Deskripsi indikator..."
                  value={subFormData.deskripsi}
                  onChange={(e) =>
                    setSubFormData({ ...subFormData, deskripsi: e.target.value })
                  }
                />
                <p className="text-xs text-gray-400 mt-1">
                  Kotak dapat ditarik ke bawah untuk memperluas area penulisan.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Semester</label>
                <select
                  required
                  className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={subFormData.periode}
                  onChange={(e) => setSubFormData({ ...subFormData, periode: e.target.value })}
                >
                  <option value="">Pilih Semester</option>
                  {periodeList.map((p) => (
                    <option key={p.id} value={p.id}>{p.namaPeriode}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeSubModal}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                >
                  Batal
                </button>
                <button
                  disabled={isSubmittingSub}
                  type="submit"
                  className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50"
                >
                  {isSubmittingSub ? "Menyimpan..." : editingSubId ? "Update" : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
