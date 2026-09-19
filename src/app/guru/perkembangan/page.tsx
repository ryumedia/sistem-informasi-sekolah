// src/app/guru/perkembangan/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { ArrowLeft, Loader2, Eye } from "lucide-react";
import Link from "next/link";

export default function GuruPerkembanganPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [guruData, setGuruData] = useState<any>(null);
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [namaKelas, setNamaKelas] = useState("");


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
        const classes = kelasSnap.docs.map(doc => doc.data().namaKelas);
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
            <h1 className="text-lg font-bold text-gray-800">Perkembangan Siswa</h1>
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
                        <Link
                            href={`/guru/perkembangan/${siswa.id}`}
                            className="text-xs bg-purple-50 text-[#581c87] px-3 py-1.5 rounded-lg font-semibold hover:bg-purple-100 transition flex items-center gap-1"
                        >
                            <Eye className="w-3 h-3" />
                            Lihat Nilai
                        </Link>
                    </div>
                ))
            )}
        </div>
      </div>
    </div>
  );
}
