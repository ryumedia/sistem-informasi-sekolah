"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { collection, query, orderBy, getDocs, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowLeft, FileText, Eye, X, Loader2, Shield, Search } from "lucide-react";

interface Dokumen {
  id: string;
  nama: string;
  url: string;
  createdAt: any;
}

export default function GuruDokumenPage() {
  const router = useRouter();
  const [dokumenList, setDokumenList] = useState<Dokumen[]>([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  
  // Modal View State
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedDocUrl, setSelectedDocUrl] = useState("");
  const [selectedDocName, setSelectedDocName] = useState("");

  // 1. Cek Auth & Role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/login");
        return;
      }

      try {
        // Cek data user di collection 'guru' (untuk Guru, KS, Direktur, Yayasan)
        const qGuru = query(collection(db, "guru"), where("email", "==", currentUser.email));
        const snapGuru = await getDocs(qGuru);

        if (!snapGuru.empty) {
          setUserData(snapGuru.docs[0].data());
        } else {
          // Jika tidak ada di guru, cek di siswa untuk memastikan role
          const qSiswa = query(collection(db, "siswa"), where("email", "==", currentUser.email));
          const snapSiswa = await getDocs(qSiswa);
          if (!snapSiswa.empty) {
             setUserData({ role: "Siswa" });
          } else {
             setUserData({ role: "Unknown" });
          }
        }
      } catch (error) {
        console.error("Error fetching user:", error);
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Fetch Dokumen jika bukan Siswa
  useEffect(() => {
    if (!userData) return;

    if (userData.role === "Siswa") {
      setLoading(false);
      return; // Stop fetching docs if siswa
    }

    const fetchDokumen = async () => {
      try {
        const q = query(collection(db, "dokumen_sekolah"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Dokumen[];
        setDokumenList(data);
      } catch (error) {
        console.error("Error fetching documents:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDokumen();
  }, [userData]);

  const handleView = (doc: Dokumen) => {
    setSelectedDocUrl(doc.url);
    setSelectedDocName(doc.nama);
    setIsViewModalOpen(true);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  };

  const filteredDokumen = dokumenList.filter((doc) =>
    doc.nama.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#581c87]" />
      </div>
    );
  }

  // Tampilan Akses Ditolak untuk Siswa atau User Role tidak diketahui
  if (userData?.role === "Siswa" || userData?.role === "Unknown") {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center p-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-sm">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Akses Ditolak</h2>
          <p className="text-gray-600 mb-6">Halaman ini hanya dapat diakses oleh Guru dan Staff Sekolah.</p>
          <button onClick={() => router.push("/")} className="bg-[#581c87] text-white px-6 py-2 rounded-lg hover:bg-[#45156b] transition">
            Kembali ke Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex justify-center">
      <div className="w-full max-w-lg bg-white min-h-screen shadow-xl flex flex-col">
        {/* Header */}
        <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
          <button onClick={() => router.push("/?tab=home")} className="p-2 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Dokumen Sekolah</h1>
            <p className="text-xs text-gray-500">Arsip dan panduan akademik</p>
          </div>
        </header>

        {/* Search Bar */}
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari dokumen..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-[#581c87] outline-none text-sm bg-gray-50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Content List */}
        <div className="p-4 space-y-3 flex-1 overflow-y-auto">
          {filteredDokumen.length === 0 ? (
            <div className="text-center py-10 text-gray-500 italic">{searchTerm ? "Dokumen tidak ditemukan." : "Belum ada dokumen yang tersedia."}</div>
          ) : (
            filteredDokumen.map((doc) => (
              <div key={doc.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex items-center justify-between hover:shadow-md transition">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="bg-red-50 p-2.5 rounded-lg text-red-600 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-gray-800 truncate pr-2">{doc.nama}</h3>
                    <p className="text-xs text-gray-500">{formatDate(doc.createdAt)}</p>
                  </div>
                </div>
                <button onClick={() => handleView(doc)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition shrink-0" title="Lihat Dokumen">
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Modal View PDF */}
        {isViewModalOpen && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col">
              <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                <h3 className="font-bold text-gray-800 flex items-center gap-2 truncate pr-4">
                  <FileText className="w-4 h-4 text-red-600 shrink-0" /> 
                  <span className="truncate">{selectedDocName}</span>
                </h3>
                <button onClick={() => setIsViewModalOpen(false)} className="text-gray-500 hover:text-gray-800 bg-gray-200 p-1 rounded-full shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 bg-gray-100 p-1">
                <iframe src={selectedDocUrl} className="w-full h-full rounded-b-lg border-none" title="PDF Viewer" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}