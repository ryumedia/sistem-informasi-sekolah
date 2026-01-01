"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ChevronDown, ChevronRight, ArrowLeft } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [userData, setUserData] = useState<any>(null);
  const [expandedMenu, setExpandedMenu] = useState<string | null>(null);

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

  const toggleMenu = (name: string) => {
    setExpandedMenu(expandedMenu === name ? null : name);
  };

  const menuItems = [
    { name: "Dashboard", href: "/admin" },
    { name: "Data Siswa", href: "#" },
    { name: "Data Guru", href: "/admin/guru" },
    { name: "Jadwal Pelajaran", href: "#" },
    { 
      name: "Keuangan", 
      href: "#",
      submenu: [
        { name: "Pengajuan", href: "/admin/keuangan/pengajuan" },
        { name: "Anggaran", href: "/admin/keuangan/anggaran" },
        { name: "Realisasi", href: "/admin/keuangan/realisasi" },
        { name: "Arus Kas", href: "/admin/keuangan/aruskas" },
      ]
    },
    { 
      name: "Pengaturan", 
      href: "#",
      submenu: [
        { name: "Pengaturan Keuangan", href: "/admin/pengaturan/keuangan" },
        { name: "Pengaturan Cabang", href: "/admin/pengaturan/cabang" }
      ]
    },
  ];

  return (
    <div className="flex h-screen bg-gray-100 font-sans">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-[#581c87] text-white hidden md:flex flex-col">
        <div className="p-6 border-b border-[#45156b] flex flex-col items-center text-center">
          <div className="mb-3 bg-white p-2 rounded-full">
            <Image src="/logo.png" alt="Logo" width={40} height={40} className="object-contain" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">SIS Admin</h2>
          <p className="text-xs text-purple-200 mt-1">Sistem Informasi Sekolah</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            // Logika untuk Menu dengan Submenu
            if (item.submenu) {
              const isExpanded = expandedMenu === item.name;
              const isActiveParent = item.submenu.some(sub => pathname === sub.href);
              
              return (
                <div key={item.name}>
                  <button
                    onClick={() => toggleMenu(item.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition ${
                       isActiveParent || isExpanded ? "text-white" : "text-purple-100 hover:bg-[#45156b]"
                    }`}
                  >
                    {item.name}
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </button>
                  
                  {isExpanded && (
                    <div className="ml-4 mt-1 space-y-1 border-l border-[#45156b] pl-2">
                      {item.submenu.map((subItem) => {
                        const isSubActive = pathname === subItem.href;
                        return (
                          <Link
                            key={subItem.name}
                            href={subItem.href}
                            className={`block px-4 py-2 rounded-lg text-sm transition ${
                              isSubActive ? "bg-[#ff984e] text-white shadow-sm" : "text-purple-200 hover:text-white hover:bg-[#45156b]"
                            }`}
                          >
                            {subItem.name}
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
        <header className="h-16 bg-white shadow-sm flex items-center justify-between px-8">
          <h3 className="text-gray-700 font-semibold">Dashboard Overview</h3>
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
