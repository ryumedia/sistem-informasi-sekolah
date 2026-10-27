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

interface KelompokUsia {
  id: string;
  usia: string;
}

interface TahapPerkembangan {
  id: string;
  kelompokUsiaId: string;
  lingkup: string;
  deskripsi: string;
  periode: string;
}

interface Periode {
  id: string;
  namaPeriode: string;
  isDefault?: boolean;
}

const LINGKUP_OPTIONS = [
  "Motorik Kasar",
  "Motorik Halus",
  "Berpikir Logis",
  "Memahami Bahasa",
  "Perilaku Prososial",
];

export default function KelolaPerkembanganPage() {
  const params = useParams();
  const router = useRouter();
  const ageGroupId = params.id as string;

  const [selectedAgeGroup, setSelectedAgeGroup] = useState<KelompokUsia | null>(null);
  const [details, setDetails] = useState<TahapPerkembangan[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailFormData, setDetailFormData] = useState({ lingkup: "", deskripsi: "", periode: "" });
  const [editingDetailId, setEditingDetailId] = useState<string | null>(null);
  const [isSubmittingDetail, setIsSubmittingDetail] = useState(false);

  // State untuk filter
  const [filterLingkup, setFilterLingkup] = useState("");
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

  const fetchAgeGroup = async () => {
    if (!ageGroupId) return;
    try {
      const docSnap = await getDoc(doc(db, "kelompok_usia", ageGroupId));
      if (!docSnap.exists()) {
        alert("Kelompok usia tidak ditemukan.");
        router.push("/admin/Akademik/perkembangan");
        return;
      }
      setSelectedAgeGroup({ id: docSnap.id, ...docSnap.data() } as KelompokUsia);
    } catch (error) {
      console.error("Error fetching age group:", error);
    }
  };

  const fetchDetails = async () => {
    if (!ageGroupId) return;
    setLoadingDetails(true);
    try {
      const q = query(
        collection(db, "tahap_perkembangan"),
        where("kelompokUsiaId", "==", ageGroupId)
      );
      const querySnapshot = await getDocs(q);
      const items: TahapPerkembangan[] = [];
      querySnapshot.forEach((d) => {
        items.push({ id: d.id, ...d.data() } as TahapPerkembangan);
      });
      setDetails(items);
    } catch (error) {
      console.error("Error fetching details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  useEffect(() => {
    fetchAgeGroup();
    fetchDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ageGroupId]);

  const openDetailModal = (item?: TahapPerkembangan) => {
    if (item) {
      setEditingDetailId(item.id);
      setDetailFormData({
        lingkup: item.lingkup,
        deskripsi: item.deskripsi,
        periode: item.periode || selectedPeriode,
      });
    } else {
      setEditingDetailId(null);
      setDetailFormData({ lingkup: "", deskripsi: "", periode: selectedPeriode });
    }
    setIsDetailModalOpen(true);
  };

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setEditingDetailId(null);
    setDetailFormData({ lingkup: "", deskripsi: "", periode: selectedPeriode });
  };

  const handleSaveDetail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ageGroupId) return;
    setIsSubmittingDetail(true);
    try {
      if (editingDetailId) {
        await updateDoc(doc(db, "tahap_perkembangan", editingDetailId), {
          ...detailFormData,
          kelompokUsiaId: ageGroupId,
        });
        alert("Detail perkembangan berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "tahap_perkembangan"), {
          ...detailFormData,
          kelompokUsiaId: ageGroupId,
          createdAt: new Date(),
        });
        alert("Detail perkembangan berhasil ditambahkan!");
      }
      closeDetailModal();
      fetchDetails();
    } catch (error) {
      console.error("Error saving detail:", error);
      alert("Gagal menyimpan detail.");
    } finally {
      setIsSubmittingDetail(false);
    }
  };

  const handleDeleteDetail = async (id: string) => {
    if (!confirm("Hapus detail perkembangan ini?")) return;
    try {
      await deleteDoc(doc(db, "tahap_perkembangan", id));
      fetchDetails();
    } catch (error) {
      console.error("Error deleting detail:", error);
    }
  };

  const filteredDetails = useMemo(() => {
    return details
      .filter((item) => (filterLingkup ? item.lingkup === filterLingkup : true))
      .filter((item) => (filterPeriode ? item.periode === filterPeriode : true))
      .slice()
      .sort((a, b) => {
        const lingkupComparison =
          LINGKUP_OPTIONS.indexOf(a.lingkup) - LINGKUP_OPTIONS.indexOf(b.lingkup);
        if (lingkupComparison !== 0) {
          return lingkupComparison;
        }
        return a.deskripsi.localeCompare(b.deskripsi);
      });
  }, [details, filterLingkup, filterPeriode]);

  const isFilterActive = Boolean(filterLingkup || filterPeriode);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start gap-4">
        <div>
          <Link
            href="/admin/Akademik/perkembangan"
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Daftar Kelompok Usia
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">Daftar Perkembangan</h1>
          <p className="text-gray-600">
            Kelompok Usia: {selectedAgeGroup?.usia || "Memuat..."}
          </p>
        </div>
        <button
          onClick={() => openDetailModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition shrink-0"
        >
          <Plus className="w-4 h-4" /> Tambah Item
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="w-full md:w-64">
            <label className="block text-xs font-medium text-gray-600 mb-1">Filter Lingkup</label>
            <select
              className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
              value={filterLingkup}
              onChange={(e) => setFilterLingkup(e.target.value)}
            >
              <option value="">Semua Lingkup</option>
              {LINGKUP_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
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
          {isFilterActive && (
            <button
              onClick={() => {
                setFilterLingkup("");
                setFilterPeriode("");
              }}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-100 transition"
            >
              <X className="w-4 h-4" /> Reset Filter
            </button>
          )}
        </div>
      </div>

      {/* Tabel Detail */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-3 w-12 text-center">No</th>
                <th className="p-3 w-40">Lingkup</th>
                <th className="p-3">Deskripsi</th>
                <th className="p-3 w-40">Semester</th>
                <th className="p-3 w-24 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingDetails ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#581c87]" />
                  </td>
                </tr>
              ) : filteredDetails.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-gray-500">
                    {details.length === 0
                      ? "Belum ada item perkembangan untuk usia ini."
                      : "Tidak ada item yang sesuai dengan filter."}
                  </td>
                </tr>
              ) : (
                filteredDetails.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-3 text-center">{index + 1}</td>
                    <td className="p-3 font-medium">{item.lingkup}</td>
                    <td className="p-3">{item.deskripsi}</td>
                    <td className="p-3">{periodeMap.get(item.periode) || "N/A"}</td>
                    <td className="p-3 flex justify-center gap-2">
                      <button
                        onClick={() => openDetailModal(item)}
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

      {/* Modal Tambah/Edit Item Perkembangan */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">
                {editingDetailId ? "Edit Item Perkembangan" : "Tambah Item Perkembangan"}
              </h3>
              <button
                onClick={closeDetailModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDetail} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Lingkup</label>
                <select
                  required
                  className="w-full border rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={detailFormData.lingkup}
                  onChange={(e) =>
                    setDetailFormData({ ...detailFormData, lingkup: e.target.value })
                  }
                >
                  <option value="">Pilih Lingkup</option>
                  {LINGKUP_OPTIONS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
                <textarea
                  required
                  rows={4}
                  className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900 resize-y min-h-[100px]"
                  placeholder="Deskripsi pencapaian..."
                  value={detailFormData.deskripsi}
                  onChange={(e) =>
                    setDetailFormData({ ...detailFormData, deskripsi: e.target.value })
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
                  value={detailFormData.periode}
                  onChange={(e) =>
                    setDetailFormData({ ...detailFormData, periode: e.target.value })
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
                  onClick={closeDetailModal}
                  className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2"
                >
                  Batal
                </button>
                <button
                  disabled={isSubmittingDetail}
                  type="submit"
                  className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50"
                >
                  {isSubmittingDetail
                    ? "Menyimpan..."
                    : editingDetailId
                      ? "Update Item"
                      : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
