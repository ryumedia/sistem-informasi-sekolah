// src/app/guru/trilogi/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { ArrowLeft, Loader2, Eye, X } from "lucide-react";

export default function GuruTrilogiPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [guruData, setGuruData] = useState<any>(null);
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [namaKelas, setNamaKelas] = useState("");
  const [kelasJenjangMap, setKelasJenjangMap] = useState<Record<string, string>>({});

  // Modal & Data Nilai
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSiswa, setSelectedSiswa] = useState<any>(null);
  const [semesterList, setSemesterList] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [trilogiList, setTrilogiList] = useState<any[]>([]);
  const [nilaiMap, setNilaiMap] = useState<Record<string, number>>({}); 
  const [kriteriaMap, setKriteriaMap] = useState<Record<number, string>>({});
  const [loadingNilai, setLoadingNilai] = useState(false);

  // 1. Auth & Guru Data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      try {
        const qGuru = query(collection(db, "guru"), where("email", "==", currentUser.email));
        const snapshotGuru = await getDocs(qGuru);
        if (!snapshotGuru.empty) {
          setGuruData({ id: snapshotGuru.docs[0].id, ...snapshotGuru.docs[0].data() });
        } else {
          router.push("/");
        }
      } catch (error) {
        console.error("Error fetching guru:", error);
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch Siswa based on Guru's Class
  useEffect(() => {
    if (!guruData) return;
    const fetchSiswa = async () => {
      try {
        // Cari kelas dimana guru ini terdaftar
        const qKelas = query(
          collection(db, "kelas"),
          where("cabang", "==", guruData.cabang),
          where("guruKelas", "array-contains", guruData.nama)
        );
        const kelasSnap = await getDocs(qKelas);
        
        const jMap: Record<string, string> = {};
        const classes: string[] = [];
        kelasSnap.docs.forEach(doc => {
            const d = doc.data();
            if (d.namaKelas) {
                classes.push(d.namaKelas);
                jMap[d.namaKelas] = d.jenjangKelas || "";
            }
        });
        setKelasJenjangMap(jMap);
        setNamaKelas(classes.join(", "));

        if (classes.length > 0) {
          // Query siswa yang ada di kelas-kelas tersebut
          const qSiswa = query(
            collection(db, "siswa"),
            where("cabang", "==", guruData.cabang),
            where("kelas", "in", classes)
          );
          const siswaSnap = await getDocs(qSiswa);
          const list = siswaSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Sort by name
          list.sort((a: any, b: any) => (a.nama || "").localeCompare(b.nama || ""));
          setSiswaList(list);
        }
      } catch (error) {
        console.error("Error fetching siswa:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSiswa();
  }, [guruData]);

  // 3. Fetch Master Data (Semester, Trilogi, Kriteria)
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        // Semester
        const qSem = query(collection(db, "kpi_periode"), orderBy("createdAt", "desc"));
        const snapSem = await getDocs(qSem);
        const sems = snapSem.docs.map(d => ({ id: d.id, ...d.data() }));
        setSemesterList(sems);
        
        // Set Default Semester
        const defSem = sems.find((s: any) => s.isDefault);
        if (defSem) setSelectedSemester(defSem.id);
        else if (sems.length > 0) setSelectedSemester(sems[0].id);

        // Fetch Trilogi Groups
        const qGroups = query(collection(db, "trilogi_groups"));
        const snapGroups = await getDocs(qGroups);
        const groupMap = new Map<string, string>();
        snapGroups.forEach(doc => {
            groupMap.set(doc.id, doc.data().nama);
        });

        // Fetch Sub Trilogi
        const qSubTrilogi = query(collection(db, "sub_trilogi"));
        const snapSubTrilogi = await getDocs(qSubTrilogi);
        const subTrilogis = snapSubTrilogi.docs.map(d => {
            const data = d.data();
            // Fallback for Group ID (Cek berbagai kemungkinan nama field)
            const groupId = data.groupId || data.grupId || data.group_id || data.trilogiGroupId;
            return { 
                id: d.id, 
                ...data,
                groupName: groupMap.get(groupId) || "Lainnya" 
            };
        });
        
        // Sort by groupName then habit
        subTrilogis.sort((a: any, b: any) => {
             if (a.groupName < b.groupName) return -1;
             if (a.groupName > b.groupName) return 1;
             return (a.habit || "").localeCompare(b.habit || "", undefined, { numeric: true });
        });
        setTrilogiList(subTrilogis);

        // Kriteria Nilai (Optional)
        const qKat = query(collection(db, "kategori_penilaian"), where("nama", "==", "Nilai Trilogi"));
        const snapKat = await getDocs(qKat);
        if (!snapKat.empty) {
            const katId = snapKat.docs[0].id;
            const qKrit = query(collection(db, "kriteria_nilai"), where("kategoriId", "==", katId));
            const snapKrit = await getDocs(qKrit);
            const map: Record<number, string> = {};
            snapKrit.forEach(d => {
                const data = d.data();
                map[data.nilai] = data.nama;
            });
            setKriteriaMap(map);
        }
      } catch (e) {
        console.error("Error fetching master data:", e);
      }
    };
    fetchMaster();
  }, []);

  // 4. Fetch Nilai when Modal Open & Semester Selected
  useEffect(() => {
    if (!isModalOpen || !selectedSiswa || !selectedSemester) return;

    const fetchNilai = async () => {
      setLoadingNilai(true);
      try {
        const qNilai = query(
            collection(db, "nilai_trilogi"),
            where("siswaId", "==", selectedSiswa.id),
            where("semesterId", "==", selectedSemester)
        );
        const snapNilai = await getDocs(qNilai);
        
        const map: Record<string, number> = {};
        snapNilai.forEach(doc => {
            const d = doc.data();
            // Fallback for Item ID (Cek berbagai kemungkinan nama field)
            const idRef = d.subTrilogiId || d.trilogiId || d.sub_trilogi_id;
            if (idRef) {
                if (!map[idRef] || d.nilai > map[idRef]) {
                    map[idRef] = d.nilai;
                }
            }
        });
        setNilaiMap(map);
      } catch (e) {
        console.error("Error fetching nilai:", e);
      } finally {
        setLoadingNilai(false);
      }
    };
    fetchNilai();
  }, [isModalOpen, selectedSiswa, selectedSemester]);

  const openModal = (siswa: any) => {
    setSelectedSiswa(siswa);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSiswa(null);
    setNilaiMap({});
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-[#581c87]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-lg bg-white min-h-screen shadow-xl flex flex-col">
        {/* Header */}
        <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => router.push("/?tab=akademik")} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Nilai Trilogi</h1>
            <p className="text-xs text-gray-500">Kelas: {namaKelas}</p>
          </div>
        </header>

        {/* List Siswa */}
        <div className="p-4 space-y-3">
            {siswaList.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">
                    Tidak ada siswa ditemukan di kelas Anda.
                </div>
            ) : (
                siswaList.map((siswa) => (
                    <div key={siswa.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex justify-between items-center hover:shadow-md transition">
                        <span className="font-medium text-gray-800">{siswa.nama}</span>
                        <button 
                            onClick={() => openModal(siswa)}
                            className="text-xs bg-purple-50 text-[#581c87] px-3 py-1.5 rounded-lg font-semibold hover:bg-purple-100 transition flex items-center gap-1"
                        >
                            <Eye className="w-3 h-3" />
                            Lihat Nilai
                        </button>
                    </div>
                ))
            )}
        </div>

        {/* Modal */}
        {isModalOpen && selectedSiswa && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                    {/* Modal Header */}
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl sticky top-0 z-10">
                        <div>
                            <h3 className="font-bold text-gray-800">{selectedSiswa.nama}</h3>
                            <p className="text-xs text-gray-500">Nilai Trilogi</p>
                        </div>
                        <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-4 overflow-y-auto flex-1">
                        {/* Semester Dropdown */}
                        <div className="mb-4 bg-purple-50 p-3 rounded-lg border border-purple-100">
                            <label className="block text-xs font-medium text-purple-800 mb-1">Pilih Semester</label>
                            <select 
                                value={selectedSemester} 
                                onChange={(e) => setSelectedSemester(e.target.value)}
                                className="w-full border border-purple-200 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-700"
                            >
                                {semesterList.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.namaPeriode} {s.isDefault ? "(Default)" : ""}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Loading State */}
                        {loadingNilai ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                <p className="text-xs">Memuat nilai...</p>
                            </div>
                        ) : (
                            <div className="space-y-4 pb-4">
                                {trilogiList
                                    .filter(item => {
                                        if (!selectedSiswa?.kelas) return false;
                                        const jenjang = kelasJenjangMap[selectedSiswa.kelas];
                                        return item.jenjangKelas === jenjang;
                                    })
                                    .map((item, idx, arr) => {
                                    // Grouping header logic
                                    const showHeader = idx === 0 || arr[idx - 1].groupName !== item.groupName;
                                    const nilai = nilaiMap[item.id];

                                    return (
                                        <div key={item.id}>
                                            {showHeader && (
                                                <h4 className="font-bold text-[#581c87] text-xs uppercase tracking-wide mt-5 mb-2 border-b border-gray-100 pb-1">
                                                    {item.groupName}
                                                </h4>
                                            )}
                                            <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition px-1 rounded">
                                                <div className="flex-1">
                                                    <span className="block text-xs font-bold text-purple-700 mb-0.5">{item.habit}</span>
                                                    <p className="text-sm text-gray-700 leading-snug">{item.deskripsi}</p>
                                                </div>
                                                <div className="shrink-0">
                                                    {nilai ? (
                                                        <span className={`
                                                            inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shadow-sm
                                                            ${nilai >= 4 ? 'bg-green-100 text-green-700' : 
                                                              nilai === 3 ? 'bg-blue-100 text-blue-700' : 
                                                              nilai === 2 ? 'bg-yellow-100 text-yellow-700' : 
                                                              'bg-red-100 text-red-700'}
                                                        `}>
                                                            {kriteriaMap[nilai] || nilai}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs text-gray-300 bg-gray-100">
                                                            -
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                                {trilogiList.filter(item => item.jenjangKelas === kelasJenjangMap[selectedSiswa?.kelas]).length === 0 && (
                                    <p className="text-center text-gray-500 text-sm py-4">
                                        Belum ada data trilogi untuk jenjang {kelasJenjangMap[selectedSiswa?.kelas] || "ini"}.
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}