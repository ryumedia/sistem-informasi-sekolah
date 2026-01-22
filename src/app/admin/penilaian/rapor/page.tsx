"use client";
import { useState, useRef, useEffect, useMemo } from 'react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Printer, Loader2 } from 'lucide-react';
import TemplateRapor from '@/components/TemplateRapor';

interface Html2PdfOptions {
  margin?: any;
  filename?: string;
  image?: {
    type?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  };
  html2canvas?: {
    scale?: number;
    useCORS?: boolean;
    scrollY?: number;
    [key: string]: any;
  };
  jsPDF?: {
    unit?: string;
    format?: string;
    orientation?: string;
    [key: string]: any;
  };
  pagebreak?: {
    mode?: string | string[];
    before?: string | string[];
    after?: string | string[];
    avoid?: string | string[];
  };
  [key: string]: any;
}


interface Siswa {
  id: string;
  nama: string;
  kelas: string;
  nis: string;
  nisn: string;
  foto?: string; // Sesuaikan dengan field di database
  cabang?: string;
}

interface Cabang {
  id: string;
  nama: string;
}

interface Semester {
  id: string;
  namaPeriode: string;
  isDefault?: boolean;
}

interface Kelas {
  id: string;
  namaKelas: string;
  cabang: string;
  guruKelas?: string[];
}

