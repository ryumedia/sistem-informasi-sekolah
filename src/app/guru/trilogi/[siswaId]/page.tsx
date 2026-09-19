// src/app/guru/trilogi/[siswaId]/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ArrowLeft, Loader2, Pencil, X } from "lucide-react";

interface SubTrilogi {
  id: string;
  habit: string;
  deskripsi: string;
  groupName: string;
}

export default function DetailTrilogiSiswaPage() {
  const params = useParams();
  const router = useRouter();
  const siswaId = params.siswaId as string;

  const [loading, setLoading] = useState(true);
  const [guruData, setGuruData] = useState<any>(null);
  const [siswa, setSiswa] = useState<any>(null);
  const [semesterList, setSemesterList] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [trilogiList, setTrilogiList] = useState<SubTrilogi[]>([]);
  // subTrilogiId -> { nilai: number, docId: string }
  const [nilaiMap, setNilaiMap] = useState<Record<string, { nilai: number; docId: string }>>({});
  const [kriteriaMap, setKriteriaMap] = useState<Record<number, string>>({});
  const [loadingNilai, setLoadingNilai] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);

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

  // 2. Fetch Siswa + Master Data
  useEffect(() => {
    if (!guruData) return;
    const fetchData = async () => {
      try {
        // Data siswa
        const siswaSnap = await getDoc(doc(db, "siswa", siswaId));
        if (!siswaSnap.exists()) {
          alert("Data siswa tidak ditemukan.");
          router.push("/guru/trilogi");
          return;
        }
        const siswaData = { id: siswaSnap.id, ...siswaSnap.data() } as { id: string; cabang?: string; kelas?: string; [key: string]: any };
        setSiswa(siswaData);

        // Semester
        const snapSem = await getDocs(query(collection(db, "kpi_periode"), orderBy("createdAt", "desc")));
        const sems = snapSem.docs.map(d => ({ id: d.id, ...d.data() }));
        setSemesterList(sems);
        const defSem = sems.find((s: any) => s.isDefault);
        if (defSem) setSelectedSemester(defSem.id);
        else if (sems.length > 0) setSelectedSemester(sems[0].id);

        // Jenjang kelas siswa (untuk filter sub trilogi)
        const qKelas = query(
          collection(db, "kelas"),
          where("cabang", "==", siswaData.cabang),
          where("namaKelas", "==", siswaData.kelas)
        );
        const kelasSnap = await getDocs(qKelas);
        const jenjangSiswa = !kelasSnap.empty ? (kelasSnap.docs[0].data().jenjangKelas || "") : "";

        // Trilogi Groups untuk mapping nama grup
        const snapGroups = await getDocs(collection(db, "trilogi_groups"));
        const groupMap = new Map<string, string>();
        snapGroups.forEach(d => {
          groupMap.set(d.id, d.data().nama);
        });

        // Sub Trilogi
        const snapSubTrilogi = await getDocs(collection(db, "sub_trilogi"));
        const subTrilogis = snapSubTrilogi.docs
          .map(d => {
            const data = d.data();
            // Fallback berbagai kemungkinan nama field ID group
            const groupId = data.groupId || data.grupId || data.group_id || data.trilogiGroupId;
            return {
              id: d.id,
              habit: data.habit || "",
              deskripsi: data.deskripsi || "",
              groupName: groupMap.get(groupId) || "Lainnya",
              jenjangKelas: data.jenjangKelas || "",
            };
          })
          .filter(item => !jenjangSiswa || item.jenjangKelas === jenjangSiswa) as SubTrilogi[];

        subTrilogis.sort((a, b) => {
          if (a.groupName < b.groupName) return -1;
          if (a.groupName > b.groupName) return 1;
          return (a.habit || "").localeCompare(b.habit || "", undefined, { numeric: true });
        });
        setTrilogiList(subTrilogis);

        // Kriteria Nilai
        const qKat = query(collection(db, "kategori_penilaian"), where("nama", "==", "Nilai Trilogi"));
        const snapKat = await getDocs(qKat);
        if (!snapKat.empty) {
          const qKrit = query(collection(db, "kriteria_nilai"), where("kategoriId", "==", snapKat.docs[0].id));
          const snapKrit = await getDocs(qKrit);
          const map: Record<number, string> = {};
          snapKrit.forEach(d => {
            const data = d.data();
            map[data.nilai] = data.nama;
          });
          setKriteriaMap(map);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [guruData, siswaId, router]);

  // 3. Fetch Nilai saat semester berubah
  useEffect(() => {
    if (!selectedSemester || !siswaId) return;

    const fetchNilai = async () => {
      setLoadingNilai(true);
      try {
        const snapNilai = await getDocs(query(
          collection(db, "nilai_trilogi"),
          where("siswaId", "==", siswaId),
          where("semesterId", "==", selectedSemester)
        ));

        const map: Record<string, { nilai: number; docId: string }> = {};
        snapNilai.forEach(docN => {
          const d = docN.data();
          // Fallback berbagai kemungkinan nama field (konsisten dengan halaman daftar)
          const idRef = d.subTrilogiId || d.trilogiId || d.sub_trilogi_id;
          if (idRef) {
            // Simpan nilai terbesar per item trilogi (konsisten dengan logic sebelumnya)
            if (!map[idRef] || d.nilai > map[idRef].nilai) {
              map[idRef] = { nilai: d.nilai, docId: docN.id };
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
  }, [selectedSemester, siswaId]);

  const handleSaveNilai = async (itemId: string, nilai: number) => {
    if (!guruData) return;
    setSavingItemId(itemId);
    try {
      const existing = nilaiMap[itemId];
      if (existing && existing.docId !== "new") {
        // Update dokumen yang sudah ada
        await updateDoc(doc(db, "nilai_trilogi", existing.docId), { nilai });
      } else {
        await addDoc(collection(db, "nilai_trilogi"), {
          siswaId,
          semesterId: selectedSemester,
          subTrilogiId: itemId,
          trilogiId: itemId, // disimpan juga untuk kompatibilitas dengan pembacaan lama
          nilai,
          guruId: guruData.id,
          guruNama: guruData.nama,
          createdAt: serverTimestamp(),
        });
      }
      setNilaiMap(prev => ({
        ...prev,
        [itemId]: { nilai, docId: existing?.docId || "new" },
      }));
      setEditingItemId(null);
    } catch (e) {
      console.error("Error saving nilai:", e);
      alert("Gagal menyimpan nilai.");
    } finally {
      setSavingItemId(null);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Loader2 className="w-8 h-8 animate-spin text-[#581c87]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-lg bg-white min-h-screen shadow-xl flex-col">
        {/* Header */}
        <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => router.push("/guru/trilogi")} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">{siswa?.nama}</h1>
            <p className="text-xs text-gray-500">Nilai Trilogi</p>
          </div>
        </header>

        <div className="p-4">
          {/* Pilih Semester */}
          <div className="mb-4 bg-purple-50 p-3 rounded-lg border-purple-100">
            <label className="block text-xs font-medium text-purple-800 mb-1">Pilih Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full border-purple-200 rounded-lg p-2 text-sm bg-white focus:ring-2 focus:ring-[#581c87] outline-none text-gray-700"
            >
              {semesterList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.namaPeriode} {s.isDefault ? "(Default)" : ""}
                </option>
              ))}
            </select>
          </div>

          {loadingNilai ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-xs">Memuat nilai...</p>
            </div>
          ) : (
            <div className="space-y-1 pb-20">
              {trilogiList.map((item, idx) => {
                const showHeader = idx === 0 || trilogiList[idx - 1].groupName !== item.groupName;
                const entry = nilaiMap[item.id];
                const nilai = entry?.nilai;
                const isEditing = editingItemId === item.id;
                const isSaving = savingItemId === item.id;

                return (
                  <div key={item.id}>
                    {showHeader && (
                      <h4 className="font-bold text-[#581c87] text-xs uppercase tracking-wide mt-5 mb-2 border-b border-gray-100 pb-1">
                        {item.groupName}
                      </h4>
                    )}
                    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-50 hover:bg-gray-50 transition px-1 rounded">
                      <div className="flex-1">
                        <span className="block text-xs font-bold text-purple-700 mb-0.5">{item.habit}</span>
                        <p className="text-sm text-gray-700 leading-snug">{item.deskripsi}</p>
                      </div>
                      <div className="shrink-0">
                        {isEditing ? (
                          /* Mode Edit: pilihan nilai inline */
                          <div className="flex items-center gap-1">
                            {[
                              { n: 4, c: 'bg-green-100 text-green-700 hover:bg-green-200' },
                              { n: 3, c: 'bg-blue-100 text-blue-700 hover:bg-blue-200' },
                              { n: 2, c: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' },
                              { n: 1, c: 'bg-red-100 text-red-700 hover:bg-red-200' },
                            ].map(opt => (
                              <button
                                key={opt.n}
                                disabled={isSaving}
                                onClick={() => handleSaveNilai(item.id, opt.n)}
                                title={kriteriaMap[opt.n] || String(opt.n)}
                                className={`w-7 h-7 rounded-full text-[10px] font-bold transition ${opt.c} disabled:opacity-50`}
                              >
                                {kriteriaMap[opt.n] || opt.n}
                              </button>
                            ))}
                            <button
                              onClick={() => setEditingItemId(null)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingItemId(item.id)}
                            className="group flex items-center gap-1"
                            title="Klik untuk menambah / mengubah nilai"
                          >
                            {nilai ? (
                              <>
                                <span className={`
                                  inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shadow-sm
                                  ${nilai >= 4 ? 'bg-green-100 text-green-700' :
                                    nilai === 3 ? 'bg-blue-100 text-blue-700' :
                                    nilai === 2 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'}
                                `}>
                                  {kriteriaMap[nilai] || nilai}
                                </span>
                                <Pencil className="w-3 h-3 text-gray-300 group-hover:text-[#581c87] transition" />
                              </>
                            ) : (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs text-gray-400 bg-gray-100 border-dashed border-gray-300 group-hover:border-[#581c87] group-hover:text-[#581c87] transition">
                                +
                              </span>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {trilogiList.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">Belum ada data trilogi untuk jenjang siswa ini.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
