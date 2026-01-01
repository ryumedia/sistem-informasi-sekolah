// src/app/admin/keuangan/anggaran/page.tsx
"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { Filter } from "lucide-react";

interface Pengajuan {
  id: string;
  tanggal: string;
  pengaju: string;
  cabang: string;
  barang: string;
  total: number;
  status: string;
}

export default function AnggaranPage() {
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 1 + i).toString());

  const [filterTahun, setFilterTahun] = useState(currentYear.toString());
  const [filterBulan, setFilterBulan] = useState(monthNames[new Date().getMonth()]);
  const [filterCabang, setFilterCabang] = useState("");
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [dataList, setDataList] = useState<Pengajuan[]>([]);
  const [loading, setLoading] = useState(true);

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
    const date = new Date(item.tanggal);
    const year = date.getFullYear().toString();
    const monthIndex = date.getMonth();
    const month = monthNames[monthIndex];

    return filterTahun === year && filterBulan === month && (filterCabang ? item.cabang === filterCabang : true);
  });

  const totalAnggaran = filteredData.reduce((acc, curr) => acc + (curr.total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Data Anggaran Disetujui</h1>
        
        {/* Filter Area */}
        <div className="flex gap-2">
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87]" value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)}>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87]" value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)}>
            {monthNames.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87]" value={filterCabang} onChange={(e) => setFilterCabang(e.target.value)}>
            <option value="">Semua Cabang</option>
            {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
          </select>
          <button className="bg-gray-100 p-2 rounded-lg text-gray-600 hover:bg-gray-200">
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Card Resume */}
      <div className="bg-[#581c87] text-white p-6 rounded-xl shadow-lg">
        <p className="text-purple-200 text-sm mb-1">Total Anggaran {filterBulan} {filterTahun}</p>
        <h2 className="text-3xl font-bold">Rp {totalAnggaran.toLocaleString("id-ID")}</h2>
      </div>

      {/* Tabel Anggaran */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
            <tr>
              <th className="p-4">No</th>
              <th className="p-4">Tanggal Disetujui</th>
              <th className="p-4">Nama Pengaju</th>
              <th className="p-4">Cabang</th>
              <th className="p-4">Keterangan</th>
              <th className="p-4">Nominal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center">Memuat data...</td></tr>
            ) : filteredData.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center">Tidak ada data anggaran disetujui pada periode ini.</td></tr>
            ) : (
              filteredData.map((item, index) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="p-4">{index + 1}</td>
                  <td className="p-4">{item.tanggal}</td>
                  <td className="p-4 font-medium">{item.pengaju}</td>
                  <td className="p-4">{item.cabang}</td>
                  <td className="p-4">{item.barang}</td>
                  <td className="p-4 font-bold text-gray-800">Rp {item.total.toLocaleString("id-ID")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
