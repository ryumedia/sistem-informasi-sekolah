// d:\Private\Ryumedia\sistem-informasi-sekolah\src\components\dashboard\KegiatanView.tsx
"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ArrowLeft, Calendar, MapPin, X } from "lucide-react";

export default function KegiatanView({ user, userData, onBack }: { user: any, userData: any, onBack: () => void }) {
  const [kegiatanList, setKegiatanList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDetail, setViewDetail] = useState<any | null>(null);

  useEffect(() => {
    const fetchKegiatan = async () => {
      try {
        let q;
        const role = userData?.role;
        const cabang = userData?.cabang;
        const kelas = userData?.kelas;

        if (["Admin", "Direktur", "Yayasan"].includes(role)) {
           q = query(collection(db, "kegiatan"));
        } else {
           if (cabang && kelas) {
             q = query(collection(db, "kegiatan"), where("cabang", "==", cabang), where("kelas", "==", kelas));
           } else if (cabang) {
             q = query(collection(db, "kegiatan"), where("cabang", "==", cabang));
           } else {
             q = query(collection(db, "kegiatan"), where("cabang", "==", "Unknown"));
           }
        }

        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setKegiatanList(items);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchKegiatan();
  }, [userData]);

  return (
    <div className="flex-1 bg-gray-50 min-h-screen flex flex-col">
       <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Daftar Kegiatan</h1>
       </header>

       <div className="p-4 space-y-4">
          {loading ? (
             <div className="text-center py-10 text-gray-500">Memuat kegiatan...</div>
          ) : kegiatanList.length === 0 ? (
             <div className="text-center py-10 text-gray-500">Tidak ada kegiatan ditemukan.</div>
          ) : (
             <div className="space-y-3">
               {kegiatanList.map((item) => (
                 <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer" onClick={() => setViewDetail(item)}>
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-800">{item.tema}</h3>
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full">{item.cabang}</span>
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                            <p>{item.kelas}</p>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                            <p>{item.bulan}</p>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                            <p>{item.semester}</p>
                        </div>
                    </div>
                 </div>
               ))}
             </div>
          )}
       </div>

        {viewDetail && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewDetail(null)}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                <h3 className="font-bold text-gray-800">Detail Kegiatan</h3>
                <button onClick={() => setViewDetail(null)} className="text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                </button>
                </div>
                <div className="p-6 overflow-y-auto space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                    <div><p className="text-gray-500 text-xs">Cabang</p><p className="font-medium">{viewDetail.cabang}</p></div>
                    <div><p className="text-gray-500 text-xs">Kelas</p><p className="font-medium">{viewDetail.kelas}</p></div>
                    <div><p className="text-gray-500 text-xs">Semester</p><p className="font-medium">{viewDetail.semester}</p></div>
                    <div><p className="text-gray-500 text-xs">Bulan</p><p className="font-medium">{viewDetail.bulan}</p></div>
                    <div><p className="text-gray-500 text-xs">Tema</p><p className="font-medium">{viewDetail.tema}</p></div>
                    <div><p className="text-gray-500 text-xs">Term</p><p className="font-medium">{viewDetail.term}</p></div>
                    <div className="sm:col-span-3"><p className="text-gray-500 text-xs">Waktu Kegiatan</p><p className="font-medium">{viewDetail.waktuKegiatan}</p></div>
                </div>
                
                <div className="space-y-3 text-sm">
                    <div className="border-t pt-3">
                        <p className="text-gray-500 text-xs mb-1">Pembiasaan dan Islamic Behavior</p>
                        <p className="font-medium whitespace-pre-wrap">{viewDetail.pembiasaan || "-"}</p>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-gray-500 text-xs mb-1">Tujuan Pembelajaran</p>
                        <p className="font-medium whitespace-pre-wrap">{viewDetail.tujuanPembelajaran || "-"}</p>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-gray-500 text-xs mb-1">Week 1</p>
                        <p className="font-medium whitespace-pre-wrap">{viewDetail.week1 || "-"}</p>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-gray-500 text-xs mb-1">Week 2</p>
                        <p className="font-medium whitespace-pre-wrap">{viewDetail.week2 || "-"}</p>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-gray-500 text-xs mb-1">Week 3</p>
                        <p className="font-medium whitespace-pre-wrap">{viewDetail.week3 || "-"}</p>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-gray-500 text-xs mb-1">Week 4</p>
                        <p className="font-medium whitespace-pre-wrap">{viewDetail.week4 || "-"}</p>
                    </div>
                    <div className="border-t pt-3">
                        <p className="text-gray-500 text-xs mb-1">Catatan</p>
                        <p className="font-medium whitespace-pre-wrap">{viewDetail.catatan || "-"}</p>
                    </div>
                </div>
                </div>
            </div>
            </div>
        )}
    </div>
  );
}
