"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { ArrowLeft, Loader2, Target } from "lucide-react";

export default function SiswaIndikatorPage() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [semesterList, setSemesterList] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState("");
  
  const [nilaiList, setNilaiList] = useState<any[]>([]);
  const [kriteriaMap, setKriteriaMap] = useState<Record<number, string>>({});
  const [loadingData, setLoadingData] = useState(false);

  // 1. Auth & User Data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      try {
        // Cek data siswa berdasarkan email login
        const qSiswa = query(collection(db, "siswa"), where("email", "==", currentUser.email));
        const snapshotSiswa = await getDocs(qSiswa);

        if (!snapshotSiswa.empty) {
          setUserData({ id: snapshotSiswa.docs[0].id, ...snapshotSiswa.docs[0].data() });
        } else {
          router.push("/"); 
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      } finally {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch Master Data (Semester & Kriteria Nilai)
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        // Fetch Semester
        const qSem = query(collection(db, "kpi_periode"), orderBy("createdAt", "desc"));
        const snapSem = await getDocs(qSem);
        const sems = snapSem.docs.map(d => ({ id: d.id, ...d.data() }));
        setSemesterList(sems);
        
        // Set Default Semester
        const defaultSem = sems.find((s: any) => s.isDefault);
        if (defaultSem) setSelectedSemester(defaultSem.id);
        else if (sems.length > 0) setSelectedSemester(sems[0].id);

        // Fetch Kriteria Nilai (Khusus kategori "Nilai Indikator")
        const qKat = query(collection(db, "kategori_penilaian"), where("nama", "==", "Nilai Indikator"));
        const snapKat = await getDocs(qKat);
        if (!snapKat.empty) {
          const katId = snapKat.docs[0].id;
          const qKrit = query(collection(db, "kriteria_nilai"), where("kategoriId", "==", katId));
          const snapKrit = await getDocs(qKrit);
          const map: Record<number, string> = {};
          snapKrit.forEach(d => {
            const data = d.data();
            map[data.nilai] = data.nama; // Contoh: 4 -> "BSB"
          });
          setKriteriaMap(map);
        }
      } catch (e) {
        console.error("Error fetching master data:", e);
      }
    };
    fetchMaster();
  }, []);

  // 3. Fetch Nilai Indikator Siswa
  useEffect(() => {
    if (!userData || !selectedSemester) return;

    const fetchNilai = async () => {
      setLoadingData(true);
      try {
        const qNilai = query(
          collection(db, "nilai_indikator"), 
          where("siswaId", "==", userData.id),
          where("semesterId", "==", selectedSemester)
        );
        const snapNilai = await getDocs(qNilai);
        
        const rawNilai = snapNilai.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Urutkan berdasarkan Nama Indikator, lalu Sub Indikator
        rawNilai.sort((a: any, b: any) => {
            if (a.namaIndikator < b.namaIndikator) return -1;
            if (a.namaIndikator > b.namaIndikator) return 1;
            return (a.namaSubIndikator || "").localeCompare(b.namaSubIndikator || "");
        });

        setNilaiList(rawNilai);
      } catch (e) {
        console.error("Error fetching nilai:", e);
      } finally {
        setLoadingData(false);
      }
    };

    fetchNilai();
  }, [userData, selectedSemester]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-[#581c87]" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-lg bg-white min-h-screen shadow-xl flex flex-col">
        {/* Header */}
        <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Nilai Indikator</h1>
        </header>

        <div className="p-4 space-y-4">
            {/* Semester Selector */}
            <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                <label className="text-xs font-medium text-orange-800 mb-1 block">Pilih Semester</label>
                <select 
                    value={selectedSemester} 
                    onChange={(e) => setSelectedSemester(e.target.value)}
                    className="w-full bg-white border border-orange-200 text-gray-700 text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5 outline-none"
                >
                    {semesterList.map(s => (
                        <option key={s.id} value={s.id}>{s.namaPeriode}</option>
                    ))}
                </select>
            </div>

            {/* Content List */}
            {loadingData ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <Loader2 className="w-8 h-8 animate-spin mb-2" />
                    <p className="text-sm">Memuat data nilai...</p>
                </div>
            ) : nilaiList.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <Target className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Belum ada data nilai untuk semester ini.</p>
                </div>
            ) : (
                <div className="space-y-4 pb-8">
                    {nilaiList.map((item, index) => {
                        // Tampilkan Header Indikator jika berbeda dengan item sebelumnya
                        const showHeader = index === 0 || nilaiList[index - 1].namaIndikator !== item.namaIndikator;
                        return (
                            <div key={item.id}>
                                {showHeader && (
                                    <h3 className="font-bold text-[#581c87] text-sm uppercase tracking-wide mb-2 mt-5 px-1 border-b border-gray-100 pb-1">
                                        {item.namaIndikator}
                                    </h3>
                                )}
                                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex justify-between items-center gap-4 hover:shadow-md transition">
                                    <div className="flex-1">
                                        <p className="text-sm text-gray-700 font-medium leading-snug">{item.namaSubIndikator}</p>
                                    </div>
                                    <div className={`
                                        flex items-center justify-center w-10 h-10 rounded-full font-bold text-xs shrink-0 shadow-sm
                                        ${item.nilai >= 4 ? 'bg-green-100 text-green-700' : 
                                          item.nilai === 3 ? 'bg-blue-100 text-blue-700' : 
                                          item.nilai === 2 ? 'bg-yellow-100 text-yellow-700' : 
                                          'bg-red-100 text-red-700'}
                                    `}>
                                        {kriteriaMap[item.nilai] || item.nilai}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
      </div>
    </div>
  );
}