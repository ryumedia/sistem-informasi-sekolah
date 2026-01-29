// src/app/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, addDoc, orderBy, limit } from "firebase/firestore";
import { BookOpen, Calendar, Bell, User, LogOut, Shield, Home, KeyRound, Activity, FileText, FilePlus } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

import ChangePasswordModal from "../components/dashboard/changePasswordModal";
import AkademikView from "../components/dashboard/AkademikView";
import CaregiverReportView from "../components/dashboard/CaregiverReportView"; // Import CaregiverReportView
import ReportView from "../components/dashboard/ReportView"; // Import ReportView
import JadwalView from "../components/dashboard/JadwalView";
import KegiatanView from "../components/dashboard/KegiatanView";
import PengumumanView from "../components/dashboard/PengumumanView";
import PengajuanModal from "../components/dashboard/PengajuanModal";
import PengumumanDetailModal from "../components/dashboard/PengumumanDetailModal";

export default function UserHome() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [jenjangKelas, setJenjangKelas] = useState(""); // State untuk jenjang kelas siswa
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [isPengajuanModalOpen, setPengajuanModalOpen] = useState(false);
  const [latestPengumuman, setLatestPengumuman] = useState<any[]>([]);
  const [selectedPengumuman, setSelectedPengumuman] = useState<any>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && ["home", "jadwal", "akademik", "report", "kegiatan", "pengumuman", "akun"].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      try {
        const qGuru = query(collection(db, "guru"), where("email", "==", currentUser.email));
        const snapshotGuru = await getDocs(qGuru);
        
        if (!snapshotGuru.empty) {
          setUserData({ id: snapshotGuru.docs[0].id, ...snapshotGuru.docs[0].data() });
        } else {
          const qSiswa = query(collection(db, "siswa"), where("email", "==", currentUser.email));
          const snapshotSiswa = await getDocs(qSiswa);

          if (!snapshotSiswa.empty) {
            const siswaData = snapshotSiswa.docs[0].data();
            setUserData({ id: snapshotSiswa.docs[0].id, ...siswaData });

            // Jika siswa, ambil jenjang kelasnya
            if (siswaData.kelas) {
              // LOGIKA DIPERBAIKI: Query koleksi 'kelas' berdasarkan field 'nama'
              const qKelas = query(collection(db, "kelas"), where("namaKelas", "==", siswaData.kelas));
              const snapshotKelas = await getDocs(qKelas);

              if (!snapshotKelas.empty) {
                const kelasData = snapshotKelas.docs[0].data();
                const jenjangNama = kelasData.jenjangKelas;
                if (jenjangNama) {
                  setJenjangKelas(jenjangNama);
                }
              } else {
                console.error("Tidak bisa menemukan dokumen kelas dengan nama:", siswaData.kelas);
              }
            }
          } else {
            const qCaregiver = query(collection(db, "caregivers"), where("email", "==", currentUser.email));
            const snapshotCaregiver = await getDocs(qCaregiver);

            if (!snapshotCaregiver.empty) {
              setUserData({ id: snapshotCaregiver.docs[0].id, ...snapshotCaregiver.docs[0].data() });
            } else {
              setUserData({ nama: currentUser.email, role: "User" });
            }
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

  // Tentukan tombol navigasi akademik/report
  const renderAkademikButton = () => {
    if ((userData?.role === "Siswa" && jenjangKelas === "Daycare") || userData?.role === "Caregiver") {
      return (
        <button 
          onClick={() => setActiveTab("report")}
          className={`flex flex-col items-center ${activeTab === "report" ? "text-[#581c87]" : "text-gray-400"}`}
        >
          <FileText className="w-6 h-6 mb-1" />
          <span className="text-[10px]">Report</span>
        </button>
      );
    }
    // Sembunyikan untuk role selain siswa dan guru
    if (!["Siswa", "Guru"].includes(userData?.role)) {
      return null;
    }
    return (
      <button 
        onClick={() => setActiveTab("akademik")}
        className={`flex flex-col items-center ${activeTab === "akademik" ? "text-[#581c87]" : "text-gray-400"}`}
      >
        <BookOpen className="w-6 h-6 mb-1" />
        <span className="text-[10px]">Akademik</span>
      </button>
    );
  };

  return (
    <main className="min-h-screen bg-gray-200 flex justify-center items-start">
      <div className="w-full max-w-lg bg-white min-h-screen shadow-2xl flex flex-col">
        
        {activeTab === "home" && (
          <>
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

            <div className="flex-1 p-6 space-y-6">
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

        {activeTab === "jadwal" && (
          <JadwalView user={user} userData={userData} onBack={() => setActiveTab("home")} />
        )}

        {/* KONTEN: AKADEMIK & REPORT */}
        {activeTab === "akademik" && (
          <AkademikView user={user} userData={userData} onBack={() => setActiveTab("home")} />
        )}
        {activeTab === "report" && (
          // Logika baru: Cek role, jika Caregiver tampilkan view khusus
          userData?.role === "Caregiver" ? (
            <CaregiverReportView user={user} userData={userData} onBack={() => setActiveTab("home")} />
          ) : (
            // Jika bukan Caregiver (misal: Siswa Daycare), tampilkan view lama
            <ReportView user={user} userData={userData} onBack={() => setActiveTab("home")} />
          )
        )}

        {activeTab === "kegiatan" && (
          <KegiatanView user={user} userData={userData} onBack={() => setActiveTab("home")} />
        )}

        {activeTab === "pengumuman" && (
          <PengumumanView user={user} userData={userData} onBack={() => setActiveTab("home")} onSelect={setSelectedPengumuman} />
        )}

        {activeTab === "akun" && (
          <div className="flex-1 bg-gray-50">
            <header className="bg-white p-6 shadow-sm sticky top-0 z-10">
              <h1 className="text-xl font-bold text-gray-800">Profil Saya</h1>
            </header>
            
            <div className="p-6 space-y-6">
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

              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {["Admin", "Kepala Sekolah", "Direktur", "Yayasan", "Guru", "Caregiver"].includes(userData?.role) && (
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

                {["Guru", "Admin", "Kepala Sekolah", "Direktur", "Yayasan", "Caregiver"].includes(userData?.role) && (
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

        <nav className="border-t p-4 flex justify-around text-gray-400 bg-white sticky bottom-0">
           <button 
             onClick={() => setActiveTab("home")}
             className={`flex flex-col items-center ${activeTab === "home" ? "text-[#581c87]" : "text-gray-400"}`}
           >
             <Home className="w-6 h-6 mb-1" />
             <span className="text-[10px]">Home</span>
           </button>
           
           {renderAkademikButton()}
           
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
