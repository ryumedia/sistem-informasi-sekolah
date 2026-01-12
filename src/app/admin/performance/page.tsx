// src/app/admin/performance/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Plus, X, Pencil, Trash2, Search, ListChecks } from "lucide-react";

interface KeyResult {
  id: string;
  nama: string;
  targetWaktu: string;
  indikator: string;
  keberhasilan: number; // 0-100
}

interface KPI {
  id: string;
  guruId: string;
  namaGuru: string;
  cabang: string;
  objective: string;
  periodeId: string;
  namaPeriode: string;
  keyResults?: KeyResult[];
  persentase?: number;
}

interface Guru {
  id: string;
  nama: string;
  cabang: string;
  role?: string;
}

interface PeriodeKPI {
  id: string;
  namaPeriode: string;
}

export default function PerformancePage() {
  const [kpiList, setKpiList] = useState<KPI[]>([]);
  const [guruList, setGuruList] = useState<Guru[]>([]);
  const [periodeList, setPeriodeList] = useState<PeriodeKPI[]>([]);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [currentUserData, setCurrentUserData] = useState<any>(null);

  // State for KR Modal
  const [isKrModalOpen, setIsKrModalOpen] = useState(false);
  const [selectedObjective, setSelectedObjective] = useState<KPI | null>(null);
  const [currentKrs, setCurrentKrs] = useState<KeyResult[]>([]);
  const [newKr, setNewKr] = useState({ nama: "", targetWaktu: "", indikator: "", keberhasilan: 0 });

  // Filters
  const [filterCabang, setFilterCabang] = useState("");
  const [filterPeriode, setFilterPeriode] = useState("");
  const [searchGuru, setSearchGuru] = useState("");

  // Form Data
  const [formData, setFormData] = useState({
    guruId: "",
    namaGuru: "",
    cabang: "",
    objective: "",
    periodeId: "",
    namaPeriode: "",
  });

  // Get current user role and branch
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const q = query(collection(db, "guru"), where("email", "==", currentUser.email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          const docData = snapshot.docs[0].data();
          const docId = snapshot.docs[0].id;
          setCurrentUserData({ id: docId, uid: currentUser.uid, ...docData });
        } else {
          // Fallback for manually created admin or other roles not in 'guru'
          setCurrentUserData({ role: 'Admin' }); // Assume Admin if not found
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch KPI
      const qKpi = query(collection(db, "kpi_guru"), orderBy("createdAt", "desc"));
      const kpiSnap = await getDocs(qKpi);
      const kpiData = kpiSnap.docs.map(doc => {
        const data = doc.data();
        const keyResults: KeyResult[] = data.keyResults || [];
        let persentase = 0;
        if (keyResults.length > 0) {
            const totalKeberhasilan = keyResults.reduce((sum, kr) => sum + (Number(kr.keberhasilan) || 0), 0);
            persentase = totalKeberhasilan / keyResults.length;
        }
        return {
          id: doc.id,
          ...data,
          objective: data.objective || data.indikator || "",
          keyResults: keyResults,
          persentase: persentase
        }
      }) as KPI[];
      setKpiList(kpiData);

      // Fetch Guru
      const qGuru = query(collection(db, "guru"), orderBy("nama", "asc"));
      const guruSnap = await getDocs(qGuru);
      const guruData = guruSnap.docs.map(doc => ({ 
        id: doc.id, 
        nama: doc.data().nama,
        cabang: doc.data().cabang || "",
        role: doc.data().role
      })) as Guru[];
      setGuruList(guruData);

      // Fetch Cabang
      const qCabang = query(collection(db, "cabang"), orderBy("nama", "asc"));
      const cabangSnap = await getDocs(qCabang);
      const cabangData = cabangSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCabangList(cabangData);

      // Fetch Periode
      const qPeriode = query(collection(db, "kpi_periode"), orderBy("namaPeriode", "asc"));
      const periodeSnap = await getDocs(qPeriode);
      const periodeData = periodeSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as PeriodeKPI[];
      setPeriodeList(periodeData);

    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
      };

      if (editId) {
        await updateDoc(doc(db, "kpi_guru", editId), payload);
        alert("KPI berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "kpi_guru"), {
          ...payload,
          createdAt: new Date(),
        });
        alert("KPI berhasil ditambahkan!");
      }
      closeModal();
      fetchData();
    } catch (error) {
      console.error("Error saving KPI:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus KPI ini?")) {
      try {
        await deleteDoc(doc(db, "kpi_guru", id));
        alert("KPI berhasil dihapus.");
        fetchData();
      } catch (error) {
        console.error("Error deleting:", error);
        alert("Gagal menghapus data.");
      }
    }
  };

  // Handle Edit
  const handleEdit = (item: KPI) => {
    setEditId(item.id);
    setFormData({
      guruId: item.guruId,
      namaGuru: item.namaGuru,
      cabang: item.cabang,
      objective: item.objective,
      periodeId: item.periodeId || "",
      namaPeriode: item.namaPeriode || "",
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditId(null);
    setFormData({ guruId: "", namaGuru: "", cabang: "", objective: "", periodeId: "", namaPeriode: "" });
  };

  // Handle Guru Selection in Form
  const handleGuruChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedGuruId = e.target.value;
    const selectedGuru = guruList.find(g => g.id === selectedGuruId);
    if (selectedGuru) {
      setFormData({
        ...formData,
        guruId: selectedGuru.id,
        namaGuru: selectedGuru.nama,
        cabang: selectedGuru.cabang
      });
    } else {
      setFormData({ ...formData, guruId: "", namaGuru: "", cabang: "" });
    }
  };

  // Handle Periode Selection in Form
  const handlePeriodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedPeriode = periodeList.find(p => p.id === selectedId);
    if (selectedPeriode) {
      setFormData({ ...formData, periodeId: selectedId, namaPeriode: selectedPeriode.namaPeriode });
    } else {
      setFormData({ ...formData, periodeId: "", namaPeriode: "" });
    }
  };

  // --- KR MODAL FUNCTIONS ---
  const openKrModal = (objective: KPI) => {
    setSelectedObjective(objective);
    setCurrentKrs(objective.keyResults || []);
    setIsKrModalOpen(true);
  };

  const closeKrModal = () => {
    setIsKrModalOpen(false);
    setSelectedObjective(null);
    setCurrentKrs([]);
    setNewKr({ nama: "", targetWaktu: "", indikator: "", keberhasilan: 0 });
  };

  const addCurrentKr = () => {
    if (!newKr.nama || !newKr.targetWaktu || !newKr.indikator) {
      alert("Harap isi semua field Key Result.");
      return;
    }
    setCurrentKrs([...currentKrs, { ...newKr, id: Date.now().toString() }]);
    setNewKr({ nama: "", targetWaktu: "", indikator: "", keberhasilan: 0 }); // Reset form
  };

  const removeCurrentKr = (index: number) => {
    const updatedKrs = [...currentKrs];
    updatedKrs.splice(index, 1);
    setCurrentKrs(updatedKrs);
  };

  const updateCurrentKrKeberhasilan = (index: number, value: number) => {
    const updatedKrs = [...currentKrs];
    const clampedValue = Math.max(0, Math.min(100, isNaN(value) ? 0 : value));
    updatedKrs[index].keberhasilan = clampedValue;
    setCurrentKrs(updatedKrs);
  };

  const handleSaveKrs = async () => {
    if (!selectedObjective) return;
    setSubmitting(true);
    try {
      let persentase = 0;
      if (currentKrs.length > 0) {
        const total = currentKrs.reduce((sum, kr) => sum + (Number(kr.keberhasilan) || 0), 0);
        persentase = total / currentKrs.length;
      }
      await updateDoc(doc(db, "kpi_guru", selectedObjective.id), {
        keyResults: currentKrs,
        persentase: persentase
      });
      alert("Key Results berhasil disimpan!");
      closeKrModal();
      fetchData();
    } catch (error) {
      console.error("Error saving Key Results:", error);
      alert("Gagal menyimpan Key Results.");
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Logic
  const filteredKpi = kpiList.filter(item => {
    if (!currentUserData) return false;

    // Universal filter that applies to everyone
    const matchPeriode = filterPeriode ? item.periodeId === filterPeriode : true;

    // Role-based data visibility and other filters
    if (currentUserData.role === 'Guru') {
      const matchGuruId = item.guruId === currentUserData.id;
      return matchPeriode && matchGuruId; // Combine universal and specific filter
    }

    if (currentUserData.role === 'Kepala Sekolah') {
      // KS sees only their branch + can search within it
      const matchMyCabang = item.cabang === currentUserData.cabang;
      const matchSearch = searchGuru ? item.namaGuru.toLowerCase().includes(searchGuru.toLowerCase()) : true;
      return matchPeriode && matchMyCabang && matchSearch; // Combine all
    }

    // For Admin, Direktur, Yayasan
    const matchCabang = filterCabang ? item.cabang === filterCabang : true;
    const matchGuru = searchGuru ? item.namaGuru.toLowerCase().includes(searchGuru.toLowerCase()) : true;
    return matchPeriode && matchCabang && matchGuru; // Combine all
  });

  const openTambahModal = () => {
    if (currentUserData?.role === 'Guru') handleGuruChange({ target: { value: currentUserData.id } } as any);
    setIsModalOpen(true);
  }

  // Calculate Average Score & Label
  const totalScore = filteredKpi.reduce((acc, item) => {
    return acc + (item.persentase || 0);
  }, 0);
  
  const averageScore = filteredKpi.length > 0 ? totalScore / filteredKpi.length : 0;

  let scoreLabel = "";
  let scoreColor = "";
  
  if (averageScore >= 100) {
    scoreLabel = "Perfect"; scoreColor = "bg-purple-100 text-purple-700 border-purple-200";
  } else if (averageScore >= 86) {
    scoreLabel = "Excellent"; scoreColor = "bg-green-100 text-green-700 border-green-200";
  } else if (averageScore >= 71) {
    scoreLabel = "Good"; scoreColor = "bg-blue-100 text-blue-700 border-blue-200";
  } else if (averageScore >= 51) {
    scoreLabel = "Average"; scoreColor = "bg-yellow-100 text-yellow-700 border-yellow-200";
  } else {
    scoreLabel = "Poor"; scoreColor = "bg-red-100 text-red-700 border-red-200";
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Performance Guru (KPI)</h1>
        <button
          onClick={openTambahModal}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Objective
        </button>
      </div>

      {/* Card Nilai Akhir Performance */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-gray-500 text-sm font-medium">Nilai Akhir Performance</h2>
          <p className="text-xs text-gray-400 mt-1">Rata-rata dari {filteredKpi.length} indikator KPI yang ditampilkan</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-800">{averageScore.toFixed(1)}%</div>
          </div>
          <div className={`px-4 py-2 rounded-lg border font-bold text-sm ${scoreColor}`}>
            {scoreLabel}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <select
          className="border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
          value={filterPeriode}
          onChange={(e) => setFilterPeriode(e.target.value)}
        >
          <option value="">Semua Periode</option>
          {periodeList.map((p) => <option key={p.id} value={p.id}>{p.namaPeriode}</option>)}
        </select>

        {currentUserData && !['Guru'].includes(currentUserData.role) && (
          <>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Cari Nama Guru..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
              value={searchGuru}
              onChange={(e) => setSearchGuru(e.target.value)}
            />
          </div>
            {['Admin', 'Direktur', 'Yayasan'].includes(currentUserData.role) && (
              <select
                className="border rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                value={filterCabang}
                onChange={(e) => setFilterCabang(e.target.value)}
              >
                <option value="">Semua Cabang</option>
                {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
              </select>
            )}
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[900px]">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4 w-16">No</th>
              <th className="p-4">Nama Guru</th>
              <th className="p-4">Periode</th>
              <th className="p-4">Objective</th>
              <th className="p-4">Persentase</th>
              <th className="p-4">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="p-8 text-center">Memuat data...</td></tr>
            ) : filteredKpi.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center">Data tidak ditemukan.</td></tr>
            ) : (
              filteredKpi.map((item, index) => {
                return (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">
                      {item.namaGuru}
                      <div className="text-xs text-gray-400">{item.cabang}</div>
                    </td>
                    <td className="p-4 text-gray-600 text-xs">{item.namaPeriode}</td>
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{item.objective}</div>
                        {item.keyResults && item.keyResults.length > 0 && (
                          <div className="mt-2 space-y-1 text-xs text-gray-500">
                            {item.keyResults.map((kr) => (
                            <div key={kr.id} className="flex justify-between items-center border-b border-gray-100 pb-1 last:border-0">
                                <span>• {kr.nama}</span>
                                <span className={`font-mono px-1.5 py-0.5 rounded text-[10px] ${kr.keberhasilan >= 85 ? 'bg-green-100 text-green-700' : kr.keberhasilan >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                                {kr.keberhasilan}%
                                </span>
                            </div>
                            ))}
                          </div>
                        )}
                    </td>
                    <td className={`p-4 font-bold text-lg ${
                      (item.persentase || 0) >= 85 ? 'text-green-600' :
                      (item.persentase || 0) >= 50 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {item.persentase !== undefined ? `${item.persentase.toFixed(1)}%` : 'N/A'}
                    </td>
                    <td className="p-4 flex gap-2">
                      <button onClick={() => openKrModal(item)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Kelola Key Results">
                        <ListChecks className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEdit(item)} className="p-2 text-[#581c87] hover:bg-[#581c87]/10 rounded-lg transition" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Modal Add/Edit Objective */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editId ? "Edit Objective" : "Tambah Objective"}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Periode KPI</label>
                <select required className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={formData.periodeId} onChange={handlePeriodeChange}>
                  <option value="">Pilih Periode</option>
                  {periodeList.map((p) => (
                    <option key={p.id} value={p.id}>{p.namaPeriode}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Guru</label>
                <select 
                  required 
                  className="w-full border rounded-lg p-2 bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={formData.guruId} 
                  onChange={handleGuruChange}
                  disabled={!!editId || currentUserData?.role === 'Guru'} // Disable changing guru on edit or if user is a Guru
                >
                  <option value="">Pilih Guru</option>
                  {guruList
                    .filter(g => {
                      if (currentUserData?.role === 'Kepala Sekolah') {
                        return g.cabang === currentUserData.cabang;
                      }
                      if (currentUserData?.role === 'Guru') {
                        return g.id === currentUserData.id;
                      }
                      return true; // Admin, Direktur, Yayasan see all
                    })
                    .map((g) => (
                      <option key={g.id} value={g.id}>{g.nama} - {g.cabang}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Objective</label>
                <input 
                  required 
                  type="text" 
                  placeholder="Contoh: Meningkatkan kedisiplinan siswa"
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900"
                  value={formData.objective} 
                  onChange={(e) => setFormData({...formData, objective: e.target.value})} 
                />
              </div>

              <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2">
                {submitting ? "Menyimpan..." : "Simpan Data"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Key Results */}
      {isKrModalOpen && selectedObjective && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-800">Kelola Key Results</h3>
                <p className="text-xs text-gray-500">Objective: {selectedObjective.objective}</p>
              </div>
              <button onClick={closeKrModal} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Form Tambah KR */}
              <div className="bg-gray-50 p-4 rounded-lg border space-y-3">
                <h4 className="font-semibold text-gray-700 text-sm">Tambah Key Result Baru</h4>
                <div>
                  <input type="text" placeholder="Key Result (cth: Menyusun laporan bulanan tepat waktu)" value={newKr.nama} onChange={(e) => setNewKr({...newKr, nama: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#581c87] outline-none" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input type="text" placeholder="Target Waktu (cth: Setiap Akhir Bulan)" value={newKr.targetWaktu} onChange={(e) => setNewKr({...newKr, targetWaktu: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#581c87] outline-none" />
                  <input type="text" placeholder="Indikator Keberhasilan (cth: Laporan dikirim maks H+1)" value={newKr.indikator} onChange={(e) => setNewKr({...newKr, indikator: e.target.value})} className="w-full border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#581c87] outline-none" />
                </div>
                <button onClick={addCurrentKr} className="bg-purple-200 text-[#581c87] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-300 transition w-full">
                  <Plus className="w-4 h-4 inline-block mr-1" /> Tambahkan ke Daftar
                </button>
              </div>

              {/* Tabel KR */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-100 text-gray-800 font-semibold">
                    <tr>
                      <th className="p-3 w-10">No</th>
                      <th className="p-3">Key Result</th>
                      <th className="p-3">Target Waktu</th>
                      <th className="p-3">Indikator</th>
                      <th className="p-3">Keberhasilan</th>
                      <th className="p-3 w-16">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentKrs.length === 0 ? (
                      <tr><td colSpan={6} className="p-6 text-center italic text-gray-500">Belum ada Key Results.</td></tr>
                    ) : (
                      currentKrs.map((kr, index) => (
                        <tr key={kr.id} className="hover:bg-gray-50">
                          <td className="p-3 text-center">{index + 1}</td>
                          <td className="p-3 font-medium">{kr.nama}</td>
                          <td className="p-3 text-xs">{kr.targetWaktu}</td>
                          <td className="p-3">{kr.indikator}</td>
                          <td className="p-3">
                            <div className="relative">
                              <input 
                                type="number" 
                                min="0" 
                                max="100" 
                                value={kr.keberhasilan} 
                                onChange={(e) => updateCurrentKrKeberhasilan(index, Number(e.target.value))}
                                className="w-24 border rounded-lg p-2 text-sm focus:ring-1 focus:ring-[#581c87] outline-none pr-6"
                              />
                              <span className="absolute right-2 top-2.5 text-gray-400 text-sm">%</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button onClick={() => removeCurrentKr(index)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
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

            <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
              <button onClick={closeKrModal} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-100 transition text-sm font-medium">Batal</button>
              <button onClick={handleSaveKrs} disabled={submitting} className="bg-[#581c87] text-white px-4 py-2 rounded-lg hover:bg-[#45156b] transition text-sm font-medium">
                {submitting ? "Menyimpan..." : "Simpan Perubahan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
