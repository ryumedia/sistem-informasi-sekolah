"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ArrowLeft, Loader2, Eye, X, BookOpen, Calendar } from "lucide-react";

export default function RPPHGuruPage() {
  const router = useRouter();
  const [guruData, setGuruData] = useState<any>(null);
  const [rpphList, setRpphList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRPPH, setSelectedRPPH] = useState<any>(null);
  
  const [filterBulan, setFilterBulan] = useState<string>("");
  const [filterTahun, setFilterTahun] = useState<string>("");

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const currentYear = new Date().getFullYear();
  // Menampilkan tahun dari tahun lalu hingga tahun depan
  const years = Array.from({ length: 3 }, (_, i) => (currentYear - 1 + i).toString());

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
          router.push("/");
        }
      } catch (error) {
        console.error("Error fetching guru data:", error);
        router.push("/");
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch RPPH based on Guru's Class
  useEffect(() => {
    if (!guruData) return;

    const fetchRPPH = async () => {
      try {
        // Cari kelas dimana guru ini terdaftar
        const qKelas = query(
          collection(db, "kelas"),
          where("cabang", "==", guruData.cabang),
          where("guruKelas", "array-contains", guruData.nama)
        );
        const kelasSnap = await getDocs(qKelas);
        const classes = kelasSnap.docs.map(doc => doc.data().namaKelas);

        if (classes.length > 0) {
          // Query RPPH
          const qRpph = query(
            collection(db, "rpph"),
            where("kelas", "in", classes)
          );
          const rpphSnap = await getDocs(qRpph);
          const list = rpphSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          
          // Sort by date desc (client side)
          list.sort((a: any, b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
          
          setRpphList(list);
        }
      } catch (error) {
        console.error("Error fetching RPPH:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRPPH();
  }, [guruData]);

  // Filter Logic
  const filteredList = rpphList.filter((item) => {
    if (!item.tanggal) return true;
    const date = new Date(item.tanggal);
    const monthIndex = date.getMonth();
    const year = date.getFullYear().toString();
    const month = monthNames[monthIndex];

    const matchBulan = filterBulan ? month === filterBulan : true;
    const matchTahun = filterTahun ? year === filterTahun : true;

    return matchBulan && matchTahun;
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="w-8 h-8 animate-spin text-[#581c87]" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-lg bg-white min-h-screen shadow-xl flex flex-col">
        {/* Header */}
        <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => router.push("/?tab=akademik")} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Daftar RPPH</h1>
        </header>

        {/* Filter Section */}
        <div className="px-4 pt-2 flex gap-2">
           <select 
             value={filterBulan} 
             onChange={(e) => setFilterBulan(e.target.value)}
             className="flex-1 border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-700"
           >
             <option value="">Semua Bulan</option>
             {monthNames.map(m => <option key={m} value={m}>{m}</option>)}
           </select>
           <select
             value={filterTahun}
             onChange={(e) => setFilterTahun(e.target.value)}
             className="w-1/3 border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-700"
           >
             <option value="">Tahun</option>
             {years.map(y => <option key={y} value={y}>{y}</option>)}
           </select>
        </div>

        {/* Content List */}
        <div className="p-4 space-y-4">
            {filteredList.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <h3 className="font-semibold text-gray-700">Tidak Ditemukan</h3>
                    <p className="text-gray-500 text-sm mt-1">Tidak ada data RPPH sesuai filter yang dipilih.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredList.map(item => (
                        <div key={item.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex justify-between items-center gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>{item.tanggal}</span>
                                </div>
                                <h3 className="font-bold text-gray-800 text-sm">{item.tema}</h3>
                                <p className="text-xs text-gray-600">{item.subTema}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedRPPH(item)}
                                className="p-2 bg-purple-50 text-[#581c87] rounded-lg hover:bg-purple-100 transition"
                            >
                                <Eye className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Modal Preview */}
        {selectedRPPH && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
                    <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl sticky top-0 z-10">
                        <div>
                            <h3 className="font-bold text-gray-800">Detail RPPH</h3>
                            <p className="text-xs text-gray-500">{selectedRPPH.tanggal}</p>
                        </div>
                        <button onClick={() => setSelectedRPPH(null)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="p-6 overflow-y-auto">
                        <div className="mb-4 bg-purple-50 p-3 rounded-lg border border-purple-100">
                            <p className="text-xs text-purple-800 font-semibold">Tema</p>
                            <p className="text-sm text-gray-800">{selectedRPPH.tema}</p>
                            <div className="h-px bg-purple-200 my-2"></div>
                            <p className="text-xs text-purple-800 font-semibold">Sub Tema</p>
                            <p className="text-sm text-gray-800">{selectedRPPH.subTema}</p>
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-700">
                            <div dangerouslySetInnerHTML={{ __html: selectedRPPH.content }} />
                        </div>
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}