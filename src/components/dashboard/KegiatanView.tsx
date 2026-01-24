// d:\Private\Ryumedia\sistem-informasi-sekolah\src\components\dashboard\KegiatanView.tsx
"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";

export default function KegiatanView({ user, userData, onBack }: { user: any, userData: any, onBack: () => void }) {
  const [kegiatanList, setKegiatanList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKegiatan = async () => {
      try {
        let q;
        const role = userData?.role;
        const cabang = userData?.cabang;

        if (["Admin", "Direktur", "Yayasan"].includes(role)) {
           q = query(collection(db, "kegiatan"));
        } else {
           if (cabang) {
             q = query(collection(db, "kegiatan"), where("cabang", "==", cabang));
           } else {
             q = query(collection(db, "kegiatan"), where("cabang", "==", "Unknown"));
           }
        }

        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a: any, b: any) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
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
                 <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-gray-800">{item.nama}</h3>
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-full">{item.cabang}</span>
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                            <Calendar className="w-3 h-3" />
                            <span>{item.tanggal}</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500 text-xs">
                            <MapPin className="w-3 h-3" />
                            <span>{item.lokasi}</span>
                        </div>
                    </div>
                    <p className="text-sm text-gray-600 border-t pt-2 mt-2">{item.keterangan}</p>
                 </div>
               ))}
             </div>
          )}
       </div>
    </div>
  );
}
