"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs, onSnapshot } from "firebase/firestore";
import { ChevronDown, ChevronRight, ArrowLeft, Menu, X } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pengajuanCount, setPengajuanCount] = useState(0);
  const [realisasiCount, setRealisasiCount] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Ambil data detail user dari Firestore
        try {
          const q = query(collection(db, "guru"), where("email", "==", currentUser.email));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            setUserData(querySnapshot.docs[0].data());
          } else {
            setUserData({ nama: currentUser.displayName || "Admin", email: currentUser.email });
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Redirect Guru from dashboard to performance page
  useEffect(() => {
    if (userData?.role === 'Guru' && pathname === '/admin') {
      router.replace('/admin/performance');
    }
  }, [userData, pathname, router]);

  // Realtime Listener untuk Badge Notifikasi
  useEffect(() => {
    // 1. Hitung Pengajuan Belum Approve (Menunggu KS / Direktur)
    const qPengajuan = query(collection(db, "pengajuan"), where("status", "in", ["Menunggu KS", "Menunggu Direktur"]));
    const unsubPengajuan = onSnapshot(qPengajuan, (snap) => {
      setPengajuanCount(snap.size);
    });

    // 2. Hitung Anggaran Belum Terealisasi (Status Disetujui)
    const qRealisasi = query(collection(db, "pengajuan"), where("status", "==", "Disetujui"));
    const unsubRealisasi = onSnapshot(qRealisasi, (snap) => {
      setRealisasiCount(snap.size);
    });

    return () => {
      unsubPengajuan();
      unsubRealisasi();
    };
  }, []);

  const toggleMenu = (name: string) => {
    setExpandedMenu(expandedMenu === name ? null : name);
  };

  const allMenuItems = [
    { name: "Dashboard", href: "/admin", roles: ["Admin", "Kepala Sekolah", "Direktur", "Yayasan"] },
    { name: "Data Siswa", href: "/admin/siswa", roles: ["Admin", "Kepala Sekolah"] },
    { name: "Data Guru", href: "/admin/guru", roles: ["Admin", "Kepala Sekolah", "Yayasan"] },
    { name: "Performance", href: "/admin/performance", roles: ["Admin", "Kepala Sekolah", "Direktur", "Yayasan", "Guru"] },
    { 
      name: "Akademik", 
      href: "#", 
      roles: ["Admin", "Kepala Sekolah"],
      submenu: [
        { name: "RPPH", href: "/admin/akademik/rpph", roles: ["Admin", "Kepala Sekolah"] },
        { name: "Tahap Perkembangan", href: "/admin/akademik/perkembangan", roles: ["Admin", "Kepala Sekolah"] },
        { name: "Indikator", href: "/admin/akademik/indikator", roles: ["Admin", "Kepala Sekolah"] },
        { name: "Trilogi Mainriang", href: "/admin/akademik/trilogi", roles: ["Admin", "Kepala Sekolah"] },
      ]
    },
    { 
      name: "Keuangan", 
      href: "#",
      roles: ["Admin", "Kepala Sekolah", "Direktur", "Yayasan"],
      submenu: [
        { name: "Pengajuan", href: "/admin/keuangan/pengajuan", roles: ["Admin", "Kepala Sekolah", "Direktur", "Yayasan"] },
        { name: "Anggaran", href: "/admin/keuangan/anggaran", roles: ["Admin", "Kepala Sekolah", "Direktur", "Yayasan"] },
        { name: "Realisasi", href: "/admin/keuangan/realisasi", roles: ["Admin", "Kepala Sekolah", "Direktur", "Yayasan"] },
        { name: "Arus Kas", href: "/admin/keuangan/aruskas", roles: ["Admin", "Kepala Sekolah", "Direktur", "Yayasan"] },
      ]
    },
    { 
      name: "Pengaturan", 
      href: "#",
      roles: ["Admin"],
      submenu: [
        { name: "Pengaturan Keuangan", href: "/admin/pengaturan/keuangan", roles: ["Admin"] },
        { name: "Pengaturan Cabang", href: "/admin/pengaturan/cabang", roles: ["Admin"] },
        { name: "Pengaturan Kelas", href: "/admin/pengaturan/kelas", roles: ["Admin"] },
        { name: "Pengaturan Performance", href: "/admin/pengaturan/performance", roles: ["Admin"] }
      ]
    },
  ];

  // Filter menu items based on user's role
  const menuItems = allMenuItems
    .filter(item => item.roles && userData?.role && item.roles.includes(userData.role))
    .map(item => {
      if (item.submenu) {
        return {
          ...item,
          submenu: item.submenu.filter(subItem => subItem.roles && userData?.role && subItem.roles.includes(userData.role))
        };
      }
      return item;
    });

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Mobile Overlay (Background Gelap saat menu terbuka) */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Responsive: Slide-in di Mobile, Tetap di Desktop) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-[#581c87] text-white flex flex-col transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-6 border-b border-[#45156b] flex flex-col items-center text-center relative">
          {/* Tombol Close di Mobile */}
          <button onClick={() => setIsMobileMenuOpen(false)} className="absolute top-4 right-4 md:hidden text-purple-200 hover:text-white">
            <X className="w-5 h-5" />
          </button>

          <div className="mb-3 bg-white p-2 rounded-full">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">SIS Admin</h2>
          <p className="text-xs text-purple-200 mt-1">Sistem Informasi Sekolah</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            // Logika untuk Menu dengan Submenu
            if (item.submenu) {
              const isExpanded = expandedMenu === item.name;
              const isActiveParent = item.submenu.some(sub => pathname === sub.href);
              
              // Hitung Badge Parent (Khusus Keuangan)
              let parentBadge = 0;
              if (item.name === "Keuangan") {
                parentBadge = pengajuanCount + realisasiCount;
              }

              return (
                <div key={item.name}>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition ${
                       isActiveParent || isExpanded ? "text-white" : "text-purple-100 hover:bg-[#45156b]"
                    }`}
                  >
                    <span>{item.name}</span>
                    <div className="flex items-center gap-2">
                      {parentBadge > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {parentBadge}
                        </span>
                      )}
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-[#45156b] pl-2">
                      {item.submenu.map((subItem) => {
                        const isSubActive = pathname === subItem.href;
                        
                        // Logic Badge
                        let badge = 0;
                        if (subItem.name === "Pengajuan") badge = pengajuanCount;
                        if (subItem.name === "Realisasi") badge = realisasiCount;

                        return (
                          <Link
                            key={subItem.name}
                            href={subItem.href}
                            onClick={() => setIsMobileMenuOpen(false)} // Tutup menu saat link diklik
                            className={`flex items-center justify-between px-4 py-2 rounded-lg text-sm transition ${
                              isSubActive ? "bg-[#ff984e] text-white shadow-sm" : "text-purple-200 hover:text-white hover:bg-[#45156b]"
                            }`}
                          >
                            <span>{subItem.name}</span>
                            {badge > 0 && (
                              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full ml-2" title={`${badge} Item Perlu Tindakan`}>
                                {badge}
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Logika untuk Menu Biasa
            const isActive = item.href === "/admin" 
              ? pathname === "/admin" 
              : item.href !== "#" && pathname.startsWith(item.href);

            return (
              <Link 
                key={item.name}
                href={item.href} 
                onClick={() => setIsMobileMenuOpen(false)} // Tutup menu saat link diklik
                className={`block px-4 py-3 rounded-lg text-sm font-medium transition ${
                  isActive 
                    ? "bg-[#ff984e] text-white shadow-sm" 
                    : "hover:bg-[#45156b] text-purple-100"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Admin */}
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-3">
            {/* Tombol Hamburger (Hanya muncul di Mobile) */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-1 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h3 className="text-gray-700 font-semibold">Dashboard Overview</h3>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#581c87] transition">
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Web</span>
            </Link>
            <div className="w-px h-6 bg-gray-200"></div>
            <div className="w-8 h-8 bg-[#581c87]/10 rounded-full flex items-center justify-center text-[#581c87] font-bold">
              {userData?.nama ? userData.nama.charAt(0).toUpperCase() : "A"}
            </div>
            <div className="flex flex-col text-right">
              <span className="text-sm font-medium text-gray-800">{userData?.nama || "Memuat..."}</span>
              <span className="text-xs text-gray-500">{userData?.email || ""}</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
