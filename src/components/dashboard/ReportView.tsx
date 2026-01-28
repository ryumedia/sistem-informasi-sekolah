// src/components/dashboard/ReportView.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  doc,
  getDoc,
  orderBy,
} from "firebase/firestore";
import { ArrowLeft, Loader2, Calendar, BookOpen, Scaling, Ruler, Baby } from "lucide-react";

// --- Tipe Data ---
interface Aktivitas {
  id: string;
  nama: string;
  urutan: number;
}

interface SubAktivitas {
  id: string;
  nama: string;
  urutan: number;
  aktivitasId: string;
  deskripsi?: string;
}

interface LaporanHarian {
  id: string;
  catatan: string;
  tanggal: Timestamp;
  hasil: { id: string; jawaban: any }[] | Record<string, any>;
}

interface GrowthRecord {
    id: string;
    siswaId: string;
    tanggal: Timestamp;
    lingkarKepala: number;
    tinggiBadan: number;
    beratBadan: number;
}

interface ReportViewProps {
  user: any;
  userData: any;
  onBack: () => void;
}

// --- Helper Functions ---
const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatMonthYear = (date: Date, locale: string = 'id-ID'): string => {
    return date.toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

// --- Komponen Laporan Harian ---
const DailyReportTab = ({ userId }: { userId: string }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [laporan, setLaporan] = useState<LaporanHarian | null>(null);
  const [aktivitasList, setAktivitasList] = useState<Aktivitas[]>([]);
  const [subAktivitasList, setSubAktivitasList] = useState<SubAktivitas[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("User ID tidak ditemukan.");
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const laporanQuery = query(
          collection(db, "daycare_laporan_harian"),
          where("siswaId", "==", userId),
          where("tanggal", ">=", Timestamp.fromDate(startOfDay)),
          where("tanggal", "<=", Timestamp.fromDate(endOfDay))
        );

        const laporanSnapshot = await getDocs(laporanQuery);
        setLaporan(laporanSnapshot.empty ? null : { id: laporanSnapshot.docs[0].id, ...laporanSnapshot.docs[0].data() } as LaporanHarian);

        if (aktivitasList.length === 0) {
            const aktivitasSnapshot = await getDocs(collection(db, "daycare_aktivitas"));
            const aktivitasData = aktivitasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Aktivitas)).sort((a, b) => a.urutan - b.urutan);
            setAktivitasList(aktivitasData);
        }
        if (subAktivitasList.length === 0) {
            const subAktivitasSnapshot = await getDocs(collection(db, "daycare_sub_aktivitas"));
            setSubAktivitasList(subAktivitasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SubAktivitas)));
        }
      } catch (err) {
        console.error("Error fetching daily data: ", err);
        setError("Gagal memuat data laporan harian.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userId, selectedDate]);

  const processedData = useMemo(() => {
    if (!laporan || !laporan.hasil || aktivitasList.length === 0) return [];
    let jawabanMap;
    if (Array.isArray(laporan.hasil)) {
        jawabanMap = new Map(laporan.hasil.map((h: any) => [h.id, h.jawaban]));
    } else {
        jawabanMap = new Map(Object.entries(laporan.hasil));
    }

    return aktivitasList.map((aktivitas) => ({
      ...aktivitas,
      subItems: subAktivitasList
        .filter((sub) => sub.aktivitasId === aktivitas.id)
        .sort((a, b) => a.urutan - b.urutan)
        .map((sub) => {
          const jawabanValue = jawabanMap.get(sub.id);
          let finalJawaban;
          if (jawabanValue === null || jawabanValue === undefined) {
            finalJawaban = "Tidak ada data";
          } else if (Array.isArray(jawabanValue)) {
            const processedAnswers = jawabanValue
              .map(answer => {
                if (typeof answer === 'string' && answer.toLowerCase().startsWith('lainnya:')) {
                  return answer.replace(/^lainnya:?\s*/i, '').trim();
                }
                return answer === 'Lainnya' ? null : answer;
              })
              .filter(answer => answer !== null && answer !== '')
              .join(', ');
            finalJawaban = processedAnswers || "Tidak ada data";
          } else {
            let jawabanAsString = String(jawabanValue);
            if (jawabanAsString.toLowerCase().startsWith('lainnya')) {
              jawabanAsString = jawabanAsString.replace(/^lainnya:?\s*/i, '');
            }
            finalJawaban = jawabanAsString;
          }
          return { ...sub, deskripsi: sub.deskripsi || '', jawaban: finalJawaban };
        }),
    }));
  }, [laporan, aktivitasList, subAktivitasList]);

  return (
    <div className="space-y-4">
        <div className="bg-white p-4 rounded-lg shadow-sm">
            <label htmlFor="report-date" className="block text-sm font-medium text-gray-700 mb-1">Pilih Tanggal Laporan</label>
            <input type="date" id="report-date" value={formatDateForInput(selectedDate)} onChange={(e) => setSelectedDate(new Date(e.target.value))} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"/>
        </div>
        {loading ? <div className="flex justify-center items-center p-10"><Loader2 className="w-8 h-8 text-gray-400 animate-spin" /><span className="ml-2 text-gray-500">Memuat laporan...</span></div>
         : error ? <div className="p-6 text-center text-red-500 bg-red-50 rounded-lg">{error}</div>
         : !laporan ? <div className="p-6 text-center text-gray-500 bg-white rounded-lg shadow-sm">Belum ada laporan harian untuk tanggal ini.</div>
         : (
            <div className="space-y-6">
                {processedData.map((aktivitas) => (
                    <div key={aktivitas.id} className="bg-white p-5 rounded-lg shadow-sm">
                        <h3 className="font-bold text-lg text-gray-800 border-b pb-2 mb-3">{aktivitas.nama}</h3>
                        <ul className="space-y-2">
                            {aktivitas.subItems.map((subItem) => (
                            <li key={subItem.id} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
                                                                <div className="pr-4 flex-1">
                                                                    <p className="text-sm text-gray-700 font-medium">{subItem.nama}</p>
                                                                    {subItem.deskripsi && <p className="text-xs text-gray-500">{subItem.deskripsi}</p>}
                                                                </div>
                                                                <p className="font-semibold text-gray-800 text-right text-sm w-2/5 break-words">
                                                                  {subItem.jawaban}
                                                                </p>
                                                            </li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};

// --- Komponen Laporan Bulanan ---
const MonthlyReportTab = ({ userId }: { userId: string }) => {
    const [allData, setAllData] = useState<GrowthRecord[]>([]);
    const [filteredData, setFilteredData] = useState<GrowthRecord[]>([]);
    const [availableYears, setAvailableYears] = useState<number[]>([]);
    const [selectedYear, setSelectedYear] = useState<string>('semua');
    const [selectedMonth, setSelectedMonth] = useState<string>('semua');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const months = [ "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    const toJsDate = (ts: any): Date => {
        if (!ts) return new Date();
        if (ts instanceof Timestamp) {
            return ts.toDate();
        }
        if (ts && ts.seconds) { // serialized timestamp
            return new Date(ts.seconds * 1000);
        }
        // Fallback for strings or other date representations
        const date = new Date(ts);
        if (isNaN(date.getTime())) {
            console.warn("Invalid date value received:", ts);
            return new Date();
        }
        return date;
    };

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            setError("User ID tidak ditemukan.");
            return;
        }
        const fetchData = async () => {
            setLoading(true);
            try {
                const growthQuery = query(collection(db, "pertumbuhan_anak"), where("siswaId", "==", userId), orderBy("tanggal", "desc"));
                const snapshot = await getDocs(growthQuery);
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GrowthRecord));
                setAllData(data);

                if (data.length > 0) {
                    const years = new Set(data.map(d => toJsDate(d.tanggal).getFullYear()));
                    setAvailableYears(Array.from(years).sort((a,b) => b-a));
                }

            } catch (err) {
                console.error("Error fetching monthly data:", err);
                setError("Gagal memuat data pertumbuhan anak.");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userId]);

    useEffect(() => {
        let data = allData;
        if (selectedYear !== 'semua') {
            data = data.filter(d => toJsDate(d.tanggal).getFullYear() === parseInt(selectedYear));
        }
        if (selectedMonth !== 'semua') {
            data = data.filter(d => toJsDate(d.tanggal).getMonth() === parseInt(selectedMonth));
        }
        setFilteredData(data);
    }, [allData, selectedYear, selectedMonth]);

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-white rounded-lg shadow-sm">
                <div>
                    <label htmlFor="year-filter" className="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
                    <select id="year-filter" value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        <option value="semua">Semua Tahun</option>
                        {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="month-filter" className="block text-sm font-medium text-gray-700 mb-1">Bulan</label>
                    <select id="month-filter" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                        <option value="semua">Semua Bulan</option>
                        {months.map((month, index) => <option key={index} value={index}>{month}</option>)}
                    </select>
                </div>
            </div>

            {loading ? <div className="flex justify-center items-center p-10"><Loader2 className="w-8 h-8 text-gray-400 animate-spin" /><span className="ml-2 text-gray-500">Memuat laporan...</span></div>
             : error ? <div className="p-6 text-center text-red-500 bg-red-50 rounded-lg">{error}</div>
             : filteredData.length === 0 ? <div className="p-6 text-center text-gray-500 bg-white rounded-lg shadow-sm">Tidak ada data pertumbuhan untuk filter yang dipilih.</div>
             : (
                <div className="space-y-4">
                    {filteredData.map(record => (
                        <div key={record.id} className="bg-white p-5 rounded-lg shadow-sm">
                            <h3 className="font-bold text-lg text-blue-600 border-b pb-2 mb-3">{formatMonthYear(toJsDate(record.tanggal))}</h3>
                            <ul className="space-y-3">
                                <li className="flex items-center justify-between text-sm"><span className="flex items-center text-gray-600"><Baby className="w-4 h-4 mr-2 text-gray-400"/>Lingkar Kepala</span><span className="font-bold text-gray-800">{record.lingkarKepala} cm</span></li>
                                <li className="flex items-center justify-between text-sm"><span className="flex items-center text-gray-600"><Ruler className="w-4 h-4 mr-2 text-gray-400"/>Tinggi Badan</span><span className="font-bold text-gray-800">{record.tinggiBadan} cm</span></li>
                                <li className="flex items-center justify-between text-sm"><span className="flex items-center text-gray-600"><Scaling className="w-4 h-4 mr-2 text-gray-400"/>Berat Badan</span><span className="font-bold text-gray-800">{record.beratBadan} kg</span></li>
                            </ul>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Komponen Utama ---
export default function ReportView({ user, userData, onBack }: ReportViewProps) {
  const [activeTab, setActiveTab] = useState("harian");

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <header className="bg-white p-4 shadow-sm sticky top-0 z-10 flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition"><ArrowLeft className="w-5 h-5 text-gray-600" /></button>
        <div>
          <h1 className="text-lg font-bold text-gray-800">Laporan Siswa</h1>
          <p className="text-xs text-gray-500">Laporan aktivitas harian dan bulanan.</p>
        </div>
      </header>

      <div className="p-6">
        <div className="mb-4 border-b border-gray-200">
          <nav className="flex space-x-4" aria-label="Tabs">
            <button onClick={() => setActiveTab("harian")} className={`flex items-center gap-2 px-3 py-2 font-medium text-sm rounded-t-lg ${activeTab === "harian" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              <Calendar className="w-4 h-4" /> Laporan Harian
            </button>
            <button onClick={() => setActiveTab("bulanan")} className={`flex items-center gap-2 px-3 py-2 font-medium text-sm rounded-t-lg ${activeTab === "bulanan" ? "border-b-2 border-blue-500 text-blue-600" : "text-gray-500 hover:text-gray-700"}`}>
              <BookOpen className="w-4 h-4" /> Laporan Bulanan
            </button>
          </nav>
        </div>

        <div>
          {activeTab === "harian" && <DailyReportTab userId={userData.id} />}
          {activeTab === "bulanan" && <MonthlyReportTab userId={userData.id} />}
        </div>
      </div>
    </div>
  );
}

