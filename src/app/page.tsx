// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import {
  onAuthStateChanged,
  signOut,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword,
} from "firebase/auth";
import { collection, query, where, getDocs, addDoc, orderBy, limit } from "firebase/firestore";
import { BookOpen, Calendar, Bell, User, LogOut, Shield, Home, KeyRound, X, Activity, FileText, FilePlus, ArrowLeft, Clock, MapPin, Info, Users, BarChart, Target, Triangle, StickyNote, BookCopy } from "lucide-react";

export default function UserHome() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home"); // 'home' | 'akademik' | 'akun'
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [isPengajuanModalOpen, setPengajuanModalOpen] = useState(false);
  const [latestPengumuman, setLatestPengumuman] = useState<any[]>([]);
  const [selectedPengumuman, setSelectedPengumuman] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      // Ambil data detail user dari Firestore (Cek koleksi 'guru' dulu)
      try {
        const qGuru = query(collection(db, "guru"), where("email", "==", currentUser.email));
        const snapshotGuru = await getDocs(qGuru);
        
        if (!snapshotGuru.empty) {
          // Jika ditemukan di data Guru
          setUserData({ id: snapshotGuru.docs[0].id, ...snapshotGuru.docs[0].data() });
        } else {
          // Jika tidak ada di 'guru', cek di koleksi 'siswa'
          const qSiswa = query(collection(db, "siswa"), where("email", "==", currentUser.email));
          const snapshotSiswa = await getDocs(qSiswa);

          if (!snapshotSiswa.empty) {
            setUserData({ id: snapshotSiswa.docs[0].id, ...snapshotSiswa.docs[0].data() });
          } else {
            // Jika tidak ditemukan di keduanya
            setUserData({ nama: currentUser.email, role: "User" });
          }
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Fetch Latest Pengumuman for Dashboard
  useEffect(() => {
    const fetchLatestPengumuman = async () => {
      if (!userData) return;
      try {
        let q;
        const role = userData?.role;
        const cabang = userData?.cabang;

        if (["Admin", "Direktur", "Yayasan"].includes(role)) {
           q = query(collection(db, "pengumuman"), orderBy("createdAt", "desc"), limit(3));
        } else {
           if (cabang) {
             // Mengambil data berdasarkan cabang, sorting dilakukan di client-side untuk menghindari error index
             q = query(collection(db, "pengumuman"), where("cabang", "==", cabang));
           } else {
             q = query(collection(db, "pengumuman"), where("cabang", "==", "Unknown"));
           }
        }

        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Sort client side (terutama untuk query 'where' yang tidak pakai orderBy di server)
        items.sort((a: any, b: any) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });

        setLatestPengumuman(items.slice(0, 3));
      } catch (err) {
        console.error("Error fetching latest pengumuman:", err);
      }
    };
    fetchLatestPengumuman();
  }, [userData]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">Memuat...</div>;
  }

  return (
    <main className="min-h-screen bg-gray-200 flex justify-center items-start">
      {/* Container Mobile - max-w-lg */}
      <div className="w-full max-w-lg bg-white min-h-screen shadow-2xl flex flex-col">
        
        {/* KONTEN: HOME */}
        {activeTab === "home" && (
          <>
            {/* Header */}
            <header className="bg-[#581c87] text-white p-6 rounded-b-3xl shadow-md flex flex-col items-center">
              <div className="mb-3">
                <Image 
                  src="/logo.png" 
                  alt="Logo Sekolah" 
                  width={70} 
                  height={70} 
                  className="object-contain"
                />
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold">Halo, {userData?.nama?.split(" ")[0] || "User"}!</h1>
                <p className="text-purple-200 text-sm">Selamat datang di SIS Main Riang</p>
              </div>
            </header>

            {/* Content Body */}
            <div className="flex-1 p-6 space-y-6">
              {/* Quick Menu Grid */}
              <section>
                <h2 className="font-semibold text-gray-800 mb-3">Menu Utama</h2>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { name: "Jadwal", icon: <Calendar className="w-6 h-6 text-[#581c87]"/>, color: "bg-[#581c87]/10", action: () => setActiveTab("jadwal") },
                    { name: "Kegiatan", icon: <Activity className="w-6 h-6 text-green-600"/>, color: "bg-green-50", action: () => setActiveTab("kegiatan") },
                    { name: "Pengumuman", icon: <Bell className="w-6 h-6 text-[#ff984e]"/>, color: "bg-[#ff984e]/10", action: () => setActiveTab("pengumuman") },
                    { name: "Dokumen", icon: <FileText className="w-6 h-6 text-[#581c87]"/>, color: "bg-[#581c87]/10", action: () => router.push("/guru/dokumen") },
                  ].map((item, idx) => (
                    <div key={idx} onClick={item.action} className="flex flex-col items-center gap-2 cursor-pointer">
                      <div className={`p-4 rounded-2xl ${item.color} shadow-sm`}>
                        {item.icon}
                      </div>
                      <span className="text-xs font-medium text-gray-600">{item.name}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Pengumuman Card */}
              <section>
                <div className="flex justify-between items-center mb-3">
                  <h2 className="font-semibold text-gray-800">Pengumuman Terbaru</h2>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
                  {latestPengumuman.length === 0 ? (
                    <p className="text-xs text-gray-500 italic text-center py-2">Belum ada pengumuman terbaru.</p>
                  ) : (
                    latestPengumuman.map((item, idx) => (
                      <div 
                        key={item.id} 
                        onClick={() => setSelectedPengumuman(item)}
                        className={`cursor-pointer hover:bg-gray-50 transition p-2 rounded-lg -mx-2 ${idx !== latestPengumuman.length - 1 ? 'border-b border-gray-100 pb-2 mb-1' : ''}`}
                      >
                        <h3 className="font-medium text-sm text-gray-800 line-clamp-1">{item.judul}</h3>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.deskripsi}</p>
                        <p className="text-[10px] text-gray-400 mt-1 text-right">{formatDate(item.createdAt)}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </>
        )}

        {/* KONTEN: JADWAL */}
        {activeTab === "jadwal" && (
          <JadwalView user={user} userData={userData} onBack={() => setActiveTab("home")} />
        )}

        {/* KONTEN: AKADEMIK */}
        {activeTab === "akademik" && (
          <AkademikView user={user} userData={userData} onBack={() => setActiveTab("home")} />
        )}

        {/* KONTEN: KEGIATAN */}
        {activeTab === "kegiatan" && (
          <KegiatanView user={user} userData={userData} onBack={() => setActiveTab("home")} />
        )}

        {/* KONTEN: PENGUMUMAN */}
        {activeTab === "pengumuman" && (
          <PengumumanView user={user} userData={userData} onBack={() => setActiveTab("home")} onSelect={setSelectedPengumuman} />
        )}

        {/* KONTEN: AKUN */}
        {activeTab === "akun" && (
          <div className="flex-1 bg-gray-50">
            <header className="bg-white p-6 shadow-sm sticky top-0 z-10">
              <h1 className="text-xl font-bold text-gray-800">Profil Saya</h1>
            </header>
            
            <div className="p-6 space-y-6">
              {/* Profile Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm flex items-center gap-4">
                <div className="w-16 h-16 bg-[#581c87]/10 rounded-full flex items-center justify-center text-[#581c87]">
                  <User className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-800 text-lg">{userData?.nama || "User"}</h2>
                  <p className="text-gray-500 text-sm">{user?.email}</p>
                  <span className="inline-block mt-2 px-3 py-1 bg-[#581c87]/10 text-[#581c87] text-xs font-medium rounded-full">
                    {userData?.role || "Siswa"}
                  </span>
                </div>
              </div>

              {/* Menu Akun */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Tombol Khusus Admin */}
                {["Admin", "Kepala Sekolah", "Direktur", "Yayasan", "Guru"].includes(userData?.role) && (
                  <Link href="/admin" className="flex items-center gap-3 p-4 hover:bg-gray-50 border-b border-gray-100 transition">
                    <div className="bg-[#581c87]/10 p-2 rounded-lg text-[#581c87]">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">Panel Admin</h3>
                      <p className="text-xs text-gray-500">Kelola data sekolah</p>
                    </div>
                  </Link>
                )}

                {/* Tombol Pengajuan Anggaran */}
                {["Guru", "Admin", "Kepala Sekolah", "Direktur", "Yayasan"].includes(userData?.role) && (
                  <button onClick={() => setPengajuanModalOpen(true)} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 border-b border-gray-100 transition text-left">
                    <div className="bg-green-100 p-2 rounded-lg text-green-600">
                      <FilePlus className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">Pengajuan Anggaran</h3>
                      <p className="text-xs text-gray-500">Ajukan dana operasional</p>
                    </div>
                  </button>
                )}

                {/* Tombol Ubah Password */}
                <button onClick={() => setPasswordModalOpen(true)} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 border-b border-gray-100 transition text-left">
                  <div className="bg-gray-100 p-2 rounded-lg text-gray-600">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">Ubah Password</h3>
                    <p className="text-xs text-gray-500">Ganti password login Anda</p>
                  </div>
                </button>


                <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 hover:bg-red-50 transition text-left">
                  <div className="bg-red-100 p-2 rounded-lg text-red-600">
                    <LogOut className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-medium text-red-600">Keluar Aplikasi</h3>
                    <p className="text-xs text-gray-400">Logout dari akun ini</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {isPasswordModalOpen && (
          <ChangePasswordModal user={user} onClose={() => setPasswordModalOpen(false)} />
        )}

        {isPengajuanModalOpen && (
          <PengajuanModal user={user} userData={userData} onClose={() => setPengajuanModalOpen(false)} />
        )}

        {selectedPengumuman && (
          <PengumumanDetailModal data={selectedPengumuman} onClose={() => setSelectedPengumuman(null)} />
        )}

        {/* Bottom Navigation */}
        <nav className="border-t p-4 flex justify-around text-gray-400 bg-white sticky bottom-0">
           <button 
             onClick={() => setActiveTab("home")}
             className={`flex flex-col items-center ${activeTab === "home" ? "text-[#581c87]" : "text-gray-400"}`}
           >
             <Home className="w-6 h-6 mb-1" />
             <span className="text-[10px]">Home</span>
           </button>
           
           <button 
             onClick={() => setActiveTab("akademik")}
             className={`flex flex-col items-center ${activeTab === "akademik" ? "text-[#581c87]" : "text-gray-400"}`}
           >
             <BookOpen className="w-6 h-6 mb-1" />
             <span className="text-[10px]">Akademik</span>
           </button>
           
           <button 
             onClick={() => setActiveTab("akun")}
             className={`flex flex-col items-center ${activeTab === "akun" ? "text-[#581c87]" : "text-gray-400"}`}
           >
             <User className="w-6 h-6 mb-1" />
             <span className="text-[10px]">Akun</span>
           </button>
        </nav>
      </div>
    </main>
  );
}

// Helper Date Formatter
const formatDate = (timestamp: any) => {
  if (!timestamp) return "";
  const date = new Date(timestamp.seconds * 1000);
  return date.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' });
};

// Komponen Modal Ubah Password
function ChangePasswordModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Password baru tidak cocok.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }

    setSubmitting(true);

    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      // Re-autentikasi user
      await reauthenticateWithCredential(user, credential);
      // Jika berhasil, update password
      await updatePassword(user, newPassword);
      setSuccess("Password berhasil diubah!");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setError("Password lama salah.");
      } else {
        setError("Gagal mengubah password. Silakan coba lagi.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">Ubah Password</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {success && <p className="text-green-500 text-sm">{success}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Lama</label>
            <input required type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full border rounded-lg p-2 text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
            <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border rounded-lg p-2 text-gray-900" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
            <input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border rounded-lg p-2 text-gray-900" />
          </div>
          <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 disabled:opacity-50">
            {submitting ? "Menyimpan..." : "Simpan Password"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Komponen View Akademik
function AkademikView({ user, userData, onBack }: { user: any, userData: any, onBack: () => void }) {
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

  // Fetch Catatan Guru untuk Siswa
  useEffect(() => {
    if (userData?.role === "Siswa" && userData?.id) {
      const fetchCatatan = async () => {
        try {
          const q = query(collection(db, "catatan_guru"), where("siswaId", "==", userData.id));
          const snap = await getDocs(q);
          const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          // Sort by createdAt desc
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
              {/* Profil Siswa */}
              <div className="bg-white p-5 rounded-2xl shadow-sm flex items-center gap-5">
                 {/* Kiri: Foto, Nama, NISN */}
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

                 {/* Kanan: Kelas & Wali Kelas */}
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

              {/* Menu Siswa */}
              <div>
                <h3 className="font-semibold text-gray-800 mb-3">Menu Akademik</h3>
                <div className="grid grid-cols-3 gap-3">
                   <MenuButton icon={<BarChart className="w-6 h-6 text-blue-600"/>} label="Perkembangan" color="bg-blue-50" onClick={() => router.push('/siswa/perkembangan')} />
                   <MenuButton icon={<Target className="w-6 h-6 text-orange-600"/>} label="Indikator" color="bg-orange-50" onClick={() => router.push('/siswa/indikator')} />
                   <MenuButton icon={<Triangle className="w-6 h-6 text-purple-600"/>} label="Trilogi" color="bg-purple-50" onClick={() => router.push('/siswa/trilogi')} />
                </div>
              </div>

              {/* Daftar Catatan Guru */}
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
              {/* Menu Guru */}
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

// Komponen View Jadwal
function JadwalView({ user, userData, onBack }: { user: any, userData: any, onBack: () => void }) {
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
        } else if (role === "Guru") {
           // Guru melihat jadwal sesuai cabang dan kelas (jika ada data kelas di profil)
           let targetKelas = kelas;
           
           // Jika data kelas tidak ada di profil guru, cari di koleksi kelas
           if (!targetKelas) {
              const qKelas = query(collection(db, "kelas"), where("cabang", "==", cabang));
              const snapKelas = await getDocs(qKelas);
              const foundClass = snapKelas.docs.find(doc => {
                  const d = doc.data();
                  const g = d.guruKelas; 
                  if (Array.isArray(g)) {
                      return g.some((item: any) => (typeof item === 'string' ? item === userData.nama : item.nama === userData.nama));
                  }
                  return false;
              });
              if (foundClass) targetKelas = foundClass.data().namaKelas;
           }

           if (targetKelas) {
             q = query(collection(db, "jadwal"), where("cabang", "==", cabang), where("kelas", "==", targetKelas));
           } else {
             // Fallback jika Guru tidak memiliki data kelas spesifik, tampilkan semua di cabang tersebut
             q = query(collection(db, "jadwal"), where("cabang", "==", cabang));
           }
        } else {
           // Siswa melihat jadwal sesuai cabang dan kelasnya
           q = query(collection(db, "jadwal"), where("cabang", "==", cabang), where("kelas", "==", kelas));
        }

        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        // Sort client side berdasarkan kelas
        items.sort((a: any, b: any) => (a.kelas || "").localeCompare(b.kelas || ""));
        
        setJadwalList(items);
        
        // Auto select jika hanya ada satu jadwal
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
        
        // Sort Hari dan Waktu
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

  // Dynamic Title
  const selectedJadwal = jadwalList.find(j => j.id === selectedJadwalId);
  const pageTitle = selectedJadwal 
    ? `Jadwal Kelas ${selectedJadwal.kelas} ${selectedJadwal.cabang}` 
    : "Jadwal Pelajaran";

  // Group details by Day
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

// Komponen View Kegiatan
function KegiatanView({ user, userData, onBack }: { user: any, userData: any, onBack: () => void }) {
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
           // Kepala Sekolah, Guru, Siswa melihat kegiatan sesuai cabang
           if (cabang) {
             q = query(collection(db, "kegiatan"), where("cabang", "==", cabang));
           } else {
             q = query(collection(db, "kegiatan"), where("cabang", "==", "Unknown"));
           }
        }

        const snap = await getDocs(q);
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Sort client side by tanggal desc
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

// Komponen View Pengumuman
function PengumumanView({ user, userData, onBack, onSelect }: { user: any, userData: any, onBack: () => void, onSelect: (item: any) => void }) {
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
        
        // Sort client side by createdAt desc
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

// Komponen Modal Pengajuan Anggaran
function PengajuanModal({ user, userData, onClose }: { user: any; userData: any; onClose: () => void }) {
  const [nomenklaturList, setNomenklaturList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    tanggal: new Date().toISOString().split('T')[0],
    pengaju: userData?.nama || user?.displayName || "",
    cabang: userData?.cabang || "",
    nomenklatur: "",
    barang: "",
    harga: 0,
    qty: 1,
  });

  useEffect(() => {
    const fetchNomenklatur = async () => {
      try {
        const q = query(collection(db, "nomenklatur_keuangan"), orderBy("nama", "asc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setNomenklaturList(data);
      } catch (error) {
        console.error("Error fetching nomenklatur:", error);
      }
    };
    fetchNomenklatur();
  }, []);

  const totalHarga = formData.harga * formData.qty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await addDoc(collection(db, "pengajuan"), {
        tanggal: formData.tanggal,
        pengaju: formData.pengaju,
        cabang: formData.cabang,
        nomenklatur: formData.nomenklatur,
        barang: formData.barang,
        hargaSatuan: Number(formData.harga),
        qty: Number(formData.qty),
        total: totalHarga,
        status: "Menunggu KS", // Default status awal
        userId: user.uid,
        createdAt: new Date(),
      });
      alert("Pengajuan berhasil dikirim!");
      onClose();
    } catch (error) {
      console.error("Error submitting:", error);
      alert("Gagal mengirim pengajuan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 sticky top-0">
          <h3 className="font-bold text-gray-800">Form Pengajuan Anggaran</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal</label>
              <input required type="date" className="w-full border rounded-lg p-2 text-sm text-gray-900"
                value={formData.tanggal} onChange={(e) => setFormData({...formData, tanggal: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cabang</label>
              <input readOnly type="text" className="w-full border rounded-lg p-2 text-sm bg-gray-100 text-gray-600"
                value={formData.cabang} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nama Pengaju</label>
            <input readOnly type="text" className="w-full border rounded-lg p-2 text-sm bg-gray-100 text-gray-600"
              value={formData.pengaju} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nomenklatur (Pos Anggaran)</label>
            <select required className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900"
              value={formData.nomenklatur} onChange={(e) => setFormData({...formData, nomenklatur: e.target.value})}>
              <option value="">Pilih Nomenklatur</option>
              {nomenklaturList
                .filter((item: any) => item.kategori === "Pengeluaran")
                .map((item: any) => (
                <option key={item.id} value={item.nama}>{item.nama}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nama Barang / Jasa</label>
            <input required type="text" className="w-full border rounded-lg p-2 text-sm text-gray-900" placeholder="Contoh: Kertas HVS A4"
              value={formData.barang} onChange={(e) => setFormData({...formData, barang: e.target.value})} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Harga Satuan (Rp)</label>
              <input required type="text" className="w-full border rounded-lg p-2 text-sm text-gray-900"
                value={formData.harga === 0 ? "" : formData.harga.toLocaleString("id-ID")} 
                onChange={(e) => {
                  const rawValue = e.target.value.replace(/\./g, "");
                  if (!isNaN(Number(rawValue))) {
                    setFormData({...formData, harga: Number(rawValue)});
                  }
                }}
                placeholder="0" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
              <input required type="number" min="1" className="w-full border rounded-lg p-2 text-sm text-gray-900"
                value={formData.qty} onChange={(e) => setFormData({...formData, qty: Number(e.target.value)})} />
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <label className="block text-xs font-medium text-gray-500 mb-1">Total Harga</label>
            <div className="text-lg font-bold text-[#581c87]">
              Rp {totalHarga.toLocaleString("id-ID")}
            </div>
          </div>
          <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-3 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 disabled:opacity-50">
            {submitting ? "Mengirim..." : "Kirim Pengajuan"}
          </button>
        </form>
      </div>
    </div>
  );
}

// Komponen Modal Detail Pengumuman
function PengumumanDetailModal({ data, onClose }: { data: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto flex flex-col">
        <div className="p-4 border-b flex justify-between items-start bg-gray-50 sticky top-0">
          <div>
             <h3 className="font-bold text-gray-800 text-lg">{data.judul}</h3>
             <p className="text-xs text-gray-500 mt-1">{formatDate(data.createdAt)} • {data.cabang}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
          {data.deskripsi}
        </div>
      </div>
    </div>
  );
}
