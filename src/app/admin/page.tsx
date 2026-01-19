"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, collectionGroup } from 'firebase/firestore';
import { Building, Users, UserSquare, Star, ArrowDown, ArrowUp, Scale, Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [selectedCabang, setSelectedCabang] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [kelasStatsList, setKelasStatsList] = useState<any[]>([]);

  const [stats, setStats] = useState({
    kelas: 0,
    siswa: 0,
    guru: 0,
    performance: 0,
  });

  const [keuangan, setKeuangan] = useState({
    pemasukan: 0,
    pengeluaran: 0,
    saldo: 0,
  });

  // Fetch Cabang List for Filter
  useEffect(() => {
    const fetchCabang = async () => {
      try {
        const q = query(collection(db, "cabang"), orderBy("nama", "asc"));
        const snap = await getDocs(q);
        setCabangList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Error fetching cabang:", error);
      }
    };
    fetchCabang();
  }, []);

  // Fetch Dashboard Data based on Filter
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Base queries
      const baseQuery = (col: string) => selectedCabang ? query(collection(db, col), where("cabang", "==", selectedCabang)) : collection(db, col);

      try {
        // 1. Get Counts
        const [kelasSnap, siswaSnap, guruSnap] = await Promise.all([
          getDocs(baseQuery("kelas")),
          getDocs(baseQuery("siswa")),
          getDocs(baseQuery("guru")),
        ]);

        // --- Process Class Stats (Table Data) ---
        const classes = kelasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const students = siswaSnap.docs.map(doc => doc.data());

        const studentCounts: Record<string, { L: number, P: number }> = {};
        students.forEach((s: any) => {
            // Key: Cabang-Kelas (asumsi kombinasi unik untuk mapping)
            const key = `${s.cabang}-${s.kelas}`;
            if (!studentCounts[key]) studentCounts[key] = { L: 0, P: 0 };
            
            if (s.jenisKelamin === 'Laki-laki') studentCounts[key].L++;
            else if (s.jenisKelamin === 'Perempuan') studentCounts[key].P++;
        });

        const processedKelasStats = classes.map((cls: any) => {
            const key = `${cls.cabang}-${cls.namaKelas}`;
            const counts = studentCounts[key] || { L: 0, P: 0 };
            return {
                id: cls.id,
                namaKelas: cls.namaKelas,
                cabang: cls.cabang,
                laki: counts.L,
                perempuan: counts.P,
                jumlah: counts.L + counts.P
            };
        });

        // Sort: Cabang ASC, then Nama Kelas ASC
        processedKelasStats.sort((a: any, b: any) => {
             if (a.cabang !== b.cabang) return a.cabang.localeCompare(b.cabang);
             return a.namaKelas.localeCompare(b.namaKelas);
        });
        setKelasStatsList(processedKelasStats);

        // 2. Get Keuangan (Dipindah ke atas agar tidak terblokir error Performance)
        const keuanganQuery = baseQuery("arus_kas");
        const keuanganSnap = await getDocs(keuanganQuery);
        let pemasukan = 0;
        let pengeluaran = 0;
        keuanganSnap.forEach(doc => {
          const data = doc.data();
          if (data.jenis === 'Masuk') {
            pemasukan += Number(data.nominal) || 0;
          } else if (data.jenis === 'Keluar') {
            pengeluaran += Number(data.nominal) || 0;
          }
        });

        setKeuangan({
          pemasukan,
          pengeluaran,
          saldo: pemasukan - pengeluaran,
        });

        // 3. Get Performance (Dibungkus try-catch agar aman jika index belum siap)
        let avgPerformance = 0;
        try {
            const performanceQuery = selectedCabang
              ? query(collectionGroup(db, 'kpi_guru'), where('cabang', '==', selectedCabang))
              : collectionGroup(db, 'kpi_guru');
            const performanceSnap = await getDocs(performanceQuery);
            let totalScore = 0;
            performanceSnap.forEach(doc => {
                totalScore += doc.data().persentase || 0;
            });
            avgPerformance = performanceSnap.size > 0 ? totalScore / performanceSnap.size : 0;
        } catch (err) {
            console.warn("Performance query failed (waiting for index?):", err);
        }

        setStats({
          kelas: kelasSnap.size,
          siswa: siswaSnap.size,
          guru: guruSnap.size,
          performance: parseFloat(avgPerformance.toFixed(2)),
        });

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedCabang]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Admin</h1>
        <div>
          <label className="text-xs font-medium text-gray-500 mr-2">Filter Cabang:</label>
          <select 
            value={selectedCabang} 
            onChange={(e) => setSelectedCabang(e.target.value)}
            className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87]"
          >
            <option value="">Semua Cabang</option>
            {cabangList.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="w-full text-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-[#581c87] mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Memuat data...</p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard icon={<Building />} title="Jumlah Kelas" value={stats.kelas} color="blue" />
            <StatCard icon={<Users />} title="Jumlah Siswa" value={stats.siswa} color="green" />
            <StatCard icon={<UserSquare />} title="Jumlah Guru" value={stats.guru} color="orange" />
            <StatCard icon={<Star />} title="Nilai Performance" value={stats.performance} color="purple" suffix="%" />
          </div>

          {/* Tabel Data Kelas & Siswa */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Data Kelas & Siswa</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-gray-600">
                <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
                  <tr>
                    <th className="p-3 w-12 text-center">No</th>
                    <th className="p-3">Nama Kelas</th>
                    <th className="p-3">Cabang</th>
                    <th className="p-3 text-center">Laki-laki</th>
                    <th className="p-3 text-center">Perempuan</th>
                    <th className="p-3 text-center">Jumlah</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {kelasStatsList.length === 0 ? (
                    <tr><td colSpan={6} className="p-4 text-center text-gray-500">Tidak ada data kelas.</td></tr>
                  ) : (
                    kelasStatsList.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="p-3 text-center">{idx + 1}</td>
                        <td className="p-3 font-medium text-gray-900">{item.namaKelas}</td>
                        <td className="p-3">{item.cabang}</td>
                        <td className="p-3 text-center">{item.laki}</td>
                        <td className="p-3 text-center">{item.perempuan}</td>
                        <td className="p-3 text-center font-bold">{item.jumlah}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Keuangan Recap */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Rekap Keuangan {selectedCabang && `(${selectedCabang})`}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <KeuanganCard icon={<ArrowDown />} title="Total Pemasukan" value={formatCurrency(keuangan.pemasukan)} color="text-green-600" bgColor="bg-green-50" />
              <KeuanganCard icon={<ArrowUp />} title="Total Pengeluaran" value={formatCurrency(keuangan.pengeluaran)} color="text-red-600" bgColor="bg-red-50" />
              <KeuanganCard icon={<Scale />} title="Saldo Akhir" value={formatCurrency(keuangan.saldo)} color="text-blue-600" bgColor="bg-blue-50" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const StatCard = ({ icon, title, value, color, suffix }: { icon: React.ReactNode, title: string, value: number, color: string, suffix?: string }) => {
  const colors: { [key: string]: string } = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
  };
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
      <div className={`p-3 rounded-full ${colors[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}{suffix}</p>
      </div>
    </div>
  );
};

const KeuanganCard = ({ icon, title, value, color, bgColor }: { icon: React.ReactNode, title: string, value: string, color: string, bgColor: string }) => (
  <div className={`p-4 rounded-lg ${bgColor}`}>
    <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-2 ${color} bg-white`}>
      {icon}
    </div>
    <p className="text-xs text-gray-500">{title}</p>
    <p className={`text-lg font-bold ${color}`}>{value}</p>
  </div>
);