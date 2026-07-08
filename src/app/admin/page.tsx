"use client";

import { useState, useEffect } from 'react';
import { db, auth } from '@/lib/firebase';
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
import { onAuthStateChanged } from 'firebase/auth';
import { Building, Users, UserSquare, Star, ArrowDown, ArrowUp, Scale, Loader2 } from 'lucide-react';

export default function AdminDashboard() {
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [selectedCabang, setSelectedCabang] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingTable, setLoadingTable] = useState(false);
  const [kelasStatsList, setKelasStatsList] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [isAuthReady, setIsAuthReady] = useState(false);

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
    // --- OPTIMISASI: Tahap 1 (Sinkron) ---
    // Baca cache dari localStorage secara langsung saat komponen pertama kali render.
    // Ini membuat UI terasa instan pada kunjungan berikutnya.
    const cachedRole = localStorage.getItem('user_role');
    const cachedCabang = localStorage.getItem('user_cabang');
    
    if (cachedRole) {
      setUserRole(cachedRole);
      // Hanya set cabang dari cache jika rolenya memang memerlukan filter cabang spesifik.
      if (cachedCabang && (cachedRole === "Kepala Sekolah" || cachedRole === "Guru")) {
        setSelectedCabang(cachedCabang);
      }
      setIsAuthReady(true);
    }

    // --- OPTIMISASI: Tahap 2 (Asinkron) ---
    // Jalankan listener otentikasi dan fetch data terbaru di latar belakang.
    // Ini akan memvalidasi ulang dan memperbarui cache jika ada perubahan.
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const qUser = query(collection(db, "guru"), where("email", "==", currentUser.email));
          const userSnap = await getDocs(qUser);

          if (!userSnap.empty) {
            const userData = userSnap.docs[0].data();
            setUserRole(userData.role);
            localStorage.setItem('user_role', userData.role);
            if (userData.role === "Kepala Sekolah" || userData.role === "Guru") {
              setSelectedCabang(userData.cabang);
              localStorage.setItem('user_cabang', userData.cabang);
            }
          }
        }
        catch (error) { console.error("Error fetching user data:", error); }
      } else {
        localStorage.removeItem('user_role');
        localStorage.removeItem('user_cabang');
      }
      // Tandai bahwa proses otentikasi (baik login maupun logout) telah selesai.
      if (!isAuthReady) setIsAuthReady(true);
    });

    // Ambil daftar cabang untuk filter
    const fetchCabang = async () => {
      const snapCabang = await getDocs(query(collection(db, "cabang"), orderBy("nama", "asc")));
      setCabangList(snapCabang.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchCabang();
    return () => unsubscribe();
  }, []);

  // Fetch Dashboard Data based on Filter
  useEffect(() => {
    if (!isAuthReady) return; // Jangan fetch data sebelum role/cabang user dipastikan

    // Cegah fetching data dashboard jika role adalah Guru atau Caregiver (karena akan diredirect)
    if (["Guru", "Caregiver"].includes(userRole)) return;

    const fetchData = async () => {
      setLoading(true);
      setLoadingTable(true);
      const getBaseQuery = (col: string) => selectedCabang ? query(collection(db, col), where("cabang", "==", selectedCabang)) : collection(db, col);

      try {
        const pQuery = selectedCabang
            ? query(collectionGroup(db, 'kpi_guru'), where('cabang', '==', selectedCabang))
            : collectionGroup(db, 'kpi_guru');

        const qPemasukan = query(collection(db, "arus_kas"), ...(selectedCabang ? [where("cabang", "==", selectedCabang)] : []), where("jenis", "==", "Masuk"));
        const qPengeluaran = query(collection(db, "arus_kas"), ...(selectedCabang ? [where("cabang", "==", selectedCabang)] : []), where("jenis", "==", "Keluar"));

        // PHASE 1: JALANKAN QUERY AGREGASI (SANGAT CEPAT)
        const [
          kelasCountSnap,
          siswaAktifCountSnap,
          guruCountSnap,
          pemasukanAgg,
          pengeluaranAgg,
          perfAgg
        ] = await Promise.all([
          getCountFromServer(getBaseQuery("kelas")),
          getCountFromServer(query(getBaseQuery("siswa"), where("status", "==", "Aktif"))),
          getCountFromServer(getBaseQuery("guru")),
          getAggregateFromServer(qPemasukan, { total: sum("nominal") }),
          getAggregateFromServer(qPengeluaran, { total: sum("nominal") }),
          getAggregateFromServer(pQuery, { avg: average('persentase') })
        ]);

        const pemasukan = pemasukanAgg.data().total || 0;
        const pengeluaran = pengeluaranAgg.data().total || 0;
        const avgPerformance = perfAgg.data().avg || 0;

        setKeuangan({ pemasukan, pengeluaran, saldo: pemasukan - pengeluaran });
        setStats({
          kelas: kelasCountSnap.data().count,
          siswa: siswaAktifCountSnap.data().count,
          guru: guruCountSnap.data().count,
          performance: parseFloat(avgPerformance.toFixed(2)),
        });

        // Sembunyikan loading utama agar Card dan Keuangan segera muncul
        setLoading(false);

        // PHASE 2: AMBIL DATA DETAIL UNTUK TABEL (DI LATAR BELAKANG)
        const kelasSnap = await getDocs(getBaseQuery("kelas"));
        const classes = kelasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

        let processedKelasStats: any[] = [];

        if (selectedCabang) {
          // Strategi 1: Jika cabang spesifik dipilih, ambil semua siswa di cabang itu dan agregasi di memori.
          // Ini efisien jika jumlah siswa per cabang tidak terlalu besar.
          const siswaSnap = await getDocs(query(getBaseQuery("siswa"), where("status", "==", "Aktif"))); // getBaseQuery sudah memfilter berdasarkan cabang
          const allSiswaInCabang = siswaSnap.docs.map(doc => doc.data());

          processedKelasStats = classes.map((cls) => {
            const siswaDiKelas = allSiswaInCabang.filter(s =>
              s.kelas === cls.namaKelas // Cabang sudah difilter oleh allSiswaInCabang
            );

            const laki = siswaDiKelas.filter(s => s.jenisKelamin === 'Laki-laki').length;
            const perempuan = siswaDiKelas.filter(s => s.jenisKelamin === 'Perempuan').length;

            return {
              id: cls.id,
              namaKelas: cls.namaKelas,
              cabang: cls.cabang,
              laki,
              perempuan,
              jumlah: laki + perempuan
            };
          });
        } else {
          // Optimasi Strategi 2: Ambil semua siswa sekali saja jika datanya tidak jutaan, 
          // daripada melakukan ratusan request individual (N+1 query problem).
          const siswaSnap = await getDocs(query(collection(db, "siswa"), where("status", "==", "Aktif")));
          const allSiswa = siswaSnap.docs.map(doc => doc.data());

          processedKelasStats = classes.map((cls) => {
            const diKelas = allSiswa.filter(s => s.cabang === cls.cabang && s.kelas === cls.namaKelas);
            const laki = diKelas.filter(s => s.jenisKelamin === 'Laki-laki').length;
            const perempuan = diKelas.filter(s => s.jenisKelamin === 'Perempuan').length;
            
            return { 
              id: cls.id, 
              namaKelas: cls.namaKelas, 
              cabang: cls.cabang, 
              laki, 
              perempuan, 
              jumlah: laki + perempuan 
            };
          });
        }

        // Sort: Cabang ASC, then Nama Kelas ASC
        processedKelasStats.sort((a: any, b: any) => {
             if (a.cabang !== b.cabang) return a.cabang.localeCompare(b.cabang);
             return a.namaKelas.localeCompare(b.namaKelas);
        });
        setKelasStatsList(processedKelasStats);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
        setLoadingTable(false);
      }
    };

    fetchData();
  }, [selectedCabang, isAuthReady, userRole]);

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

      {/* 
          Gunakan pengecekan isAuthReady dan userRole di sini. 
          Jika role dilarang, tampilkan loader saja sambil menunggu redirect dari Layout.
      */}
      {!isAuthReady || ["Guru", "Caregiver"].includes(userRole) ? (
        <div className="w-full text-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#581c87] mx-auto" />
          <p className="text-sm text-gray-500 mt-2">Memeriksa hak akses...</p>
        </div>
      ) : loading ? (
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

          {/* Keuangan Recap */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Rekap Keuangan {selectedCabang && `(${selectedCabang})`}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <KeuanganCard icon={<ArrowDown />} title="Total Pemasukan" value={formatCurrency(keuangan.pemasukan)} color="text-green-600" bgColor="bg-green-50" />
              <KeuanganCard icon={<ArrowUp />} title="Total Pengeluaran" value={formatCurrency(keuangan.pengeluaran)} color="text-red-600" bgColor="bg-red-50" />
              <KeuanganCard icon={<Scale />} title="Saldo Akhir" value={formatCurrency(keuangan.saldo)} color="text-blue-600" bgColor="bg-blue-50" />
            </div>
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
                  {loadingTable ? (
                    <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                  ) : kelasStatsList.length === 0 ? (
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