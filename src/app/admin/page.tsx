"use client";

import { useState, useEffect, useRef } from 'react';
import { useUser } from '@/contexts/UserContext'; // Import the hook
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  orderBy,
  collectionGroup,
  onSnapshot,
  getAggregateFromServer,
  sum,
  average,
  Unsubscribe
} from 'firebase/firestore';
import { Building, Users, UserSquare, Star, ArrowDown, ArrowUp, Scale, Loader2, PieChart, BarChart3, Wallet } from 'lucide-react';

type TabName = 'umum' | 'keuangan' | 'kelas';

interface CabangItem {
  id: string;
  nama: string;
  [key: string]: unknown;
}

interface KelasStatItem {
  id: string;
  namaKelas: string;
  cabang: string;
  laki: number;
  perempuan: number;
  jumlah: number;
}

export default function AdminDashboard() {
  const { userData, isAuthDataLoaded } = useUser();
  const { role: userRole, cabang: userCabang } = userData || {};
  console.log("[AdminDashboard] Rendered with context:", { userRole, userCabang, isAuthDataLoaded });
  const [cabangList, setCabangList] = useState<CabangItem[]>([]);
  const [selectedCabang, setSelectedCabang] = useState<string>("");
  const [kelasStatsList, setKelasStatsList] = useState<KelasStatItem[]>([]);

  const [activeTab, setActiveTab] = useState<TabName>('umum');
  const [loadingTab, setLoadingTab] = useState(false);

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

  // Ref untuk update incremental (listener menulis field-nya sendiri saja)
  const statsRef = useRef({ kelas: 0, siswa: 0, guru: 0, performance: 0 });
  const kelasStatsUnsubs = useRef<Unsubscribe[]>([]);

  // Fetch Cabang List for Filter
  useEffect(() => {
    const fetchCabang = () => {
      try {
        // onSnapshot: hasil instan dari cache lokal, update realtime dari server
        const unsub = onSnapshot(query(collection(db, "cabang"), orderBy("nama", "asc")), (snap) => {
          setCabangList(snap.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              nama: (data.nama as string) || "",
              ...data
            };
          }));
        });
        return unsub;
      } catch (err) {
        console.error("Error fetching cabang list:", err);
        return undefined;
      }
    };
    const cleanup = fetchCabang();
    return () => cleanup?.();
  }, []);

  useEffect(() => {
    if (userRole === "Kepala Sekolah" && userCabang) {
      setSelectedCabang(userCabang || ""); // Memastikan selectedCabang selalu berupa string
    }
  }, [userRole, userCabang]);

  // Fetch data when activeTab or selectedCabang changes
  useEffect(() => {
    if (!isAuthDataLoaded || (userRole && ["Guru", "Caregiver"].includes(userRole))) {
      return;
    }

    const getBaseQuery = (col: string) => selectedCabang ? query(collection(db, col), where("cabang", "==", selectedCabang)) : collection(db, col);

    const fetchGeneralStats = () => {
      const getBaseCountQuery = (col: string, extra: ReturnType<typeof where>[] = []) =>
        query(collection(db, col), ...(selectedCabang ? [where("cabang", "==", selectedCabang)] : []), ...extra);

      // Pakai onSnapshot: angka muncul instan dari cache lokal, lalu realtime
      const unsubKelas = onSnapshot(getBaseCountQuery("kelas"), snap => {
        statsRef.current.kelas = snap.size;
        setStats({ ...statsRef.current });
      }, e => console.error(e));

      const unsubSiswa = onSnapshot(getBaseCountQuery("siswa", [where("status", "==", "Aktif")]), snap => {
        statsRef.current.siswa = snap.size;
        setStats({ ...statsRef.current });
      }, e => console.error(e));

      const unsubGuru = onSnapshot(getBaseCountQuery("guru"), snap => {
        statsRef.current.guru = snap.size;
        setStats({ ...statsRef.current });
      }, e => console.error(e));

      const pQuery = selectedCabang
        ? query(collectionGroup(db, 'kpi_guru'), where('cabang', '==', selectedCabang))
        : collectionGroup(db, 'kpi_guru');

      // Agregasi KPI tetap sekali ambil (tidak bisa di-cache seperti count)
      getAggregateFromServer(pQuery, { avg: average('persentase') })
        .then(agg => {
          statsRef.current.performance = parseFloat((agg.data().avg || 0).toFixed(2));
          setStats({ ...statsRef.current });
        })
        .catch(e => console.warn("KPI aggregation skipped or failed:", e));

      return () => { unsubKelas(); unsubSiswa(); unsubGuru(); };
    };

    const fetchKeuanganStats = async () => {
      try {
        const qPemasukan = query(collection(db, "arus_kas"), ...(selectedCabang ? [where("cabang", "==", selectedCabang)] : []), where("jenis", "==", "Masuk"));
        const qPengeluaran = query(collection(db, "arus_kas"), ...(selectedCabang ? [where("cabang", "==", selectedCabang)] : []), where("jenis", "==", "Keluar"));

        const [pemasukanAgg, pengeluaranAgg] = await Promise.all([
          getAggregateFromServer(qPemasukan, { total: sum("nominal") }).catch(() => ({ data: () => ({ total: 0 }) })),
          getAggregateFromServer(qPengeluaran, { total: sum("nominal") }).catch(() => ({ data: () => ({ total: 0 }) })),
        ]);

        const pemasukan = pemasukanAgg.data().total || 0;
        const pengeluaran = pengeluaranAgg.data().total || 0;
        setKeuangan({ pemasukan, pengeluaran, saldo: pemasukan - pengeluaran });
      } catch (err) {
        console.error("Error fetching keuangan stats:", err);
      }
    };

    const fetchKelasStats = () => {
      // 1. onSnapshot kelas — instan dari cache lokal
      const unsubKelas = onSnapshot(getBaseQuery("kelas"), kelasSnap => {
        const classes = kelasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string; namaKelas?: string; cabang?: string }));

        // 2. onSnapshot siswa aktif — instan dari cache lokal
        const unsubSiswa = onSnapshot(query(getBaseQuery("siswa"), where("status", "==", "Aktif")), siswaSnap => {
          const genderCounts: Record<string, { laki: number; perempuan: number }> = {};

          siswaSnap.docs.forEach(sdoc => {
            const data = sdoc.data() as { cabang?: string; kelas?: string; jenisKelamin?: string };
            const key = `${data.cabang || ''}_${data.kelas || ''}`;
            if (!genderCounts[key]) genderCounts[key] = { laki: 0, perempuan: 0 };
            if (data.jenisKelamin === 'Laki-laki') genderCounts[key].laki += 1;
            else if (data.jenisKelamin === 'Perempuan') genderCounts[key].perempuan += 1;
          });

          const processedKelasStats: KelasStatItem[] = classes.map((cls: { id: string; namaKelas?: string; cabang?: string }) => {
            const key = `${cls.cabang || ''}_${cls.namaKelas || ''}`;
            const counts = genderCounts[key] || { laki: 0, perempuan: 0 };
            return {
              id: cls.id,
              namaKelas: cls.namaKelas || '',
              cabang: cls.cabang || '',
              laki: counts.laki,
              perempuan: counts.perempuan,
              jumlah: counts.laki + counts.perempuan
            };
          });

          processedKelasStats.sort((a, b) => {
            if (a.cabang !== b.cabang) return a.cabang.localeCompare(b.cabang);
            return a.namaKelas.localeCompare(b.namaKelas);
          });

          setKelasStatsList(processedKelasStats);
        }, err => console.error("Error fetching siswa stats:", err));

        kelasStatsUnsubs.current.push(unsubSiswa);
      }, err => console.error("Error fetching kelas stats:", err));

      kelasStatsUnsubs.current.push(unsubKelas);
    };

    // Setup listener sinkron — cleanup dijalankan langsung saat efek re-run
    setLoadingTab(true);
    let cleanup: (() => void) | undefined;
    const run = async () => {
      try {
        if (activeTab === 'umum') cleanup = fetchGeneralStats();
        else if (activeTab === 'kelas') {
          fetchKelasStats();
          cleanup = () => { kelasStatsUnsubs.current.forEach(u => u()); kelasStatsUnsubs.current = []; };
        }
        else if (activeTab === 'keuangan') await fetchKeuanganStats();
      } catch (error) {
        console.error(`Error fetching data for tab ${activeTab}:`, error);
      } finally {
        setLoadingTab(false);
      }
    };
    run();
    return () => cleanup?.();
  }, [activeTab, selectedCabang, isAuthDataLoaded, userRole]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <div>
          <label className="text-xs font-medium text-gray-500 mr-2">Filter Cabang:</label>
          <select
            value={selectedCabang}
            onChange={(e) => setSelectedCabang(e.target.value)}
            disabled={userRole === "Kepala Sekolah"}
            className={`border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] ${userRole === "Kepala Sekolah" ? "bg-gray-100 cursor-not-allowed" : ""}`}
          >
            {userRole !== "Kepala Sekolah" && userRole !== "Guru" && <option value="">Semua Cabang</option>}
            {cabangList.map(c => <option key={c.id} value={c.nama}>{c.nama}</option>)}
          </select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6" aria-label="Tabs">
          <TabButton icon={<PieChart />} label="Ringkasan Umum" isActive={activeTab === 'umum'} onClick={() => setActiveTab('umum')} />
          <TabButton icon={<Wallet />} label="Keuangan" isActive={activeTab === 'keuangan'} onClick={() => setActiveTab('keuangan')} />
          <TabButton icon={<BarChart3 />} label="Siswa per Kelas" isActive={activeTab === 'kelas'} onClick={() => setActiveTab('kelas')} />
        </nav>
      </div>

      {loadingTab ? (
        <div className="w-full text-center py-10">
          <Loader2 className="w-8 h-8 animate-spin text-[#581c87] mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Memuat data...</p>
        </div>
      ) : (
        <div className="animate-fadeIn">
          {activeTab === 'umum' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard icon={<Building />} title="Jumlah Kelas" value={stats.kelas} color="blue" />
              <StatCard icon={<Users />} title="Jumlah Siswa" value={stats.siswa} color="green" />
              <StatCard icon={<UserSquare />} title="Jumlah Guru" value={stats.guru} color="orange" />
              <StatCard icon={<Star />} title="Nilai Performance" value={stats.performance} color="purple" suffix="%" />
            </div>
          )}

          {activeTab === 'keuangan' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Rekap Keuangan {selectedCabang && `(${selectedCabang})`}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <KeuanganCard icon={<ArrowDown />} title="Total Pemasukan" value={formatCurrency(keuangan.pemasukan)} color="text-green-600" bgColor="bg-green-50" />
                <KeuanganCard icon={<ArrowUp />} title="Total Pengeluaran" value={formatCurrency(keuangan.pengeluaran)} color="text-red-600" bgColor="bg-red-50" />
                <KeuanganCard icon={<Scale />} title="Saldo Akhir" value={formatCurrency(keuangan.saldo)} color="text-blue-600" bgColor="bg-blue-50" />
              </div>
            </div>
          )}

          {activeTab === 'kelas' && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Data Siswa per Kelas</h2>
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
          )}
        </div>
      )}
    </div>
  );
}

const StatCard = ({ icon, title, value, color, suffix }: { icon: React.ReactNode, title: string, value: number, color: string, suffix?: string }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    orange: 'bg-orange-100 text-orange-600',
    purple: 'bg-purple-100 text-purple-600',
  };
  return (
    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center gap-5">
      <div className={`p-3 rounded-full ${colors[color] || 'bg-gray-100 text-gray-600'}`}>
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

const TabButton = ({ icon, label, isActive, onClick }: { icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ease-in-out
      ${isActive
        ? 'border-purple-600 text-purple-600'
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }`}
  >
    {icon} {label}
  </button>
);