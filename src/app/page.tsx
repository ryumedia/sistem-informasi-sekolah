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
import { collection, query, where, getDocs, addDoc, orderBy } from "firebase/firestore";
import { BookOpen, Calendar, Bell, User, LogOut, Shield, Home, KeyRound, X, Activity, FileText, FilePlus } from "lucide-react";

export default function UserHome() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("home"); // 'home' | 'akademik' | 'akun'
  const [isPasswordModalOpen, setPasswordModalOpen] = useState(false);
  const [isPengajuanModalOpen, setPengajuanModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);

      // Ambil data detail user dari Firestore (Cek koleksi 'guru' dulu)
      try {
        const q = query(collection(db, "guru"), where("email", "==", currentUser.email));
        const querySnapshot = await getDocs(q);
        
        if (!querySnapshot.empty) {
          // Jika ditemukan di data Guru
          setUserData(querySnapshot.docs[0].data());
        } else {
          // Jika tidak, mungkin Siswa (Logic bisa ditambahkan nanti) atau user biasa
          setUserData({ nama: currentUser.email, role: "User" });
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

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
                    { name: "Jadwal", icon: <Calendar className="w-6 h-6 text-[#581c87]"/>, color: "bg-[#581c87]/10" },
                    { name: "Kegiatan", icon: <Activity className="w-6 h-6 text-green-600"/>, color: "bg-green-50" },
                    { name: "Info", icon: <Bell className="w-6 h-6 text-[#ff984e]"/>, color: "bg-[#ff984e]/10" },
                    { name: "Dokumen", icon: <FileText className="w-6 h-6 text-[#581c87]"/>, color: "bg-[#581c87]/10" },
                  ].map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-2 cursor-pointer">
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
                  <span className="text-xs text-[#581c87] font-medium">Lihat Semua</span>
                </div>
                <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm space-y-3">
                  <div className="border-b pb-2">
                    <h3 className="font-medium text-sm text-gray-800">Libur Semester Ganjil</h3>
                    <p className="text-xs text-gray-500 mt-1">Dimulai tanggal 20 Desember...</p>
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-gray-800">Ujian Tengah Semester</h3>
                    <p className="text-xs text-gray-500 mt-1">Jadwal telah dirilis, cek sekarang.</p>
                  </div>
                </div>
              </section>
            </div>
          </>
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
                {["Admin", "Kepala Sekolah", "Direktur", "Yayasan"].includes(userData?.role) && (
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

        {/* Bottom Navigation */}
        <nav className="border-t p-4 flex justify-around text-gray-400 bg-white sticky bottom-0">
           <button 
             onClick={() => setActiveTab("home")}
             className={`flex flex-col items-center ${activeTab === "home" ? "text-[#581c87]" : "text-gray-400"}`}
           >
             <Home className="w-6 h-6 mb-1" />
             <span className="text-[10px]">Home</span>
           </button>
           
           <button className="flex flex-col items-center text-gray-400">
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
            <input required type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
            <input required type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border rounded-lg p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password Baru</label>
            <input required type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border rounded-lg p-2" />
          </div>
          <button disabled={submitting} type="submit" className="w-full bg-[#581c87] text-white py-2 rounded-lg hover:bg-[#45156b] transition font-medium mt-2 disabled:opacity-50">
            {submitting ? "Menyimpan..." : "Simpan Password"}
          </button>
        </form>
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
              <input required type="date" className="w-full border rounded-lg p-2 text-sm"
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
            <select required className="w-full border rounded-lg p-2 text-sm bg-white"
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
            <input required type="text" className="w-full border rounded-lg p-2 text-sm" placeholder="Contoh: Kertas HVS A4"
              value={formData.barang} onChange={(e) => setFormData({...formData, barang: e.target.value})} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Harga Satuan (Rp)</label>
              <input required type="text" className="w-full border rounded-lg p-2 text-sm"
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
              <input required type="number" min="1" className="w-full border rounded-lg p-2 text-sm"
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
