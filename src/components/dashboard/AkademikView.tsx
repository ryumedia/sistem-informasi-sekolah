// d:\Private\Ryumedia\sistem-informasi-sekolah\src\components\dashboard\AkademikView.tsx
"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ArrowLeft, Shield, User, BarChart, Target, Triangle, Users, StickyNote, BookCopy, Calendar } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

export default function AkademikView({ user, userData, onBack }: { user: any, userData: any, onBack: () => void }) {
  const [waliKelas, setWaliKelas] = useState("-");
  const [loading, setLoading] = useState(false);
  const [catatanList, setCatatanList] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (userData?.role === "Siswa" && userData?.kelas && userData?.cabang) {
      const fetchWali = async () => {
        setLoading(true);
        try {
           const q = query(collection(db, "kelas"), where("namaKelas", "==", userData.kelas), where("cabang", "==", userData.cabang));
           const snap = await getDocs(q);
           if (!snap.empty) {
             const data = snap.docs[0].data();
             const guru = data.guruKelas || data.waliKelas;
             if (Array.isArray(guru)) {
                setWaliKelas(guru.map((g: any) => typeof g === 'string' ? g : g.nama).join(", "));
             } else if (typeof guru === 'object' && guru !== null) {
                setWaliKelas(guru.nama || "-");
             } else {
                setWaliKelas(guru || "-");
             }
           }
        } catch (e) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      };
      fetchWali();
    }
  }, [userData]);

  useEffect(() => {
    if (userData?.role === "Siswa" && userData?.id) {
      const fetchCatatan = async () => {
        try {
          const q = query(collection(db, "catatan_guru"), where("siswaId", "==", userData.id));
          const snap = await getDocs(q);
          const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          items.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setCatatanList(items);
        } catch (e) {
          console.error("Error fetching catatan:", e);
        }
      };
      fetchCatatan();
    }
  }, [userData]);

  if (!["Siswa", "Guru"].includes(userData?.role)) {
    return (
      <div className="flex-1 bg-gray-50 min-h-screen flex flex-col items-center justify-center p-6 text-center">
         <Shield className="w-16 h-16 text-gray-300 mb-4" />
         <h2 className="text-xl font-bold text-gray-800">Akses Dibatasi</h2>
         <p className="text-gray-500 mt-2">Halaman ini hanya dapat diakses oleh Siswa dan Guru.</p>
         <button onClick={onBack} className="mt-6 text-[#581c87] font-medium hover:underline">Kembali ke Home</button>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-gray-50 min-h-screen flex flex-col">
       <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="text-lg font-bold text-gray-800">Akademik</h1>
       </header>

       <div className="p-6 space-y-6">
          {userData?.role === "Siswa" ? (
            <>
              <div className="bg-white p-5 rounded-2xl shadow-sm flex items-center gap-5">
                 <div className="flex flex-col items-center text-center w-1/3 shrink-0">
                     <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center text-[#581c87] mb-2 overflow-hidden shadow-sm">
                    {userData.foto ? (
                      <img src={userData.foto} alt={userData.nama} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8" />
                    )}
                 </div>
                     <h2 className="text-sm font-bold text-gray-800 leading-tight">{userData.nama}</h2>
                     <p className="text-xs text-gray-500 mt-0.5">{userData.nisn || "-"}</p>
                 </div>

                 <div className="flex-1 border-l border-gray-100 pl-5 space-y-3">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Kelas</p>
                      <p className="font-bold text-gray-700 text-base">{userData.kelas || "-"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">Wali Kelas</p>
                      <p className="font-medium text-gray-700 text-sm">{loading ? "..." : waliKelas}</p>
                    </div>
                 </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Menu Akademik</h3>
                <div className="grid grid-cols-3 gap-3">
                   <MenuButton icon={<BarChart className="w-6 h-6 text-blue-600"/>} label="Perkembangan" color="bg-blue-50" onClick={() => router.push('/siswa/perkembangan')} />
                   <MenuButton icon={<Target className="w-6 h-6 text-orange-600"/>} label="Indikator" color="bg-orange-50" onClick={() => router.push('/siswa/indikator')} />
                   <MenuButton icon={<Triangle className="w-6 h-6 text-purple-600"/>} label="Trilogi" color="bg-purple-50" onClick={() => router.push('/siswa/trilogi')} />
                </div>
              </div>

              <div className="mt-6">
                <h3 className="font-semibold text-gray-800 mb-3">Catatan Guru</h3>
                <div className="space-y-3">
                  {catatanList.length === 0 ? (
                    <div className="text-center py-6 bg-white rounded-xl border border-dashed border-gray-200">
                      <p className="text-xs text-gray-400">Belum ada catatan dari guru.</p>
                    </div>
                  ) : (
                    catatanList.map((note) => (
                      <div key={note.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center gap-2 mb-2">
                           <Calendar className="w-3 h-3 text-gray-400" />
                           <span className="text-xs text-gray-500 font-medium">{formatDate(note.createdAt)}</span>
                        </div>
                        <p className="text-sm text-gray-700 leading-relaxed">{note.catatan}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <div className="bg-[#581c87]/5 p-4 rounded-xl mb-6 border border-[#581c87]/10">
                   <h2 className="font-bold text-[#581c87]">Halo, {userData.nama}</h2>
                   <p className="text-sm text-gray-600">Silakan pilih menu akademik di bawah ini.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <MenuButtonLarge icon={<Users className="w-8 h-8 text-blue-600"/>} label="Daftar Siswa" desc="Data siswa di kelas" color="bg-blue-50" onClick={() => router.push('/guru/daftar-siswa')} />
                   <MenuButtonLarge icon={<BarChart className="w-8 h-8 text-green-600"/>} label="Perkembangan" desc="Nilai perkembangan" color="bg-green-50" onClick={() => router.push('/guru/perkembangan')} />
                   <MenuButtonLarge icon={<Target className="w-8 h-8 text-orange-600"/>} label="Indikator" desc="Capaian indikator" color="bg-orange-50" onClick={() => router.push('/guru/indikator')} />
                   <MenuButtonLarge icon={<Triangle className="w-8 h-8 text-purple-600"/>} label="Trilogi" desc="Nilai trilogi" color="bg-purple-50" onClick={() => router.push('/guru/trilogi')} />
                   <MenuButtonLarge icon={<StickyNote className="w-8 h-8 text-yellow-600"/>} label="Catatan" desc="Catatan anekdot" color="bg-yellow-50" onClick={() => router.push('/guru/catatan')} />
                   <MenuButtonLarge icon={<BookCopy className="w-8 h-8 text-pink-600"/>} label="RPPH" desc="Rencana pembelajaran" color="bg-pink-50" onClick={() => router.push('/guru/rpph')} />
                </div>
              </div>
            </>
          )}
       </div>
    </div>
  );
}

function MenuButton({ icon, label, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center p-4 rounded-xl ${color} hover:opacity-80 transition h-28 w-full`}>
      <div className="mb-2">{icon}</div>
      <span className="text-xs font-medium text-gray-700 text-center">{label}</span>
    </button>
  )
}

function MenuButtonLarge({ icon, label, desc, color, onClick }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-start p-4 rounded-xl ${color} hover:opacity-80 transition text-left h-32 w-full`}>
      <div className="mb-3 bg-white/60 p-2 rounded-lg">{icon}</div>
      <span className="font-bold text-gray-800">{label}</span>
      <span className="text-xs text-gray-500">{desc}</span>
    </button>
  )
}
