// src/components/dashboard/OvertimeView.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { ArrowLeft, Plus, X, Timer, Trash2 } from "lucide-react";

// --- INTERFACES ---
interface OvertimeEntry {
  id: string;
  tanggal: string; // "YYYY-MM-DD"
  nama: string;
  cabang: string;
  kelas: string;
  jenis: string; // "Kedatangan" | "Kepulangan"
  waktu: string; // contoh: "11:25"
  nominal: number;
  siswaId?: string;
}

interface AuthUser {
  uid?: string;
  email?: string | null;
}

interface AppUserData {
  nama?: string;
  role?: string;
  cabang?: string;
}

interface CabangItem {
  id: string;
  nama: string;
}

interface KelasItem {
  id: string;
  namaKelas: string;
}

interface SiswaItem {
  id: string;
  nama: string;
  nisn?: string;
}

const JENIS_OVERTIME = ["Kedatangan", "Kepulangan"];

const formatTanggal = (tanggal: string) => {
  if (!tanggal) return "-";
  const date = new Date(tanggal);
  if (isNaN(date.getTime())) return tanggal;
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// --- MODAL FORM TAMBAH OVERTIME ---
function OvertimeModal({
  user,
  userData,
  onClose,
  onSaved,
}: {
  user: AuthUser;
  userData: AppUserData;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const lockedCabang =
    ["Kepala Sekolah", "Guru", "Asisten Guru", "Caregiver"].includes(userData?.role || "") && userData?.cabang
      ? userData.cabang
      : "";

  const [cabangList, setCabangList] = useState<CabangItem[]>([]);
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split("T")[0],
    cabang: lockedCabang,
    kelas: "",
    siswaId: "",
    jenis: "",
    waktu: "",
    nominal: 0,
  });

  // Ambil daftar cabang
  useEffect(() => {
    const fetchCabang = async () => {
      try {
        const snap = await getDocs(query(collection(db, "cabang"), orderBy("nama", "asc")));
        setCabangList(snap.docs.map((d) => ({ id: d.id, ...d.data() } as CabangItem)));
      } catch (error) {
        console.error("Error fetching cabang:", error);
      }
    };
    fetchCabang();
  }, []);

  // Ambil kelas sesuai cabang
  useEffect(() => {
    const fetchKelas = async () => {
      setKelasList([]);
      if (!formData.cabang) return;
      try {
        const snap = await getDocs(
          query(collection(db, "kelas"), where("cabang", "==", formData.cabang))
        );
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as KelasItem));
        items.sort((a, b) => (a.namaKelas || "").localeCompare(b.namaKelas || ""));
        setKelasList(items);
      } catch (error) {
        console.error("Error fetching kelas:", error);
      }
    };
    fetchKelas();
  }, [formData.cabang]);

  // Ambil siswa sesuai cabang + kelas
  useEffect(() => {
    const fetchSiswa = async () => {
      setSiswaList([]);
      if (!formData.cabang || !formData.kelas) return;
      setLoadingSiswa(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, "siswa"),
            where("cabang", "==", formData.cabang),
            where("kelas", "==", formData.kelas)
          )
        );
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as SiswaItem));
        items.sort((a, b) => (a.nama || "").localeCompare(b.nama || ""));
        setSiswaList(items);
      } catch (error) {
        console.error("Error fetching siswa:", error);
      } finally {
        setLoadingSiswa(false);
      }
    };
    fetchSiswa();
  }, [formData.cabang, formData.kelas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.siswaId) {
      alert("Silakan pilih siswa terlebih dahulu.");
      return;
    }
    setSubmitting(true);
    try {
      const siswa = siswaList.find((s) => s.id === formData.siswaId);
      await addDoc(collection(db, "overtime"), {
        tanggal: formData.tanggal,
        nama: siswa?.nama || "",
        siswaId: formData.siswaId,
        nisn: siswa?.nisn || "",
        cabang: formData.cabang,
        kelas: formData.kelas,
        jenis: formData.jenis,
        waktu: formData.waktu,
        nominal: Number(formData.nominal) || 0,
        dicatatOleh: userData?.nama || user?.email || "",
        userId: user?.uid || "",
        createdAt: Timestamp.now(),
      });
      alert("Data overtime berhasil disimpan!");
      onSaved?.();
      onClose();
    } catch (error) {
      console.error("Error menyimpan overtime:", error);
      alert("Gagal menyimpan data overtime.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
          <h3 className="font-bold text-gray-800">Tambah Overtime</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal</label>
            <input
              required
              type="date"
              className="w-full border rounded-lg p-2 text-sm text-gray-900"
              value={formData.tanggal}
              onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cabang</label>
            <select
              required
              disabled={!!lockedCabang}
              className={`w-full border rounded-lg p-2 text-sm text-gray-900 ${lockedCabang ? "bg-gray-100 text-gray-600" : "bg-white"
                }`}
              value={formData.cabang}
              onChange={(e) =>
                setFormData({ ...formData, cabang: e.target.value, kelas: "", siswaId: "" })
              }
            >
              <option value="">Pilih Cabang</option>
              {cabangList.map((c) => (
                <option key={c.id} value={c.nama}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Kelas</label>
            <select
              required
              disabled={!formData.cabang}
              className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900 disabled:bg-gray-100"
              value={formData.kelas}
              onChange={(e) => setFormData({ ...formData, kelas: e.target.value, siswaId: "" })}
            >
              <option value="">Pilih Kelas</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.namaKelas}>
                  {k.namaKelas}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Siswa</label>
            <select
              required
              disabled={!formData.kelas || loadingSiswa}
              className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900 disabled:bg-gray-100"
              value={formData.siswaId}
              onChange={(e) => setFormData({ ...formData, siswaId: e.target.value })}
            >
              <option value="">
                {loadingSiswa
                  ? "Memuat siswa..."
                  : formData.kelas
                    ? siswaList.length === 0
                      ? "Tidak ada siswa di kelas ini"
                      : "Pilih Siswa"
                    : "Pilih kelas terlebih dahulu"}
              </option>
              {siswaList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                  {s.nisn ? ` (${s.nisn})` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Jenis</label>
              <select
                required
                className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900"
                value={formData.jenis}
                onChange={(e) => setFormData({ ...formData, jenis: e.target.value })}
              >
                <option value="">Pilih Jenis</option>
                {JENIS_OVERTIME.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Waktu</label>
              <input
                required
                type="time"
                className="w-full border rounded-lg p-2 text-sm text-gray-900"
                value={formData.waktu}
                onChange={(e) => setFormData({ ...formData, waktu: e.target.value })}
              />
              <p className="text-[10px] text-gray-400 mt-1">Contoh: 11:25</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nominal (Rp)</label>
            <input
              required
              type="text"
              inputMode="numeric"
              className="w-full border rounded-lg p-2 text-sm text-gray-900"
              placeholder="0"
              value={formData.nominal === 0 ? "" : formData.nominal.toLocaleString("id-ID")}
              onChange={(e) => {
                const raw = e.target.value.replace(/\./g, "").replace(/[^0-9]/g, "");
                setFormData({ ...formData, nominal: raw === "" ? 0 : Number(raw) });
              }}
            />
          </div>

          <button
            disabled={submitting}
            type="submit"
            className="w-full bg-[#581c87] text-white py-3 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 disabled:opacity-50"
          >
            {submitting ? "Menyimpan..." : "Simpan Overtime"}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function OvertimeView({
  user,
  userData,
  onBack,
}: {
  user: AuthUser;
  userData: AppUserData;
  onBack: () => void;
}) {
  const [overtimeList, setOvertimeList] = useState<OvertimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const canAccess = ["Admin", "Direktur", "Yayasan", "Kepala Sekolah", "Guru", "Asisten Guru", "Caregiver"].includes(
    userData?.role || ""
  );

  // Filter cabang untuk role tertentu
  const cabangFilter =
    ["Kepala Sekolah", "Guru", "Asisten Guru", "Caregiver"].includes(userData?.role || "") && userData?.cabang
      ? userData.cabang
      : "";

  useEffect(() => {
    if (!canAccess) return;
    const q = cabangFilter
      ? query(collection(db, "overtime"), where("cabang", "==", cabangFilter))
      : query(collection(db, "overtime"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as OvertimeEntry));
        items.sort((a, b) => {
          const dateA = `${a.tanggal || ""} ${a.waktu || ""}`;
          const dateB = `${b.tanggal || ""} ${b.waktu || ""}`;
          return dateB.localeCompare(dateA);
        });
        setOvertimeList(items);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching overtime:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [canAccess, cabangFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus data overtime ini?")) return;
    try {
      await deleteDoc(doc(db, "overtime", id));
    } catch (error) {
      console.error("Error menghapus overtime:", error);
      alert("Gagal menghapus data overtime.");
    }
  };

  const totalNominal = overtimeList.reduce((sum, item) => sum + (item.nominal || 0), 0);

  return (
    <div className="flex-1 bg-gray-50 min-h-screen flex flex-col">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-800 flex-1">Overtime</h1>
        {canAccess && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 bg-[#581c87] text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-[#45156b] transition"
          >
            <Plus className="w-4 h-4" /> Tambah
          </button>
        )}
      </header>

      <div className="p-4 space-y-4">
        {!canAccess ? (
          <div className="text-center py-10 text-gray-500 text-sm">
            Anda tidak memiliki akses untuk mencatat overtime.
          </div>
        ) : loading ? (
          <div className="text-center py-10 text-gray-500">Memuat data overtime...</div>
        ) : overtimeList.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            <Timer className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            Belum ada data overtime. Klik tombol Tambah untuk mencatat.
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500">Total Overtime</p>
                <p className="text-lg font-bold text-[#581c87]">
                  Rp {totalNominal.toLocaleString("id-ID")}
                </p>
              </div>
              <span className="text-xs font-semibold bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                {overtimeList.length} entri
              </span>
            </div>

            <div className="space-y-3">
              {overtimeList.map((item) => (
                <div key={item.id} className="bg-white rounded-xl shadow-sm p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-gray-800 truncate">{item.nama}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.cabang} • Kelas {item.kelas}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="font-medium">{formatTanggal(item.tanggal)}</span>
                      <span className="text-gray-300">|</span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                        {item.jenis}
                      </span>
                      <span>{item.waktu}</span>
                    </div>
                    <span className="text-sm font-bold text-[#581c87]">
                      Rp {(item.nominal || 0).toLocaleString("id-ID")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {isModalOpen && (
        <OvertimeModal
          user={user}
          userData={userData}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}
