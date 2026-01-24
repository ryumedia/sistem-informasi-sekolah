// d:\Private\Ryumedia\sistem-informasi-sekolah\src\components\dashboard\JadwalView.tsx
"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ArrowLeft, Clock } from "lucide-react";

export default function JadwalView({ user, userData, onBack }: { user: any, userData: any, onBack: () => void }) {
  const [jadwalList, setJadwalList] = useState<any[]>([]);
  const [selectedJadwalId, setSelectedJadwalId] = useState<string>("");
  const [jadwalDetails, setJadwalDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    const fetchJadwal = async () => {
      try {
        let q;
        const role = userData?.role;
        const cabang = userData?.cabang;
        const kelas = userData?.kelas;

        if (["Admin", "Direktur", "Yayasan"].includes(role)) {
           q = query(collection(db, "jadwal"));
        } else if (role === "Kepala Sekolah") {
           q = query(collection(db, "jadwal"), where("cabang", "==", cabang));
        } else if (role === "Guru" || role === "Asisten Guru") {
           let targetKelas = kelas;
           if (!targetKelas) {
              const qKelas = query(collection(db, "kelas"), where("cabang", "==", cabang));
              const snapKelas = await getDocs(qKelas);
              const foundClass = snapKelas.docs.find(doc => {
                  const d = doc.data();
                  if (role === "Guru" && Array.isArray(d.guruKelas)) {
                    return d.guruKelas.includes(userData.nama);
                  }
                  if (role === "Asisten Guru" && Array.isArray(d.asistenGuru)) {
                    return d.asistenGuru.includes(userData.nama);
                  }
                  return false;
              });
              if (foundClass) targetKelas = foundClass.data().namaKelas;
           }
           if (targetKelas) {
             q = query(collection(db, "jadwal"), where("cabang", "==", cabang), where("kelas", "==", targetKelas));
           } else {
             q = query(collection(db, "jadwal"), where("cabang", "==", cabang));
           }
        } else {
           q = query(collection(db, "jadwal"), where("cabang", "==", cabang), where("kelas", "==", kelas));
        }

        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        items.sort((a: any, b: any) => (a.kelas || "").localeCompare(b.kelas || ""));
        
        setJadwalList(items);
        
        if (items.length === 1) {
          setSelectedJadwalId(items[0].id);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchJadwal();
  }, [userData]);

  useEffect(() => {
    if (!selectedJadwalId) {
        setJadwalDetails([]);
        return;
    }
    const fetchDetails = async () => {
      setLoadingDetails(true);
      try {
        const q = query(collection(db, "jadwal_detil"), where("jadwalId", "==", selectedJadwalId));
        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        const dayOrder: any = { "Senin": 1, "Selasa": 2, "Rabu": 3, "Kamis": 4, "Jumat": 5, "Sabtu": 6, "Minggu": 7 };
        items.sort((a: any, b: any) => {
            const da = dayOrder[a.hari] || 99;
            const db = dayOrder[b.hari] || 99;
            if (da !== db) return da - db;
            return (a.waktu || "").localeCompare(b.waktu || "");
        });
        setJadwalDetails(items);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedJadwalId]);

  const selectedJadwal = jadwalList.find(j => j.id === selectedJadwalId);
  const pageTitle = selectedJadwal 
    ? `Jadwal Kelas ${selectedJadwal.kelas} ${selectedJadwal.cabang}` 
    : "Jadwal Pelajaran";

  const groupedDetails = jadwalDetails.reduce((acc: any, curr: any) => {
    if (!acc[curr.hari]) acc[curr.hari] = [];
    acc[curr.hari].push(curr);
    return acc;
  }, {});

  const dayOrder = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const sortedDays = Object.keys(groupedDetails).sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));

  return (
    <div className="flex-1 bg-gray-50 min-h-screen flex flex-col">
       <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800 line-clamp-1">{pageTitle}</h1>
       </header>

       <div className="p-4 space-y-4">
          {loading ? (
             <div className="text-center py-10 text-gray-500">Memuat jadwal...</div>
          ) : jadwalList.length === 0 ? (
             <div className="text-center py-10 text-gray-500">Tidak ada jadwal ditemukan.</div>
          ) : (
             <>
                {jadwalList.length > 1 && (
                  <div className="bg-white p-4 rounded-xl shadow-sm">
                    <label className="block text-xs font-medium text-gray-500 mb-2">Pilih Kelas</label>
                    <select className="w-full border rounded-lg p-2 text-sm" value={selectedJadwalId} onChange={(e) => setSelectedJadwalId(e.target.value)}>
                      <option value="">-- Pilih Kelas --</option>
                      {jadwalList.map((j: any) => (
                        <option key={j.id} value={j.id}>{j.cabang} - {j.kelas}</option>
                      ))}
                    </select>
                  </div>
                )}

                {selectedJadwalId ? (
                   loadingDetails ? <div className="text-center py-10 text-gray-500">Memuat detail...</div> : jadwalDetails.length === 0 ? <div className="text-center py-10 text-gray-500">Belum ada kegiatan diatur.</div> : (
                      <div className="space-y-4">{sortedDays.map(day => (<div key={day} className="bg-white rounded-xl shadow-sm overflow-hidden"><div className="bg-[#581c87]/10 px-4 py-2 border-b border-[#581c87]/10"><h3 className="font-bold text-[#581c87]">{day}</h3></div><div className="divide-y divide-gray-100">{groupedDetails[day].map((item: any) => (<div key={item.id} className="p-4 flex gap-4 items-start"><div className="flex items-center gap-2 text-gray-500 min-w-[80px]"><Clock className="w-4 h-4" /><span className="text-xs font-mono">{item.waktu}</span></div><div className="flex-1"><p className="text-sm font-medium text-gray-800">{item.aktivitas}</p></div></div>))}</div></div>))}</div>
                   )
                ) : (jadwalList.length > 1 && <div className="text-center py-10 text-gray-400">Silakan pilih kelas terlebih dahulu.</div>)}
             </>
          )}
       </div>
    </div>
  );
}