const RaporPage = () => {
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [selectedSiswaId, setSelectedSiswaId] = useState<string | null>(null);
  const [selectedKelas, setSelectedKelas] = useState<string>('');
  const [narasi, setNarasi] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [fetchingSiswa, setFetchingSiswa] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");

  // Master Data State
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [semesterList, setSemesterList] = useState<Semester[]>([]);
  const [kelasListData, setKelasListData] = useState<Kelas[]>([]);
  const [selectedCabangId, setSelectedCabangId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');

  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSiswa = async () => {
      setFetchingSiswa(true);
      setFetchError(null);
      try {
        // 1. Fetch Cabang
        const snapCabang = await getDocs(query(collection(db, "cabang"), orderBy("nama", "asc")));
        setCabangList(snapCabang.docs.map(d => ({ id: d.id, ...d.data() } as Cabang)));

        // 2. Fetch Semester
        const snapSemester = await getDocs(query(collection(db, "kpi_periode"), orderBy("namaPeriode", "asc")));
        const semesters = snapSemester.docs.map(d => ({ id: d.id, ...d.data() } as Semester));
        setSemesterList(semesters);
        
        // Set Default Semester
        const defaultSem = semesters.find(s => s.isDefault);
        if (defaultSem) setSelectedSemesterId(defaultSem.id);

        // 3. Fetch Kelas
        const snapKelas = await getDocs(query(collection(db, "kelas"), orderBy("namaKelas", "asc")));
        setKelasListData(snapKelas.docs.map(d => ({ id: d.id, ...d.data() } as Kelas)));

        // 4. Fetch Siswa
        const snapSiswa = await getDocs(query(collection(db, "siswa"), orderBy("nama", "asc")));
        setSiswaList(snapSiswa.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Siswa[]);
      } catch (error) {
        console.error("Error fetching siswa: ", error);
        setFetchError("Gagal memuat data siswa. Silakan coba lagi nanti.");
      } finally {
        setFetchingSiswa(false);
      }
    };
    fetchSiswa();
  }, []);

  // Auth & Role Logic
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser && cabangList.length > 0 && kelasListData.length > 0) {
        try {
          const q = query(collection(db, "guru"), where("email", "==", currentUser.email));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            const userData = querySnapshot.docs[0].data();
            setUserRole(userData.role);

            if (userData.role === "Kepala Sekolah" || userData.role === "Guru") {
              const userCabangName = userData.cabang;
              const foundCabang = cabangList.find(c => c.nama === userCabangName);
              
              if (foundCabang) {
                setSelectedCabangId(foundCabang.id);
                
                if (userData.role === "Guru") {
                   const guruName = userData.nama;
                   const foundKelas = kelasListData.find(k => k.guruKelas && k.guruKelas.includes(guruName) && k.cabang === userCabangName);
                   if (foundKelas) {
                     setSelectedKelas(foundKelas.namaKelas);
                   }
                }
              }
            }
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      }
    });
    return () => unsubscribe();
  }, [cabangList, kelasListData]);

  // Filter Kelas based on Selected Cabang
  const filteredKelasOptions = useMemo(() => {
    if (!selectedCabangId) return [];
    const selectedCabang = cabangList.find(c => c.id === selectedCabangId);
    if (!selectedCabang) return [];
    return kelasListData.filter(k => k.cabang === selectedCabang.nama);
  }, [selectedCabangId, cabangList, kelasListData]);

  const filteredSiswa = useMemo(() => {
    let students = siswaList;

    // Filter by Cabang
    if (selectedCabangId) {
      const selectedCabang = cabangList.find(c => c.id === selectedCabangId);
      if (selectedCabang) {
        students = students.filter(s => s.cabang === selectedCabang.nama);
      }
    }

    // Filter by Selected Kelas
    if (selectedKelas) {
      students = students.filter(s => s.kelas === selectedKelas);
    }
    
    return students;
  }, [siswaList, selectedCabangId, cabangList, selectedKelas]);

  const selectedSiswa = useMemo(() => {
    if (!selectedSiswaId) return null;
    return siswaList.find(s => s.id === selectedSiswaId) || null;
  }, [selectedSiswaId, siswaList]);

  const handleSiswaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSiswaId(e.target.value);
    setShowPreview(false); 
  };

  useEffect(() => {
    if (selectedSiswa) {
      setNarasi(`Berikut adalah laporan perkembangan untuk ananda ${selectedSiswa.nama}. Secara umum, ananda menunjukkan perkembangan yang positif dan antusias dalam mengikuti kegiatan belajar.`);
    } else {
      setNarasi('');
    }
  }, [selectedSiswa]);

  const handleCabangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCabangId(e.target.value);
    setSelectedKelas(''); // Reset kelas
    setSelectedSiswaId(null);
    setShowPreview(false);
  };

  const handleKelasChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedKelas(e.target.value);
    setSelectedSiswaId(null); // Reset pilihan siswa saat kelas diganti
    setShowPreview(false);
    setNarasi('');
  };

  const generateNarasiAI = async () => {
    if (!selectedSiswa) {
      alert("Pilih siswa terlebih dahulu.");
      return;
    }
    setIsGeneratingAI(true);
    
    // Simulating a call to an AI API
    await new Promise(resolve => setTimeout(resolve, 1500));

    const aiText = "Dalam aspek kognitif, ananda menunjukkan kemampuan pemecahan masalah yang baik untuk usianya. Interaksi sosial dengan teman sebaya juga sangat aktif dan positif.";
    
    setNarasi(prevNarasi => {
      if (prevNarasi.includes(aiText)) {
        return prevNarasi;
      }
      return `${prevNarasi} ${aiText}`;
    });
    
    setIsGeneratingAI(false);
  };
  
  const handlePreview = () => {
    if (!selectedSiswaId) {
      alert("Pilih siswa terlebih dahulu.");
      return;
    }
    if (!narasi) {
      alert("Narasi tidak boleh kosong. Buat narasi secara manual atau gunakan AI.");
      return;
    }
    setShowPreview(true);
  };

  const handlePrint = async () => {
    if (typeof window !== "undefined" && componentRef.current) {
      setIsPrinting(true);
      // Give UI a moment to update
      await new Promise(resolve => setTimeout(resolve, 100));
      try {
      // Dynamic import html2pdf agar tidak error di server side
        const module = await import("html2pdf.js");
        const html2pdf = module.default || module;
        const element = componentRef.current;
        
        const opt: any = {
          margin: 10,
          filename: `Rapor_${selectedSiswa?.nama || 'Siswa'}_${new Date().getTime()}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
            scale: 2, 
            useCORS: true, 
            scrollY: 0,
            backgroundColor: '#ffffff' // Memaksa background putih hex
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // Pisahkan worker agar bisa memanggil .save() setelah manipulasi selesai
        const worker = html2pdf().from(element).set(opt).toPdf();

        await worker.get('pdf').then((pdf: any) => {
          const totalPages = pdf.internal.getNumberOfPages();
          const siswaName = selectedSiswa?.nama || "";
          
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(9);
            pdf.setTextColor(150);
            pdf.text(`${i} - ${siswaName}`, 10, 292);
          }
        });

        await worker.save();
      } catch (err) {
        console.error("Print error:", err);
        alert("Gagal mencetak PDF.");
      } finally {
        setIsPrinting(false);
      }
    }
  };


  return (
    <div className="container mx-auto p-6 bg-gray-50 min-h-screen">
      <h1 className="text-4xl font-bold mb-8 text-gray-800">Cetak Rapor Siswa</h1>

      {/* Panel Kontrol */}
      {fetchingSiswa ? (
        <p className="text-center text-gray-500">Memuat data siswa...</p>
      ) : fetchError ? (
        <p className="text-center text-red-500">{fetchError}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-6 bg-white rounded-xl shadow-md">
          {/* Pilih Cabang */}
          <div>
            <label htmlFor="cabang-select" className="block text-lg font-medium text-gray-700 mb-2">
              Pilih Cabang
            </label>
            <select
              id="cabang-select"
              value={selectedCabangId}
              onChange={handleCabangChange}
              className={`w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 transition ${userRole === "Kepala Sekolah" || userRole === "Guru" ? "bg-gray-100 cursor-not-allowed" : ""}`}
              disabled={userRole === "Kepala Sekolah" || userRole === "Guru"}
            >
              <option value="">-- Pilih Cabang --</option>
              {cabangList.map(c => (
                <option key={c.id} value={c.id}>{c.nama}</option>
              ))}
            </select>
          </div>

          {/* Pilih Semester */}
          <div>
            <label htmlFor="semester-select" className="block text-lg font-medium text-gray-700 mb-2">
              Pilih Semester
            </label>
            <select
              id="semester-select"
              value={selectedSemesterId}
              onChange={(e) => setSelectedSemesterId(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 transition"
            >
              <option value="">-- Pilih Semester --</option>
              {semesterList.map(s => (
                <option key={s.id} value={s.id}>{s.namaPeriode} {s.isDefault ? "(Default)" : ""}</option>
              ))}
            </select>
          </div>

          {/* Filter Kelas */}
          <div>
            <label htmlFor="kelas-select" className="block text-lg font-medium text-gray-700 mb-2">
              Pilih Kelas
            </label>
            <select
              id="kelas-select"
              value={selectedKelas}
              onChange={handleKelasChange}
              disabled={!selectedCabangId || userRole === "Guru"}
              className={`w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 transition ${!selectedCabangId || userRole === "Guru" ? "bg-gray-100 cursor-not-allowed" : ""}`}
            >
              <option value="">-- Semua Kelas --</option>
              {filteredKelasOptions.map(k => (
                <option key={k.id} value={k.namaKelas}>{k.namaKelas}</option>
              ))}
            </select>
          </div>

          {/* Pilih Siswa */}
          <div>
            <label htmlFor="siswa-select" className="block text-lg font-medium text-gray-700 mb-2">
              Pilih Siswa
            </label>
            <select
              id="siswa-select"
              value={selectedSiswaId || ''}
              onChange={handleSiswaChange}
              disabled={!filteredSiswa.length}
              className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 transition disabled:bg-gray-100"
            >
              <option value="" disabled>-- Pilih Siswa --</option>
              {filteredSiswa.map(siswa => (
                <option key={siswa.id} value={siswa.id}>{siswa.nama}</option>
              ))}
            </select>
          </div>
        </div>
      )}
      
      {/* Editor Narasi */}
      {selectedSiswaId && (
        <div className="mb-8 p-6 bg-white rounded-xl shadow-md">
           <h2 className="text-2xl font-semibold mb-4 text-gray-700">Narasi Rapor</h2>
           <textarea
             value={narasi}
             onChange={(e) => setNarasi(e.target.value)}
             rows={6}
             className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
             placeholder="Tuliskan narasi perkembangan siswa di sini..."
           />
           <div className="mt-4 flex justify-end">
             <button 
                onClick={generateNarasiAI} 
                disabled={isGeneratingAI}
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingAI ? <Loader2 className="w-5 h-5 animate-spin"/> : "✨"}
                {isGeneratingAI ? "Membuat Narasi..." : "Buat dengan AI"}
             </button>
           </div>
        </div>
      )}

      {/* Tombol Aksi */}
      <div className="flex gap-4 mb-8">
        <button 
          onClick={handlePreview}
          disabled={!selectedSiswaId || !narasi}
          className="flex-1 bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition font-bold disabled:opacity-50"
        >
          Tampilkan Preview Rapor
        </button>
        <button 
          onClick={handlePrint}
          disabled={!showPreview || isPrinting}
          className="flex-1 bg-[#581c87] text-white px-4 py-3 rounded-lg hover:bg-[#45156b] transition flex items-center justify-center gap-2 font-bold disabled:opacity-50"
        >
          {isPrinting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Printer className="w-5 h-5" />}
          {isPrinting ? "Memproses PDF..." : "Cetak PDF"}
        </button>
      </div>

      {/* Preview Rapor */}
      {showPreview && selectedSiswa && (
        <div className="p-6 bg-white rounded-xl shadow-lg">
          <h2 className="text-3xl font-bold mb-6 text-center text-gray-800">Preview Rapor</h2>
          <div ref={componentRef} className="flex justify-center">
            <TemplateRapor 
              siswa={selectedSiswa} 
              narasi={narasi} 
              semesterId={selectedSemesterId}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RaporPage;