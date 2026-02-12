// src/app/admin/keuangan/anggaran/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { Filter, ChevronLeft, ChevronRight } from "lucide-react";

interface Pengajuan {
  id: string;
  tanggal: string;
  pengaju: string;
  cabang: string;
  nomenklatur: string;
  barang: string;
  total: number;
  status: string;
}

export default function AnggaranPage() {
  const now = new Date();
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [startDate, setStartDate] = useState(formatDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [endDate, setEndDate] = useState(formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  const [filterCabang, setFilterCabang] = useState("");
  const [filterPengaju, setFilterPengaju] = useState(""); // State baru untuk filter pengaju
  const [filterNomenklatur, setFilterNomenklatur] = useState("");
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [nomenklaturList, setNomenklaturList] = useState<any[]>([]);
  const [dataList, setDataList] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchCabang = async () => {
      try {
        const q = query(collection(db, "cabang"), orderBy("nama", "asc"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setCabangList(data);
      } catch (error) {
        console.error("Error fetching cabang:", error);
      }
    };
    fetchCabang();
  }, []);

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const q = query(collection(db, "guru"), where("email", "==", currentUser.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            setUserRole(userData.role);
            if (userData.role === "Kepala Sekolah") {
              setFilterCabang(userData.cabang);
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Ambil hanya yang statusnya Disetujui
        const q = query(collection(db, "pengajuan"), where("status", "==", "Disetujui"));
        const querySnapshot = await getDocs(q);
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Pengajuan[];
        
        // Sort manual by tanggal desc
        data.sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
        
        setDataList(data);
      } catch (error) {
        console.error("Error fetching anggaran:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredData = dataList.filter((item) => {
    const matchDate = (!startDate || item.tanggal >= startDate) && (!endDate || item.tanggal <= endDate);
    const matchCabang = filterCabang ? item.cabang === filterCabang : true;
    const matchPengaju = filterPengaju ? item.pengaju.toLowerCase().includes(filterPengaju.toLowerCase()) : true;
    const matchNomenklatur = filterNomenklatur ? item.nomenklatur === filterNomenklatur : true;

    return matchDate && matchCabang && matchPengaju && matchNomenklatur;
  });

  // Pagination Logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [startDate, endDate, filterCabang, filterPengaju, filterNomenklatur]);

  const totalAnggaran = filteredData.reduce((acc, curr) => acc + (curr.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Data Anggaran Disetujui</h1>
        
        {/* Filter Area */}
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Dari:</span>
            <input 
              type="date" 
              className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900"
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-sm text-gray-600">Sampai:</span>
            <input 
              type="date" 
              className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900"
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <select 
            className={`border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900 ${userRole === "Kepala Sekolah" ? "bg-gray-100 cursor-not-allowed" : ""}`} 
            value={filterCabang} 
            onChange={(e) => setFilterCabang(e.target.value)}
            disabled={userRole === "Kepala Sekolah"}
          >
            {userRole !== "Kepala Sekolah" && <option value="">Semua Cabang</option>}
            {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900" value={filterNomenklatur} onChange={(e) => setFilterNomenklatur(e.target.value)}>
            <option value="">Semua Nomenklatur</option>
            {nomenklaturList.map((n) => (
              <option key={n.id} value={n.nama}>{n.nama}</option>
            ))}
          </select>
          {/* Input baru untuk filter pengaju */}
          <input
            type="text"
            placeholder="Cari Nama Pengaju..."
            className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900"
            value={filterPengaju}
            onChange={(e) => setFilterPengaju(e.target.value)}
          />
          <button className="bg-gray-100 p-2 rounded-lg text-gray-600 hover:bg-gray-200">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Card Resume */}
      <div className="bg-[#581c87] text-white p-6 rounded-xl shadow-lg">
        <p className="text-purple-200 text-sm mb-1">Total Anggaran {startDate} s/d {endDate}</p>
        <h2 className="text-3xl font-bold">Rp {totalAnggaran.toLocaleString("id-ID")}</h2>
      </div>

      {/* Tabel Anggaran */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 min-w-[800px]">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4">No</th>
              <th className="p-4">Tanggal Disetujui</th>
              <th className="p-4">Nama Pengaju</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Keterangan / Nomenklatur</th>
              <th className="p-4">Nominal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center">Memuat data...</td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center">Tidak ada data anggaran disetujui pada periode ini.</td></tr>
            ) : (
              currentItems.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4">{indexOfFirstItem + index + 1}</td>
                  <td className="p-4">{item.tanggal}</td>
                  <td className="p-4 font-medium">{item.pengaju}</td>
                  <td className="p-4">{item.cabang}</td>
                  <td className="p-4">
                    <div className="font-medium text-gray-900">{item.barang}</div>
                    <div className="text-xs text-gray-500">{item.nomenklatur}</div>
                  </td>
                  <td className="p-4 font-bold text-gray-800">Rp {item.total.toLocaleString("id-ID")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && filteredData.length > 0 && (
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-4">
          <p className="text-sm text-gray-600">
            Menampilkan {indexOfFirstItem + 1} hingga {Math.min(indexOfLastItem, filteredData.length)} dari {filteredData.length} data
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="p-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition ${
                      currentPage === pageNum
                        ? "bg-[#581c87] text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-2 border rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
