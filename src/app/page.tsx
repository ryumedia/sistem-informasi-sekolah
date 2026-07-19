// src/app/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, getDocs, doc, getDoc, addDoc, orderBy, limit } from "firebase/firestore";
import { BookOpen, Calendar, Bell, User, LogOut, Shield, Home, KeyRound, Activity, FileText, FilePlus, CreditCard, Ticket, QrCode, X } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import { QRCodeSVG } from "qrcode.react"; // Ganti impor ke QRCodeSVG

import ChangePasswordModal from "../components/dashboard/changePasswordModal";
import AkademikView from "../components/dashboard/AkademikView";
import CaregiverReportView from "../components/dashboard/CaregiverReportView"; // Import CaregiverReportView
import ReportView from "../components/dashboard/ReportView"; // Import ReportView
import JadwalView from "../components/dashboard/JadwalView";
import KegiatanView from "../components/dashboard/KegiatanView";
import PengumumanView from "../components/dashboard/PengumumanView";
import PengajuanModal from "../components/dashboard/PengajuanModal";
import AcaraView from "../components/dashboard/AcaraView";
import PengumumanDetailModal from "../components/dashboard/PengumumanDetailModal";
import PembayaranView from "../components/dashboard/PembayaranView";
import EditProfileModal from "../components/dashboard/EditProfileModal"; // Import EditProfileModal

