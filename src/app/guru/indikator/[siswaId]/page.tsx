// src/app/guru/indikator/[siswaId]/page.tsx

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

interface SubIndikator {
  id: string;
  deskripsi: string;
  groupName: string;
  groupId: string; // ID indikator_groups (untuk filter jenjang)
  periode?: string; // Semester tempat sub indikator berlaku
}

export default function DetailIndikatorSiswaPage() {
  const params = useParams();
  const router = useRouter();
  const siswaId = params.siswaId as string;

  const [loading, setLoading] = useState(true);
  const [guruData, setGuruData] = useState<any>(null);
  const [siswa, setSiswa] = useState<any>(null);
  const [semesterList, setSemesterList] = useState<any[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [indikatorList, setIndikatorList] = useState<SubIndikator[]>([]);
  // Semua sub indikator (sebelum difilter jenjang + semester)
  const [allSubIndikators, setAllSubIndikators] = useState<SubIndikator[]>([]);
  // IDs indikator_groups yang cocok dengan jenjang kelas siswa
  const [matchedGroupIds, setMatchedGroupIds] = useState<string[]>([]);
  // indikatorId -> { nilai: number, docId: string }
  const [nilaiMap, setNilaiMap] = useState<Record<string, { nilai: number; docId: string }>>({});
  const [kriteriaMap, setKriteriaMap] = useState<Record<number, string>>({});
  // Referensi untuk melengkapi data yang dikirim ke firestore
  const [kelasRef, setKelasRef] = useState<{ id: string; namaKelas: string } | null>(null);
  const [cabangRef, setCabangRef] = useState<{ id: string; nama: string } | null>(null);
  // Nama semester default (untuk pencocokan toleran field periode sub indikator)
  const [defaultSemesterNama, setDefaultSemesterNama] = useState<string>("");
  const [loadingNilai, setLoadingNilai] = useState(false);
  const [editingIndikatorId, setEditingIndikatorId] = useState<string | null>(null);
  const [savingIndikatorId, setSavingIndikatorId] = useState<string | null>(null);

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
          router.push("/guru/indikator");
          return;
        }
        const siswaData: any = { id: siswaSnap.id, ...(siswaSnap.data() as Record<string, any>) };
        setSiswa(siswaData);

        // Cari dokumen kelas siswa (untuk kelasId & namaKelas)
        const qKelas = query(
          collection(db, "kelas"),
          where("cabang", "==", siswaData.cabang || ""),
          where("namaKelas", "==", siswaData.kelas || "")
        );
        const snapKelas = await getDocs(qKelas);
        let kelasInfo: { id: string; namaKelas: string } | null = null;
        let jenjangKelas: string = "";
        let cabangInfo: { id: string; nama: string } | null = null;
        if (!snapKelas.empty) {
          const kelasDoc = snapKelas.docs[0];
          kelasInfo = { id: kelasDoc.id, namaKelas: kelasDoc.data().namaKelas || siswaData.kelas || "" };
          jenjangKelas = kelasDoc.data().jenjangKelas || "";
        }
        setKelasRef(kelasInfo);

        // Cari ID jenjang kelas di koleksi 'jenjang_kelas' berdasarkan nama (atau ID sebagai fallback)
        let matchedJenjangId: string = "";
        let matchedJenjangNama: string = "";
        if (jenjangKelas) {
          const qJenjang = query(collection(db, "jenjang_kelas"), where("nama", "==", jenjangKelas));
          const snapJenjang = await getDocs(qJenjang);
          if (!snapJenjang.empty) {
            matchedJenjangId = snapJenjang.docs[0].id;
            matchedJenjangNama = snapJenjang.docs[0].data().nama || "";
          } else {
            // Mungkin jenjangKelas sudah berupa ID dokumen
            const jenjangDoc = await getDoc(doc(db, "jenjang_kelas", jenjangKelas));
            if (jenjangDoc.exists()) {
              matchedJenjangId = jenjangDoc.id;
              matchedJenjangNama = jenjangDoc.data().nama || "";
            }
          }
        }
        if (!matchedJenjangId && !matchedJenjangNama) {
          console.warn("[Indikator] jenjangKelas tidak ditemukan di koleksi jenjang_kelas:", jenjangKelas);
        }

        // Cari dokumen cabang siswa (untuk cabangId & namaCabang)
        if (siswaData.cabang) {
          const qCabang = query(collection(db, "cabang"), where("nama", "==", siswaData.cabang));
          const snapCabang = await getDocs(qCabang);
          if (!snapCabang.empty) {
            cabangInfo = { id: snapCabang.docs[0].id, nama: snapCabang.docs[0].data().nama || siswaData.cabang };
          }
        }
        setCabangRef(cabangInfo);

        // Semester (simpan juga nama untuk pencocokan toleran)
        const snapSem = await getDocs(query(collection(db, "kpi_periode"), orderBy("createdAt", "desc")));
        const sems = snapSem.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) }));
        setSemesterList(sems);
        const defSem = sems.find((s: any) => s.isDefault);
        if (defSem) setSelectedSemester(defSem.id);
        else if (sems.length > 0) setSelectedSemester(sems[0].id);
        const defaultSemNama = ((defSem || sems[0]) as any)?.namaPeriode || "";
        setDefaultSemesterNama(defaultSemNama);

        // Indikator Groups untuk mapping nama grup
        const snapGroups = await getDocs(collection(db, "indikator_groups"));
        const groupMap = new Map<string, string>();
        const groupIdsForJenjang: string[] = [];
        snapGroups.forEach(d => {
          const data = d.data();
          groupMap.set(d.id, data.nama);
          // Pencocokan toleran: field jenjang di indikator_groups bisa berupa ID
          // dokumen jenjang_kelas ATAU namanya langsung.
          const jenjangRefs = [matchedJenjangId, matchedJenjangNama, jenjangKelas].filter(Boolean);
          if (jenjangRefs.includes(data.jenjang) || jenjangRefs.includes(data.jenjangId)) {
            groupIdsForJenjang.push(d.id);
          }
        });
        setMatchedGroupIds(groupIdsForJenjang);
        console.log("[Indikator] jenjangKelas:", jenjangKelas, "| matchedJenjangId:", matchedJenjangId, "| groups cocok:", groupIdsForJenjang.length, "dari", snapGroups.size);

        // Sub Indikators (semua diambil, difilter jenjang + semester di useEffect terpisah)
        const snapSubIndikator = await getDocs(collection(db, "sub_indikators"));
        const subIndikators = snapSubIndikator.docs.map(d => {
          const data = d.data();
          // Fallback berbagai kemungkinan nama field ID group
          const groupId = data.grupId || data.groupID || data.groupId || data.indikatorGroupId;
          return {
            id: d.id,
            deskripsi: data.deskripsi || "",
            groupName: groupMap.get(groupId) || "Lainnya",
            groupId: groupId || "",
            periode: data.periode || "",
          } as SubIndikator;
        });

        subIndikators.sort((a, b) => {
          if (a.groupName < b.groupName) return -1;
          if (a.groupName > b.groupName) return 1;
          return (a.deskripsi || "").localeCompare(b.deskripsi || "");
        });
        setAllSubIndikators(subIndikators);
        setIndikatorList(subIndikators);

        // Kriteria Nilai
        const qKat = query(collection(db, "kategori_penilaian"), where("nama", "==", "Nilai Indikator"));
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

  // 2b. Filter sub indikator sesuai jenjang kelas siswa + semester terpilih
  useEffect(() => {
    if (!selectedSemester || allSubIndikators.length === 0) {
      if (allSubIndikators.length === 0) setIndikatorList([]);
      return;
    }
    // Cari nama semester terpilih untuk pencocokan toleran
    const semObj = semesterList.find(s => s.id === selectedSemester);
    const semNama = semObj?.namaPeriode || defaultSemesterNama;

    let filtered = allSubIndikators;
    if (matchedGroupIds.length > 0) {
      // Filter berdasarkan grup indikator yang sesuai jenjang kelas siswa
      filtered = filtered.filter(s => matchedGroupIds.includes(s.groupId));
    }
    const sebelumSemester = filtered.length;
    // Filter berdasarkan periode (semester) — toleran terhadap ID atau nama periode
    filtered = filtered.filter(s => s.periode === selectedSemester || (semNama && s.periode === semNama));
    if (filtered.length === 0 && sebelumSemester > 0) {
      console.warn("[Indikator] Semua sub indikator terbuang saat filter periode. Contoh periode di data:",
        allSubIndikators.slice(0, 5).map(s => s.periode),
        "| selectedSemester:", selectedSemester, "| semNama:", semNama);
    }
    setIndikatorList(filtered);
  }, [allSubIndikators, matchedGroupIds, selectedSemester, semesterList, defaultSemesterNama]);

  // 3. Fetch Nilai saat semester berubah
  useEffect(() => {
    if (!selectedSemester || !siswaId) return;

    const fetchNilai = async () => {
      setLoadingNilai(true);
      try {
        const snapNilai = await getDocs(query(
          collection(db, "nilai_indikator"),
          where("siswaId", "==", siswaId),
          where("semesterId", "==", selectedSemester)
        ));

        const map: Record<string, { nilai: number; docId: string }> = {};
        snapNilai.forEach(docN => {
          const d = docN.data();
          // Fallback berbagai kemungkinan nama field (konsisten dengan halaman daftar)
          const idRef = d.subIndikatorId || d.indikatorId || d.sub_indikator_id;
          if (idRef) {
            // Simpan nilai terbesar per indikator (konsisten dengan logic sebelumnya)
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

  const handleSaveNilai = async (indikatorId: string, nilai: number) => {
    if (!guruData) return;
    setSavingIndikatorId(indikatorId);
    try {
      const existing = nilaiMap[indikatorId];
      const subIndikator = indikatorList.find(i => i.id === indikatorId);
      const semester = semesterList.find(s => s.id === selectedSemester);
      if (existing && existing.docId !== "new") {
        // Update dokumen yang sudah ada
        await updateDoc(doc(db, "nilai_indikator", existing.docId), {
          nilai,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, "nilai_indikator"), {
          cabangId: cabangRef?.id || "",
          namaCabang: siswa?.cabang || cabangRef?.nama || "",
          kelasId: kelasRef?.id || "",
          namaKelas: siswa?.kelas || kelasRef?.namaKelas || "",
          siswaId,
          namaSiswa: siswa?.nama || "",
          semesterId: selectedSemester,
          namaSemester: semester?.namaPeriode || "",
          indikatorId,
          namaIndikator: subIndikator?.groupName || "",
          subIndikatorId: indikatorId,
          namaSubIndikator: subIndikator?.deskripsi || "",
          nilai,
          guruId: guruData.id,
          guruNama: guruData.nama,
          tanggal: new Date().toISOString().split("T")[0],
          createdAt: serverTimestamp(),
        });
      }
      setNilaiMap(prev => ({
        ...prev,
        [indikatorId]: { nilai, docId: existing?.docId || "new" },
      }));
      setEditingIndikatorId(null);
    } catch (e) {
      console.error("Error saving nilai:", e);
      alert("Gagal menyimpan nilai.");
    } finally {
      setSavingIndikatorId(null);
    }
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
          <button onClick={() => router.push("/guru/indikator")} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">{siswa?.nama}</h1>
            <p className="text-xs text-gray-500">Nilai Indikator</p>
          </div>
        </header>

        <div className="p-4">
          {/* Pilih Semester */}
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

          {loadingNilai ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p className="text-xs">Memuat nilai...</p>
            </div>
          ) : (
            <div className="space-y-1 pb-20">
              {indikatorList.map((indikator, idx) => {
                const showHeader = idx === 0 || indikatorList[idx - 1].groupName !== indikator.groupName;
                const entry = nilaiMap[indikator.id];
                const nilai = entry?.nilai;
                const isEditing = editingIndikatorId === indikator.id;
                const isSaving = savingIndikatorId === indikator.id;

                return (
                  <div key={indikator.id}>
                    {showHeader && (
                      <h4 className="font-bold text-[#581c87] text-xs uppercase tracking-wide mt-5 mb-2 border-b border-gray-100 pb-1">
                        {indikator.groupName}
                      </h4>
                    )}
                    <div className="flex justify-between items-start gap-4 py-2 border-b border-gray-50 hover:bg-gray-50 transition px-1 rounded">
                      <p className="text-sm text-gray-700 flex-1 leading-snug">{indikator.deskripsi}</p>
                      <div className="shrink-0">
                        {isEditing ? (
                          /* Mode Edit: pilihan nilai inline */
                          <div className="flex items-center gap-1">
                            {[3, 2, 1].map(opt => (
                              <button
                                key={opt}
                                disabled={isSaving}
                                onClick={() => handleSaveNilai(indikator.id, opt)}
                                title={kriteriaMap[opt] || String(opt)}
                                className={`w-7 h-7 rounded-full text-[10px] font-bold transition ${
                                  opt === 3 ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' :
                                  opt === 2 ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                                  'bg-red-100 text-red-700 hover:bg-red-200'
                                } disabled:opacity-50`}
                              >
                                {kriteriaMap[opt] || opt}
                              </button>
                            ))}
                            <button
                              onClick={() => setEditingIndikatorId(null)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingIndikatorId(indikator.id)}
                            className="group flex items-center gap-1"
                            title="Klik untuk menambah / mengubah nilai"
                          >
                            {nilai ? (
                              <>
                                <span className={`
                                  inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold shadow-sm
                                  ${nilai === 3 ? 'bg-blue-100 text-blue-700' :
                                    nilai === 2 ? 'bg-yellow-100 text-yellow-700' :
                                    'bg-red-100 text-red-700'}
                                `}>
                                  {kriteriaMap[nilai] || nilai}
                                </span>
                                <Pencil className="w-3 h-3 text-gray-300 group-hover:text-[#581c87] transition" />
                              </>
                            ) : (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs text-gray-400 bg-gray-100 border border-dashed border-gray-300 group-hover:border-[#581c87] group-hover:text-[#581c87] transition">
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
              {indikatorList.length === 0 && (
                <p className="text-center text-gray-500 text-sm py-4">Belum ada data indikator belajar.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
