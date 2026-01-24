"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { ArrowLeft, Loader2, User, Users } from "lucide-react";

export default function DaftarSiswaGuruPage() {
  const router = useRouter();
  const [guruData, setGuruData] = useState<any>(null);
  const [siswaList, setSiswaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [namaKelas, setNamaKelas] = useState<string>("");

  // 1. Auth & Get Guru Data
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
          const data = snapshotGuru.docs[0].data();
          setGuruData({ id: snapshotGuru.docs[0].id, ...data });
        } else {
          // Jika bukan guru, tendang ke halaman utama
          router.push("/");
        }
      } catch (error) {
        console.error("Error fetching guru data:", error);
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch Kelas & Siswa based on Guru Name
  useEffect(() => {
    if (!guruData) return;

    const fetchData = async () => {
      try {
        // Cari kelas dimana guru ini terdaftar (field 'guruKelas' array-contains nama guru)
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
          
          // Sort client-side agar tidak perlu buat index di Firestore
          list.sort((a: any, b: any) => (a.nama || "").localeCompare(b.nama || ""));
          
          setSiswaList(list);
        }
      } catch (error) {
        console.error("Error fetching siswa list:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [guruData]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-[#581c87]" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-lg bg-white min-h-screen shadow-xl flex flex-col">
        {/* Header */}
        <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => router.push("/?tab=akademik")} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Daftar Siswa</h1>
            <p className="text-xs text-gray-500">Kelas: {namaKelas || '...'}</p>
          </div>
        </header>

        {/* Content List */}
        <div className="p-4 space-y-2">
          {siswaList.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-700">Belum Ada Siswa</h3>
              <p className="text-gray-500 text-sm mt-1">Tidak ada data siswa yang ditemukan di kelas Anda.</p>
            </div>
          ) : (
            siswaList.map(siswa => (
              <div key={siswa.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm flex items-center gap-4">
                {siswa.foto ? (
                  <img src={siswa.foto} alt={siswa.nama} className="w-12 h-12 rounded-full object-cover bg-gray-100" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-500">
                    <User className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-bold text-gray-800 text-sm">{siswa.nama}</p>
                  <p className="text-xs text-gray-500">NISN: {siswa.nisn || "-"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}