export default function UserHome() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [jenjangKelas, setJenjangKelas] = useState(""); // State untuk jenjang kelas siswa
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home");
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [isEditProfileModalOpen, setEditProfileModalOpen] = useState(false);
  const [isPengajuanModalOpen, setPengajuanModalOpen] = useState(false);
  const [latestPengumuman, setLatestPengumuman] = useState<any[]>([]);
  const [selectedPengumuman, setSelectedPengumuman] = useState<any>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  const fetchUserData = useCallback(async (currentUser: FirebaseUser) => {
    const collectionsToQuery = ["guru", "siswa", "caregivers"];
    for (const collectionName of collectionsToQuery) {
      const q = query(collection(db, collectionName), where("email", "==", currentUser.email));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        setUserData({ id: snapshot.docs[0].id, ...docData });
        return docData; // Return data to be used immediately
      }
    }
    return null;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && ["home", "jadwal", "akademik", "pembayaran", "report", "kegiatan", "pengumuman", "acara", "akun"].includes(tabParam)) {
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

      const loadData = async () => {
        try {
          const fetchedData = await fetchUserData(currentUser);
          if (fetchedData && fetchedData.role === 'Siswa' && fetchedData.kelas) {
            const qKelas = query(collection(db, "kelas"), where("namaKelas", "==", fetchedData.kelas));
            const snapshotKelas = await getDocs(qKelas);
            if (!snapshotKelas.empty) {
              const kelasData = snapshotKelas.docs[0].data();
              setJenjangKelas(kelasData.jenjangKelas || "");
            } else {
              console.error("Tidak bisa menemukan dokumen kelas dengan nama:", fetchedData.kelas);
            }
          } else if (!fetchedData) {
            setUserData({ nama: currentUser.email, role: "User" });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        } finally {
          setLoading(false);
        }
      };

      loadData();
    });

    return () => unsubscribe();
  }, [router]); // Hapus fetchUserData dari dependency array

  // Fetch Latest Pengumuman for Dashboard
  useEffect(() => {
    const fetchLatestPengumuman = async () => {
      if (!userData?.cabang && !["Admin", "Direktur", "Yayasan"].includes(userData?.role)) return;
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
  }, [userData?.cabang, userData?.role]); // Ubah dependency ke yang lebih spesifik

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const handleProfileUpdate = () => {
    if (user) {
      fetchUserData(user);
    }
    setEditProfileModalOpen(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">Memuat...</div>;
  }

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
                {userData?.cabang && <p className="text-xs text-purple-100 mt-1 font-medium">{userData.cabang}</p>}
              </div>
            </header>

            <div className="flex-1 p-6 space-y-6">
              <section>
                <h2 className="font-semibold text-gray-800 mb-3">Menu Utama</h2>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { name: "Jadwal", icon: <Calendar className="w-6 h-6 text-[#581c87]"/>, color: "bg-[#581c87]/10", action: () => setActiveTab("jadwal") },
                    { name: "Kegiatan", icon: <Activity className="w-6 h-6 text-green-600"/>, color: "bg-green-50", action: () => setActiveTab("kegiatan") },
                    { name: "Acara", icon: <Ticket className="w-6 h-6 text-blue-600"/>, color: "bg-blue-50", action: () => setActiveTab("acara") },
                    { name: "Pengumuman", icon: <Bell className="w-6 h-6 text-[#ff984e]"/>, color: "bg-[#ff984e]/10", action: () => setActiveTab("pengumuman") }
                  ].map((item, idx) => (
                    <div key={idx} onClick={item.action} className="flex flex-col items-center justify-start gap-2 cursor-pointer text-center">
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

        {activeTab === "pembayaran" && (
          <PembayaranView user={user} userData={userData} onBack={() => setActiveTab("home")} />
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

        {activeTab === "acara" && (
          <AcaraView userData={userData} onBack={() => setActiveTab("home")} />
        )}

        {activeTab === "akun" && (
          <div className="flex-1 bg-gray-50">
            <header className="bg-white p-6 shadow-sm sticky top-0 z-10">
              <h1 className="text-xl font-bold text-gray-800">Profil Saya</h1>
            </header>
            
            <div className="p-6 space-y-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm flex items-center gap-4">
                {/* --- LOGIKA FOTO PROFIL DIPERBAIKI --- */}
                {(userData?.role === 'Siswa' && userData?.foto) || (userData?.role !== 'Siswa' && userData?.fotoUrl) ? (
                  <Image 
                    src={userData.role === 'Siswa' ? userData.foto : userData.fotoUrl} 
                    alt="Foto Profil" width={64} height={64} className="w-16 h-16 rounded-full object-cover bg-gray-100" />
                ) : (
                  <div className="w-16 h-16 bg-[#581c87]/10 rounded-full flex items-center justify-center text-[#581c87]">
                    <User className="w-8 h-8" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="font-bold text-gray-800 text-lg">{userData?.nama || "User"}</h2>
                      <p className="text-gray-500 text-sm">{user?.email}</p>
                    </div>
                    <button onClick={() => setEditProfileModalOpen(true)} className="text-xs bg-purple-100 text-purple-700 font-semibold px-3 py-1 rounded-full hover:bg-purple-200 transition-colors">
                      Edit
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                    {userData?.role === 'Siswa' ? (
                      <>
                        <span>NISN: {userData?.nisn || '-'}</span>
                        <span className="text-gray-300">|</span>
                        <span>Kelas: {userData?.kelas || '-'}</span>
                      </>
                    ) : (
                      <>
                        <span>NIY: {userData?.niy || '-'}</span>
                        <span className="text-gray-300">|</span>
                        <span>Jabatan: {userData?.role || 'User'}</span>
                      </>
                    )}
                  </div>
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

                {/* Hilangkan menu Dokumen jika role adalah Siswa */}
                {userData?.role !== "Siswa" && (
                  <button onClick={() => router.push('/guru/dokumen')} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 border-b border-gray-100 transition text-left">
                    <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800">Dokumen Sekolah</h3>
                      <p className="text-xs text-gray-500">Lihat arsip dan panduan</p>
                    </div>
                  </button>
                )}

                <button onClick={() => setIsQrModalOpen(true)} className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 border-b border-gray-100 transition text-left">
                  <div className="bg-purple-100 p-2 rounded-lg text-purple-600">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800">Tampilkan QR Code</h3>
                    <p className="text-xs text-gray-500">Untuk presensi atau identifikasi</p>
                  </div>
                </button>
                
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

        {isEditProfileModalOpen && (
          <EditProfileModal user={user} userData={userData} onClose={() => setEditProfileModalOpen(false)} onProfileUpdate={handleProfileUpdate} />
        )}

        {selectedPengumuman && (
          <PengumumanDetailModal data={selectedPengumuman} onClose={() => setSelectedPengumuman(null)} />
        )}

        {isQrModalOpen && (
          <div className="fixed inset-0 bg-black/70 z-50 flex justify-center items-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs text-center p-6 relative">
              <button onClick={() => setIsQrModalOpen(false)} className="absolute top-3 right-3 p-2 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
              <h3 className="text-lg font-bold text-gray-800 mb-1">QR Code Anda</h3>
              <p className="text-sm text-gray-500 mb-5">Gunakan untuk presensi acara.</p>
              <div className="bg-gray-50 p-4 rounded-lg inline-block">
                {/* Generate QR Code dari ID unik user */}
                <QRCodeSVG value={userData?.id || user?.uid || "no-id"} size={200} />
              </div>
              <p className="text-xs text-gray-400 mt-4">
                ID: {userData?.id || user?.uid || "no-id"}
              </p>
            </div>
          </div>
        )}

        <nav className="border-t p-4 flex justify-around text-gray-400 bg-white sticky bottom-0">
           <button 
             onClick={() => setActiveTab("home")}
             className={`flex flex-col items-center ${activeTab === "home" ? "text-[#581c87]" : "text-gray-400"}`}
           >
             <Home className="w-6 h-6 mb-1" />
             <span className="text-[10px]">Home</span>
           </button>
           
           {/* Menu Akademik: Untuk Guru atau Siswa (kecuali Siswa murni Daycare) */}
           {["Siswa", "Guru"].includes(userData?.role) && jenjangKelas !== "Daycare" && (
             <button 
               onClick={() => setActiveTab("akademik")}
               className={`flex flex-col items-center ${activeTab === "akademik" ? "text-[#581c87]" : "text-gray-400"}`}
             >
               <BookOpen className="w-6 h-6 mb-1" />
               <span className="text-[10px]">Akademik</span>
             </button>
           )}

           {/* Menu Pembayaran: Untuk Siswa */}
           {userData?.role === "Siswa" && (
             <button 
               onClick={() => setActiveTab("pembayaran")}
               className={`flex flex-col items-center ${activeTab === "pembayaran" ? "text-[#581c87]" : "text-gray-400"}`}
             >
               <CreditCard className="w-6 h-6 mb-1" />
               <span className="text-[10px]">Pembayaran</span>
             </button>
           )}

           {/* Menu Report: Untuk Caregiver atau Siswa Daycare (Murni atau Reguler+Daycare) */}
           {((userData?.role === "Siswa" && (jenjangKelas === "Daycare" || userData?.isDaycare)) || userData?.role === "Caregiver") && (
             <button 
               onClick={() => setActiveTab("report")}
               className={`flex flex-col items-center ${activeTab === "report" ? "text-[#581c87]" : "text-gray-400"}`}
             >
               <FileText className="w-6 h-6 mb-1" />
               <span className="text-[10px]">Report</span>
             </button>
           )}
           
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
