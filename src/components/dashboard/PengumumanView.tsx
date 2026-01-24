// d:\Private\Ryumedia\sistem-informasi-sekolah\src\components\dashboard\PengumumanView.tsx
"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

export default function PengumumanView({ user, userData, onBack, onSelect }: { user: any, userData: any, onBack: () => void, onSelect: (item: any) => void }) {
  const [pengumumanList, setPengumumanList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPengumuman = async () => {
      try {
        let q;
        const role = userData?.role;
        const cabang = userData?.cabang;

        if (["Admin", "Direktur", "Yayasan"].includes(role)) {
           q = query(collection(db, "pengumuman"));
        } else {
           if (cabang) {
             q = query(collection(db, "pengumuman"), where("cabang", "==", cabang));
           } else {
             q = query(collection(db, "pengumuman"), where("cabang", "==", "Unknown"));
           }
        }

        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        items.sort((a: any, b: any) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });
        
        setPengumumanList(items);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPengumuman();
  }, [userData]);

  return (
    <div className="flex-1 bg-gray-50 min-h-screen flex flex-col">
       <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Pengumuman</h1>
       </header>

       <div className="p-4 space-y-4">
          {loading ? (
             <div className="text-center py-10 text-gray-500">Memuat pengumuman...</div>
          ) : pengumumanList.length === 0 ? (
             <div className="text-center py-10 text-gray-500">Tidak ada pengumuman.</div>
          ) : (
             <div className="space-y-3">
               {pengumumanList.map((item) => (
                 <div key={item.id} onClick={() => onSelect(item)} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition">
                    <div className="flex justify-between items-start mb-1">
                        <h3 className="font-bold text-gray-800 line-clamp-2">{item.judul}</h3>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{item.cabang}</span>
                        <span className="text-[10px] text-gray-400">{formatDate(item.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-3">{item.deskripsi}</p>
                 </div>
               ))}
             </div>
          )}
       </div>
    </div>
  );
}
