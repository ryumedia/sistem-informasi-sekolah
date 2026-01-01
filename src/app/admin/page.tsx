"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";

interface LogAktivitas {
  id: string;
  user: string;
  aktivitas: string;
  waktu: any;
  status: string;
}

export default function AdminDashboard() {
  const [totalSiswa, setTotalSiswa] = useState(0);
  const [totalGuru, setTotalGuru] = useState(0);
  const [recentActivity, setRecentActivity] = useState<LogAktivitas[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Ambil Data Siswa (Hitung Jumlah)
        const siswaSnap = await getDocs(collection(db, "siswa"));
        setTotalSiswa(siswaSnap.size);

        // 2. Ambil Data Guru (Hitung Jumlah)
        const guruSnap = await getDocs(collection(db, "guru"));
        setTotalGuru(guruSnap.size);

        // 3. Ambil Aktivitas Terbaru (Limit 5, urutkan waktu terbaru)
        const q = query(
          collection(db, "aktivitas"),
          orderBy("waktu", "desc"),
          limit(5)
        );
        const aktivitasSnap = await getDocs(q);
        
        const dataAktivitas = aktivitasSnap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as LogAktivitas[];

        setRecentActivity(dataAktivitas);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total Siswa</p>
          <h3 className="text-3xl font-bold text-gray-800">
            {loading ? "..." : totalSiswa}
          </h3>
          <span className="text-xs text-green-500 font-medium">Data Realtime</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Total Guru</p>
          <h3 className="text-3xl font-bold text-gray-800">
            {loading ? "..." : totalGuru}
          </h3>
          <span className="text-xs text-gray-400 font-medium">Terdaftar</span>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <p className="text-sm text-gray-500 mb-1">Kehadiran Hari Ini</p>
          <h3 className="text-3xl font-bold text-gray-800">98.2%</h3>
          <span className="text-xs text-green-500 font-medium">Sangat Baik</span>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Aktivitas Terbaru</h3>
        </div>
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-gray-900 font-semibold">
            <tr>
              <th className="p-4">User</th>
              <th className="p-4">Aktivitas</th>
              <th className="p-4">Waktu</th>
              <th className="p-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={4} className="p-4 text-center">Memuat data...</td></tr>
            ) : recentActivity.length === 0 ? (
              <tr><td colSpan={4} className="p-4 text-center">Belum ada aktivitas</td></tr>
            ) : (
              recentActivity.map((item) => (
                <tr key={item.id}>
                  <td className="p-4">{item.user}</td>
                  <td className="p-4">{item.aktivitas}</td>
                  <td className="p-4">
                    {/* Konversi Timestamp Firestore ke Jam yang mudah dibaca */}
                    {item.waktu?.toDate ? item.waktu.toDate().toLocaleTimeString("id-ID", {hour: '2-digit', minute:'2-digit'}) : "Baru saja"} WIB
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      item.status === 'Sukses' ? 'bg-green-100 text-green-700' : 'bg-[#581c87]/10 text-[#581c87]'
                    }`}>{item.status}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}