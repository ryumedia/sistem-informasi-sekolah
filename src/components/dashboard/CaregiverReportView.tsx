// src/components/dashboard/CaregiverReportView.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { Loader2, User, ArrowRight, ArrowLeft, Calendar, BookOpen, Plus, Pencil, Trash2, X, Baby, Ruler, Scaling } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

// --- Tipe Data ---
interface Aktivitas {
  id: string;
  nama: string;
  urutan: number;
  subAktivitas: SubAktivitas[];
}
interface SubAktivitas {
  id: string;
  deskripsi: string;
  opsiJawaban: string[];
  urutan: number;
}
interface LaporanHarian {
  id: string;
  tanggal: Timestamp;
  cabangId: string;
  kelasId: string;
  siswaId: string;
  hasil: { [key: string]: string[] };
}

interface GrowthData {
  id: string;
  tanggal: string | Timestamp; // Can be string from form or Timestamp from DB
  cabang: string;
  kelas: string;
  siswaId: string;
  lingkarKepala: number;
  tinggiBadan: number;
  beratBadan: number;
}

const formatDateForInput = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

// --- Komponen Modal Laporan Harian ---
function LaporanHarianModal({
  onClose,
  onSaveSuccess,
  student,
  laporanToEdit,
  aktivitasChecklist,
  selectedDate
}: {
  onClose: () => void;
  onSaveSuccess: () => void;
  student: any;
  laporanToEdit: LaporanHarian | null;
  aktivitasChecklist: Aktivitas[];
  selectedDate: Date;
}) {
  const [formData, setFormData] = useState<any>({ hasil: {} });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (laporanToEdit) {
      setFormData({
        ...laporanToEdit,
        tanggal: laporanToEdit.tanggal.toDate(),
      });
    } else {
      setFormData({
        tanggal: selectedDate,
        cabangId: student.cabangId || "", // Pastikan ada ID cabang di data siswa
        kelasId: student.kelasId || "",   // Pastikan ada ID kelas di data siswa
        siswaId: student.id,
        hasil: {},
      });
    }
  }, [laporanToEdit, student, selectedDate]);

  const handleCheckboxChange = (subAktivitasId: string, option: string, isChecked: boolean) => {
    setFormData((prev: any) => {
      const currentOptions = prev.hasil[subAktivitasId] || [];
      const newOptions = isChecked ? [...currentOptions, option] : currentOptions.filter((o: string) => o !== option);
      return { ...prev, hasil: { ...prev.hasil, [subAktivitasId]: newOptions } };
    });
  };

  const handleLainnyaTextChange = (subAktivitasId: string, text: string) => {
    setFormData((prev: any) => {
      const currentOptions = prev.hasil[subAktivitasId] || [];
      const filteredOptions = currentOptions.filter((o: string) => !o.startsWith("Lainnya:"));
      const newOptions = text ? [...filteredOptions, `Lainnya: ${text}`] : filteredOptions;
      return { ...prev, hasil: { ...prev.hasil, [subAktivitasId]: newOptions } };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const dataToSave = {
      ...formData,
      tanggal: Timestamp.fromDate(formData.tanggal),
    };

    try {
      if (laporanToEdit) {
        await updateDoc(doc(db, "daycare_laporan_harian", laporanToEdit.id), dataToSave);
        alert("Laporan berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "daycare_laporan_harian"), dataToSave);
        alert("Laporan berhasil ditambahkan!");
      }
      onSaveSuccess();
    } catch (error) {
      console.error("Error saving report:", error);
      alert("Gagal menyimpan laporan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col h-[90vh]">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">{laporanToEdit ? 'Edit' : 'Tambah'} Laporan Harian</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-6">
            {aktivitasChecklist.map(aktivitas => (
              <div key={aktivitas.id} className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-bold text-lg text-gray-800 mb-3">{aktivitas.nama}</h4>
                <div className="space-y-4">
                  {aktivitas.subAktivitas.map(sub => {
                    const lainnyaChecked = formData.hasil[sub.id]?.includes('Lainnya');
                    const lainnyaText = formData.hasil[sub.id]?.find((o: string) => o.startsWith('Lainnya:'))?.substring(8) || '';
                    return (
                      <div key={sub.id}>
                        <p className="font-semibold text-gray-700 mb-2">{sub.deskripsi}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {sub.opsiJawaban.map(opsi => (
                            <div key={opsi} className="flex items-start">
                              <input type="checkbox" id={`${sub.id}-${opsi}`} checked={formData.hasil[sub.id]?.includes(opsi) || false} onChange={e => handleCheckboxChange(sub.id, opsi, e.target.checked)} className="mt-1 h-4 w-4 text-[#581c87] focus:ring-[#581c87] border-gray-300 rounded" />
                              <label htmlFor={`${sub.id}-${opsi}`} className="ml-2 text-sm text-gray-700">{opsi}</label>
                            </div>
                          ))}
                        </div>
                        {lainnyaChecked && (
                          <div className="mt-2">
                            <input type="text" value={lainnyaText} onChange={e => handleLainnyaTextChange(sub.id, e.target.value)} placeholder="Tuliskan keterangan lain..." className="w-full border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 bg-gray-50 -m-6 mt-6 border-t flex justify-end sticky bottom-0">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isSubmitting} className="ml-3 bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50">
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Komponen Modal Pertumbuhan Anak ---
function GrowthDataModal({
  onClose,
  onSaveSuccess,
  student,
  dataToEdit,
}: {
  onClose: () => void;
  onSaveSuccess: () => void;
  student: any;
  dataToEdit: GrowthData | null;
}) {
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    lingkarKepala: '',
    tinggiBadan: '',
    beratBadan: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (dataToEdit) {
      let date;
      if (dataToEdit.tanggal instanceof Timestamp) {
        date = dataToEdit.tanggal.toDate().toISOString().split('T')[0];
      } else {
        date = dataToEdit.tanggal as string;
      }
      setFormData({
        tanggal: date,
        lingkarKepala: String(dataToEdit.lingkarKepala),
        tinggiBadan: String(dataToEdit.tinggiBadan),
        beratBadan: String(dataToEdit.beratBadan),
      });
    }
  }, [dataToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const dataToSave = {
      tanggal: formData.tanggal,
      cabang: student.cabang,
      kelas: student.kelasDaycare || student.kelas,
      siswaId: student.id,
      lingkarKepala: parseFloat(formData.lingkarKepala) || 0,
      tinggiBadan: parseFloat(formData.tinggiBadan) || 0,
      beratBadan: parseFloat(formData.beratBadan) || 0,
    };

    try {
      if (dataToEdit) {
        await updateDoc(doc(db, "pertumbuhan_anak", dataToEdit.id), dataToSave);
        alert("Data pertumbuhan berhasil diperbarui!");
      } else {
        await addDoc(collection(db, "pertumbuhan_anak"), { ...dataToSave, createdAt: new Date() });
        alert("Data pertumbuhan berhasil ditambahkan!");
      }
      onSaveSuccess();
    } catch (error) {
      console.error("Error saving growth data:", error);
      alert("Gagal menyimpan data.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">{dataToEdit ? 'Edit' : 'Tambah'} Data Pertumbuhan</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
            <input required type="date" value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Lingkar Kepala (cm)</label>
            <input type="number" step="0.1" value={formData.lingkarKepala} onChange={(e) => setFormData({...formData, lingkarKepala: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tinggi Badan (cm)</label>
            <input type="number" step="0.1" value={formData.tinggiBadan} onChange={(e) => setFormData({...formData, tinggiBadan: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Berat Badan (kg)</label>
            <input type="number" step="0.1" value={formData.beratBadan} onChange={(e) => setFormData({...formData, beratBadan: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-gray-900" />
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isSubmitting} className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50">
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Komponen Tab Laporan Bulanan ---
function MonthlyReportTab({ student }: { student: any }) {
  const [growthList, setGrowthList] = useState<GrowthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dataToEdit, setDataToEdit] = useState<GrowthData | null>(null);
  const [triggerFetch, setTriggerFetch] = useState(0);

  useEffect(() => {
    const fetchGrowthData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "pertumbuhan_anak"), where("siswaId", "==", student.id), orderBy("tanggal", "desc"));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GrowthData));
        setGrowthList(list);
      } catch (err) {
        console.error("Error fetching growth data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchGrowthData();
  }, [student.id, triggerFetch]);

  const handleSaveSuccess = () => {
    setIsModalOpen(false);
    setDataToEdit(null);
    setTriggerFetch(prev => prev + 1); // Trigger re-fetch
  };

  const handleDelete = async (id: string) => {
    if (confirm("Yakin ingin menghapus data pertumbuhan ini?")) {
      try {
        await deleteDoc(doc(db, "pertumbuhan_anak", id));
        alert("Data berhasil dihapus.");
        setTriggerFetch(prev => prev + 1); // Trigger re-fetch
      } catch (err) {
        console.error("Error deleting growth data:", err);
        alert("Gagal menghapus data.");
      }
    }
  };
  
  const openAddModal = () => {
    setDataToEdit(null);
    setIsModalOpen(true);
  };

  const openEditModal = (data: GrowthData) => {
    setDataToEdit(data);
    setIsModalOpen(true);
  };

  const formatMonthYear = (date: string | Timestamp) => {
    const d = date instanceof Timestamp ? date.toDate() : new Date(date);
    return format(d, 'MMMM yyyy', { locale: localeId });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm flex items-center justify-between">
        <h3 className="font-medium text-gray-800">Riwayat Pertumbuhan Anak</h3>
        <button onClick={openAddModal} className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition text-sm">
          <Plus className="w-4 h-4" /> Tambah Data
        </button>
      </div>

      {loading ? <div className="text-center p-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
        : growthList.length === 0 ? <div className="text-center p-10 text-gray-500 bg-white rounded-lg shadow-sm">Belum ada data pertumbuhan.</div>
        : (
          <div className="space-y-4">
            {growthList.map(record => (
              <div key={record.id} className="bg-white p-5 rounded-lg shadow-sm">
                <div className="flex justify-between items-start mb-3 border-b pb-2">
                  <div>
                    <h3 className="font-bold text-lg text-purple-700">{formatMonthYear(record.tanggal)}</h3>
                    <p className="text-xs text-gray-500">Tanggal: {record.tanggal instanceof Timestamp ? format(record.tanggal.toDate(), 'dd-MM-yyyy') : record.tanggal}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleDelete(record.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    <button onClick={() => openEditModal(record)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Pencil className="w-4 h-4" /></button>
                  </div>
                </div>
                <ul className="space-y-3">
                  <li className="flex items-center justify-between text-sm"><span className="flex items-center text-gray-600"><Baby className="w-4 h-4 mr-2 text-gray-400"/>Lingkar Kepala</span><span className="font-bold text-gray-800">{record.lingkarKepala} cm</span></li>
                  <li className="flex items-center justify-between text-sm"><span className="flex items-center text-gray-600"><Ruler className="w-4 h-4 mr-2 text-gray-400"/>Tinggi Badan</span><span className="font-bold text-gray-800">{record.tinggiBadan} cm</span></li>
                  <li className="flex items-center justify-between text-sm"><span className="flex items-center text-gray-600"><Scaling className="w-4 h-4 mr-2 text-gray-400"/>Berat Badan</span><span className="font-bold text-gray-800">{record.beratBadan} kg</span></li>
                </ul>
              </div>
            ))}
          </div>
        )}
      
      {isModalOpen && (
        <GrowthDataModal
          onClose={() => setIsModalOpen(false)}
          onSaveSuccess={handleSaveSuccess}
          student={student}
          dataToEdit={dataToEdit}
        />
      )}
    </div>
  );
}

// --- Komponen Utama ---
export default function CaregiverReportView({ userData, onBack }: { user: any, userData: any, onBack: () => void }) {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [triggerFetch, setTriggerFetch] = useState(0);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        // Ambil kelas yang diampu oleh Caregiver
        const kelasQuery = query(collection(db, "kelas"), where("guruKelas", "array-contains", userData.nama));
        const kelasSnap = await getDocs(kelasQuery);
        const allowedKelas = kelasSnap.docs.map(doc => doc.data().namaKelas).filter(Boolean);

        if (allowedKelas.length > 0) {
          // 1. Ambil siswa yang kelas regulernya sesuai dengan kelas guru
          const regularQuery = query(
            collection(db, "siswa"),
            where("kelas", "in", allowedKelas)
          );

          // 2. Ambil siswa yang status isDaycare=true DAN kelasDaycare sesuai dengan kelas guru
          const daycareQuery = query(
            collection(db, "siswa"), 
            where("isDaycare", "==", true),
            where("kelasDaycare", "in", allowedKelas)
          );

          const [regularSnap, daycareSnap] = await Promise.all([
            getDocs(regularQuery),
            getDocs(daycareQuery)
          ]);

          // Gabungkan hasil dan hapus duplikat berdasarkan ID
          const studentMap = new Map();
          regularSnap.docs.forEach(doc => studentMap.set(doc.id, { id: doc.id, ...doc.data() }));
          daycareSnap.docs.forEach(doc => studentMap.set(doc.id, { id: doc.id, ...doc.data() }));

          const list = Array.from(studentMap.values());
          list.sort((a: any, b: any) => (a.nama || "").localeCompare(b.nama || ""));
          setStudents(list);
        } else {
          setStudents([]);
        }
      } catch (err) {
        console.error("Error fetching students:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userData) {
        fetchStudents();
    }
  }, [userData, triggerFetch]);

  // Jika siswa dipilih, tampilkan halaman detail laporan siswa
  if (selectedStudent) {
    return (
      <StudentReportDetail
        student={selectedStudent}
        onBack={() => setSelectedStudent(null)} 
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Pilih Siswa</h1>
          <p className="text-xs text-gray-500">Pilih siswa untuk melihat laporan.</p>
        </div>
      </header>

      <div className="p-6">
        {loading ? (
            <div className="flex justify-center items-center p-10">
                <Loader2 className="w-8 h-8 text-[#581c87] animate-spin" />
                <span className="ml-2 text-gray-500">Memuat data siswa...</span>
            </div>
        ) : students.length === 0 ? (
            <div className="text-center p-10 text-gray-500 bg-white rounded-xl shadow-sm">
                Tidak ada siswa Daycare ditemukan.
            </div>
        ) : (
            <div className="space-y-3">
            {students.map(student => (
                <div 
                    key={student.id} 
                    onClick={() => setSelectedStudent(student)}
                    className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-purple-200 transition flex items-center gap-4 group"
                >
                    <div className="w-12 h-12 bg-purple-50 rounded-full flex items-center justify-center text-[#581c87] font-bold overflow-hidden border border-purple-100">
                        {student.foto ? (
                            <img src={student.foto} alt={student.nama} className="w-full h-full object-cover" />
                        ) : (
                            <User className="w-6 h-6" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-800 group-hover:text-[#581c87] transition">{student.nama}</h3>
                        <p className="text-xs text-gray-500 truncate">{student.nisn || "Tanpa NISN"}</p>
                    </div>
                    <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-[#581c87] transition" />
                </div>
            ))}
            </div>
        )}
      </div>
    </div>
  );
}

// --- Komponen Detail Laporan Siswa (dengan Tabs) ---
function StudentReportDetail({ student, onBack }: { student: any, onBack: () => void }) {
  const [activeTab, setActiveTab] = useState("harian");
  const [aktivitasChecklist, setAktivitasChecklist] = useState<Aktivitas[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(true);

  useEffect(() => {
    const fetchChecklist = async () => {
      try {
        const aktivitasSnapshot = await getDocs(query(collection(db, "daycare_aktivitas"), orderBy("urutan", "asc")));
        const aktivitasPromises = aktivitasSnapshot.docs.map(async (docA) => {
          const subAktivitasQuery = query(collection(db, "daycare_sub_aktivitas"), where("aktivitasId", "==", docA.id), orderBy("urutan", "asc"));
          const subAktivitasSnap = await getDocs(subAktivitasQuery);
          const subAktivitas = subAktivitasSnap.docs.map(docS => ({ id: docS.id, ...docS.data() } as SubAktivitas));
          return { id: docA.id, ...docA.data(), subAktivitas } as Aktivitas;
        });
        const checklist = await Promise.all(aktivitasPromises);
        setAktivitasChecklist(checklist);
      } catch (err) {
        console.error("Error fetching checklist:", err);
      } finally {
        setLoadingChecklist(false);
      }
    };
    fetchChecklist();
  }, []);

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-h-screen">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Laporan: {student.nama}</h1>
          <p className="text-xs text-gray-500">Kelas {student.kelasDaycare || student.kelas}</p>
        </div>
      </header>

      <div className="p-6">
        <div className="mb-4 border-b border-gray-200">
          <nav className="flex space-x-4" aria-label="Tabs">
            <button onClick={() => setActiveTab("harian")} className={`flex items-center gap-2 px-3 py-2 font-medium text-sm rounded-t-lg ${activeTab === "harian" ? "border-b-2 border-purple-500 text-purple-600" : "text-gray-500 hover:text-gray-700"}`}>
              <Calendar className="w-4 h-4" /> Laporan Harian
            </button>
            <button onClick={() => setActiveTab("bulanan")} className={`flex items-center gap-2 px-3 py-2 font-medium text-sm rounded-t-lg ${activeTab === "bulanan" ? "border-b-2 border-purple-500 text-purple-600" : "text-gray-500 hover:text-gray-700"}`}>
              <BookOpen className="w-4 h-4" /> Laporan Bulanan
            </button>
          </nav>
        </div>

        <div>
          {loadingChecklist ? <div className="text-center p-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div> : (
            <>
              {activeTab === "harian" && <DailyReportTab student={student} aktivitasChecklist={aktivitasChecklist} />}
              {activeTab === "bulanan" && <MonthlyReportTab student={student} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Komponen Tab Laporan Harian ---
function DailyReportTab({ student, aktivitasChecklist }: { student: any, aktivitasChecklist: Aktivitas[] }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [laporan, setLaporan] = useState<LaporanHarian | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [laporanToEdit, setLaporanToEdit] = useState<LaporanHarian | null>(null);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      try {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const q = query(collection(db, "daycare_laporan_harian"), where("siswaId", "==", student.id), where("tanggal", ">=", startOfDay), where("tanggal", "<=", endOfDay));
        const snap = await getDocs(q);
        setLaporan(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as LaporanHarian);
      } catch (err) {
        console.error("Error fetching daily report:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [student.id, selectedDate]);

  const handleSaveSuccess = () => {
    setIsModalOpen(false);
    setLaporanToEdit(null);
    // Re-fetch by changing selectedDate slightly and back, to trigger useEffect
    const currentDate = new Date(selectedDate);
    setSelectedDate(new Date(0)); // temporary invalid date
    setSelectedDate(currentDate); // set it back
  };

  const handleDelete = async () => {
    if (laporan && confirm("Yakin ingin menghapus laporan ini?")) {
      try {
        await deleteDoc(doc(db, "daycare_laporan_harian", laporan.id));
        alert("Laporan berhasil dihapus.");
        setLaporan(null);
      } catch (err) {
        console.error("Error deleting report:", err);
        alert("Gagal menghapus laporan.");
      }
    }
  };

  const processedData = useMemo(() => {
    if (!laporan || !laporan.hasil) return [];
    const jawabanMap = new Map(Object.entries(laporan.hasil));
    return aktivitasChecklist.map(aktivitas => ({
      ...aktivitas,
      subItems: aktivitas.subAktivitas.map(sub => {
        const jawabanValue = jawabanMap.get(sub.id) || [];
        const finalJawaban = jawabanValue.map(j => j.startsWith("Lainnya:") ? j.substring(8).trim() : j).filter(j => j !== "Lainnya").join(', ') || "-";
        return { ...sub, jawaban: finalJawaban };
      })
    }));
  }, [laporan, aktivitasChecklist]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Tanggal</label>
          <input type="date" value={formatDateForInput(selectedDate)} onChange={(e) => setSelectedDate(new Date(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md shadow-sm" />
        </div>
        {!laporan && !loading && (
          <button onClick={() => { setLaporanToEdit(null); setIsModalOpen(true); }} className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition justify-center">
            <Plus className="w-4 h-4" /> Tambah Laporan
          </button>
        )}
      </div>

      {loading ? <div className="text-center p-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
        : !laporan ? <div className="text-center p-10 text-gray-500 bg-white rounded-lg shadow-sm">Belum ada laporan untuk tanggal ini.</div>
        : (
          <div className="bg-white p-5 rounded-lg shadow-sm space-y-4">
            {processedData.map(aktivitas => (
              <div key={aktivitas.id}>
                <h3 className="font-bold text-lg text-gray-800 border-b pb-2 mb-3">{aktivitas.nama}</h3>
                <ul className="space-y-2">
                  {aktivitas.subItems.map(sub => (
                    <li key={sub.id} className="flex justify-between items-start py-1">
                      <p className="text-sm text-gray-600 flex-1 pr-4">{sub.deskripsi}</p>
                      <p className="font-semibold text-gray-800 text-right text-sm w-2/5 break-words">{sub.jawaban}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="flex justify-end gap-2 border-t pt-4 mt-4">
              <button onClick={handleDelete} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
              <button onClick={() => { setLaporanToEdit(laporan); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Pencil className="w-4 h-4" /></button>
            </div>
          </div>
        )}

      {isModalOpen && (
        <LaporanHarianModal
          onClose={() => setIsModalOpen(false)}
          onSaveSuccess={handleSaveSuccess}
          student={student}
          laporanToEdit={laporanToEdit}
          aktivitasChecklist={aktivitasChecklist}
          selectedDate={selectedDate}
        />
      )}
    </div>
  );
}
