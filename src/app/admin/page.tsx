"use client";

import { useState, useEffect } from 'react';
import { useUser } from '@/contexts/UserContext'; // Import the hook
import { db } from '@/lib/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  collectionGroup,
  getCountFromServer,
  getAggregateFromServer,
  sum,
  average
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

  // Fetch Cabang List for Filter
  useEffect(() => {
    const fetchCabang = async () => {
      try {
        const snapCabang = await getDocs(query(collection(db, "cabang"), orderBy("nama", "asc")));
        setCabangList(snapCabang.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            nama: (data.nama as string) || "",
            ...data
          };
        }));
      } catch (err) {
        console.error("Error fetching cabang list:", err);
      }
    };
    fetchCabang();
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

    const fetchGeneralStats = async () => {
      try {
        const kelasPromise = getCountFromServer(getBaseQuery("kelas")).catch(e => { console.error(e); return { data: () => ({ count: 0 }) }; });
        const siswaPromise = getCountFromServer(query(getBaseQuery("siswa"), where("status", "==", "Aktif"))).catch(e => { console.error(e); return { data: () => ({ count: 0 }) }; });
        const guruPromise = getCountFromServer(getBaseQuery("guru")).catch(e => { console.error(e); return { data: () => ({ count: 0 }) }; });

        const pQuery = selectedCabang
          ? query(collectionGroup(db, 'kpi_guru'), where('cabang', '==', selectedCabang))
          : collectionGroup(db, 'kpi_guru');

        const perfPromise = getAggregateFromServer(pQuery, { avg: average('persentase') }).catch(e => {
          console.warn("KPI aggregation skipped or failed:", e);
          return { data: () => ({ avg: 0 }) };
        });

        const [kelasCountSnap, siswaAktifCountSnap, guruCountSnap, perfAgg] = await Promise.all([
          kelasPromise,
          siswaPromise,
          guruPromise,
          perfPromise
        ]);

        const avgPerformance = perfAgg.data().avg || 0;
        setStats({
          kelas: kelasCountSnap.data().count,
          siswa: siswaAktifCountSnap.data().count,
          guru: guruCountSnap.data().count,
          performance: parseFloat(avgPerformance.toFixed(2)),
        });
      } catch (err) {
        console.error("Error fetching general stats:", err);
      }
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

    const fetchKelasStats = async () => {
      try {
        // 1. Fetch kumpul kelas (1 query)
        const kelasSnap = await getDocs(getBaseQuery("kelas"));
        const classes = kelasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string; namaKelas?: string; cabang?: string }));

        // 2. Fetch seluruh siswa aktif dalam 1 QUERY tunggal (bukan N*2 query!)
        const siswaQuery = query(getBaseQuery("siswa"), where("status", "==", "Aktif"));
        const siswaSnap = await getDocs(siswaQuery);

        // 3. Kelompokkan jumlah siswa per kelas & jenis kelamin di memori (Sangat Cepat!)
        const genderCounts: Record<string, { laki: number; perempuan: number }> = {};

        siswaSnap.docs.forEach(doc => {
          const data = doc.data() as { cabang?: string; kelas?: string; jenisKelamin?: string };
          const key = `${data.cabang || ''}_${data.kelas || ''}`;
          if (!genderCounts[key]) {
            genderCounts[key] = { laki: 0, perempuan: 0 };
          }
          if (data.jenisKelamin === 'Laki-laki') {
            genderCounts[key].laki += 1;
          } else if (data.jenisKelamin === 'Perempuan') {
            genderCounts[key].perempuan += 1;
          }
        });

        // 4. Susun hasil
        const processedKelasStats: KelasStatItem[] = classes.map(cls => {
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
      } catch (err) {
        console.error("Error fetching kelas stats:", err);
      }
    };

    const loadTabData = async () => {
      setLoadingTab(true);
      try {
        if (activeTab === 'umum') await fetchGeneralStats();
        if (activeTab === 'keuangan') await fetchKeuanganStats();
        if (activeTab === 'kelas') await fetchKelasStats();
      } catch (error) {
        console.error(`Error fetching data for tab ${activeTab}:`, error);
      } finally {
        setLoadingTab(false);
      }
    };

    loadTabData();
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