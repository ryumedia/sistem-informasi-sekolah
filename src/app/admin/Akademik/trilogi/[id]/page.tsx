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

interface TrilogiGroup {
  id: string;
  nama: string;
}

interface SubTrilogi {
  id: string;
  groupId: string;
  kelompokUsia: string;
  habit: string;
  deskripsi: string;
  periode: string;
}

interface Periode {
  id: string;
  namaPeriode: string;
  isDefault?: boolean;
}

interface KelompokUsia {
  id: string;
  usia: string;
}

interface Habit {
  id: string;
  nama: string;
}

export default function KelolaSubTrilogiPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;

  const [selectedGroup, setSelectedGroup] = useState<TrilogiGroup | null>(null);
  const [subTrilogiList, setSubTrilogiList] = useState<SubTrilogi[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(true);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subFormData, setSubFormData] = useState({
    kelompokUsia: "",
    habit: "",
    deskripsi: "",
    periode: "",
  });
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);

  // State untuk filter
  const [filterUsia, setFilterUsia] = useState("");
  const [filterHabit, setFilterHabit] = useState("");
  const [filterPeriode, setFilterPeriode] = useState("");

  // State untuk master data
  const [usiaList, setUsiaList] = useState<KelompokUsia[]>([]);
  const [habitList, setHabitList] = useState<Habit[]>([]);
  const [periodeList, setPeriodeList] = useState<Periode[]>([]);
  const [selectedPeriode, setSelectedPeriode] = useState<string>("");
  const [periodeMap, setPeriodeMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        // Periode KPI
        const qPeriode = query(collection(db, "kpi_periode"), orderBy("isDefault", "desc"));
        const snapPeriode = await getDocs(qPeriode);
        const periods = snapPeriode.docs.map((d) => ({ id: d.id, ...d.data() } as Periode));
        setPeriodeList(periods);
        setPeriodeMap(new Map(periods.map((p) => [p.id, p.namaPeriode])));
        setSelectedPeriode(periods.length > 0 ? periods[0].id : "");

        // Kelompok Usia
        const qUsia = query(collection(db, "kelompok_usia"), orderBy("usia", "asc"));
        const snapUsia = await getDocs(qUsia);
        setUsiaList(snapUsia.docs.map((d) => ({ id: d.id, ...d.data() } as KelompokUsia)));

        // 7 Habits
        const qHabits = query(collection(db, "seven_habits"), orderBy("nama", "asc"));
        const snapHabits = await getDocs(qHabits);
        setHabitList(snapHabits.docs.map((d) => ({ id: d.id, ...d.data() } as Habit)));
      } catch (error) {
        console.error("Error fetching master data:", error);
      }
    };
    fetchMasterData();
  }, []);

  const fetchGroup = async () => {
    if (!groupId) return;
    try {
      const docSnap = await getDoc(doc(db, "trilogi_groups", groupId));
      if (!docSnap.exists()) {
        alert("Trilogi tidak ditemukan.");
        router.push("/admin/Akademik/trilogi");
        return;
      }
      setSelectedGroup({ id: docSnap.id, ...docSnap.data() } as TrilogiGroup);
    } catch (error) {
      console.error("Error fetching trilogi group:", error);
    }
  };

  const fetchSubTrilogi = async () => {
    if (!groupId) return;
    setLoadingSubs(true);
    try {
      const q = query(collection(db, "sub_trilogi"), where("groupId", "==", groupId));
      const querySnapshot = await getDocs(q);
      const items: SubTrilogi[] = [];
      querySnapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as SubTrilogi);
      });
      // Sort manual by kelompokUsia
      items.sort((a, b) => (a.kelompokUsia || "").localeCompare(b.kelompokUsia || ""));
      setSubTrilogiList(items);
    } catch (error) {
      console.error("Error fetching sub trilogi:", error);
    } finally {
      setLoadingSubs(false);
    }
  };

  useEffect(() => {
    fetchGroup();
    fetchSubTrilogi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const openSubModal = (item?: SubTrilogi) => {
    if (item) {
      setEditingSubId(item.id);
      setSubFormData({
        kelompokUsia: item.kelompokUsia,
        habit: item.habit,
        deskripsi: item.deskripsi,
        periode: item.periode || selectedPeriode,
      });
    } else {
      setEditingSubId(null);
      setSubFormData({ kelompokUsia: "", habit: "", deskripsi: "", periode: selectedPeriode });
    }
    setIsSubModalOpen(true);
  };

  const closeSubModal = () => {
    setIsSubModalOpen(false);
    setEditingSubId(null);
    setSubFormData({ kelompokUsia: "", habit: "", deskripsi: "", periode: selectedPeriode });
  };

  const handleSaveSub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;
    setIsSubmittingSub(true);
    try {
      if (editingSubId) {
        await updateDoc(doc(db, "sub_trilogi", editingSubId), {
          ...subFormData,
          groupId,
        });
        alert("Sub Trilogi berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "sub_trilogi"), {
          ...subFormData,
          groupId,
          createdAt: new Date(),
        });
        alert("Sub Trilogi berhasil ditambahkan!");
      }
      closeSubModal();
      fetchSubTrilogi();
    } catch (error) {
      console.error("Error saving sub trilogi:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmittingSub(false);
    }
  };

  const handleDeleteSub = async (id: string) => {
    if (!confirm("Hapus sub trilogi ini?")) return;
    try {
      await deleteDoc(doc(db, "sub_trilogi", id));
      fetchSubTrilogi();
    } catch (error) {
      console.error("Error deleting sub trilogi:", error);
    }
  };

  const filteredSubs = useMemo(() => {
    return subTrilogiList
      .filter((item) => (filterUsia ? item.kelompokUsia === filterUsia : true))
      .filter((item) => (filterHabit ? item.habit === filterHabit : true))
      .filter((item) => (filterPeriode ? item.periode === filterPeriode : true))
      .slice()
      .sort((a, b) => (a.kelompokUsia || "").localeCompare(b.kelompokUsia || ""));
  }, [subTrilogiList, filterUsia, filterHabit, filterPeriode]);

  const isFilterActive = Boolean(filterUsia || filterHabit || filterPeriode);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <Link
            href="/admin/Akademik/trilogi"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Trilogi
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Daftar Sub Trilogi</h1>
          <p className="text-gray-600">Trilogi: {selectedGroup?.nama || "Memuat..."}</p>
        </div>
        <button
          onClick={() => openSubModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition shrink-0"
        >
          <Plus className="w-4 h-4" /> Tambah Sub Trilogi
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="w-full lg:w-52">
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter Kelompok Usia</label>
            <select
              className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
              value={filterUsia}
              onChange={(e) => setFilterUsia(e.target.value)}
            >
              <option value="">Semua Usia</option>
              {usiaList.map((u) => (
                <option key={u.id} value={u.usia}>{u.usia}</option>
              ))}
            </select>
          </div>
          <div className="w-full lg:w-56">
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter Habit</label>
            <select
              className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
              value={filterHabit}
              onChange={(e) => setFilterHabit(e.target.value)}
            >
              <option value="">Semua Habit</option>
              {habitList.map((h) => (
                <option key={h.id} value={h.nama}>{h.nama}</option>
              ))}
            </select>
          </div>
          <div className="w-full lg:w-52">
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
          {isFilterActive && (
            <button
              onClick={() => {
                setFilterUsia("");
                setFilterHabit("");
                setFilterPeriode("");
              }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              <X className="w-4 h-4" /> Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Tabel Sub Trilogi */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3 w-32">Usia</th>
                <th className="p-3 w-48">Habit</th>
                <th className="p-3">Deskripsi Sub Trilogi</th>
                <th className="p-3 w-40">Semester</th>
                <th className="p-3 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingSubs ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#581c87]" />
                  </td>
                </tr>
              ) : filteredSubs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-gray-500">
                    {subTrilogiList.length === 0
                      ? "Belum ada sub trilogi untuk trilogi ini."
                      : "Tidak ada sub trilogi yang sesuai dengan filter."}
                  </td>
                </tr>
              ) : (
                filteredSubs.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-3 text-center">{index + 1}</td>
                    <td className="p-3 font-medium">{item.kelompokUsia}</td>
                    <td className="p-3 text-gray-600 text-xs">{item.habit}</td>
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

      {/* Modal Tambah/Edit Sub Trilogi */}
      {isSubModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                {editingSubId ? "Edit Sub Trilogi" : "Tambah Sub Trilogi"}
              </h3>
              <button onClick={closeSubModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveSub} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Kelompok Usia
                  </label>
                  <select
                    required
                    className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={subFormData.kelompokUsia}
                    onChange={(e) =>
                      setSubFormData({ ...subFormData, kelompokUsia: e.target.value })
                    }
                  >
                    <option value="">Pilih Usia</option>
                    {usiaList.map((u) => (
                      <option key={u.id} value={u.usia}>{u.usia}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Habit</label>
                  <select
                    required
                    className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                    value={subFormData.habit}
                    onChange={(e) =>
                      setSubFormData({ ...subFormData, habit: e.target.value })
                    }
                  >
                    <option value="">Pilih Habit</option>
                    {habitList.map((h) => (
                      <option key={h.id} value={h.nama}>{h.nama}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Deskripsi Sub Trilogi
                </label>
                <textarea
                  required
                  rows={4}
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 resize-y min-h-[100px]"
                  placeholder="Deskripsi trilogi..."
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
                  onChange={(e) =>
                    setSubFormData({ ...subFormData, periode: e.target.value })
                  }
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
