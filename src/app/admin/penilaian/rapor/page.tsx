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
  const [catatanGuru, setCatatanGuru] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [fetchingSiswa, setFetchingSiswa] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  // Nama guru yang sedang login (untuk membatasi kelas yang boleh dipilih)
  const [guruNama, setGuruNama] = useState<string>("");
  // Penanda agar fetch master data hanya berjalan sekali (StrictMode dev menjalankan effect 2x)
  const hasFetchedRef = useRef(false);

  // Master Data State
  const [cabangList, setCabangList] = useState<Cabang[]>([]);
  const [semesterList, setSemesterList] = useState<Semester[]>([]);
  const [kelasListData, setKelasListData] = useState<Kelas[]>([]);
  const [selectedCabangId, setSelectedCabangId] = useState<string>('');
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');

  const componentRef = useRef<HTMLDivElement>(null);

  // Catatan: JANGAN memanggil enableNetwork(db) di sini.
  // Dengan persistentMultipleTabManager, memanggil enableNetwork() saat Firestore
  // sudah online membuat SDK mendaftarkan ulang target query yang sama sehingga
  // muncul error: [code=already-exists] Target ID already exists: <n>.
  // Error itu membuat listener/getDocs gagal dan data siswa tidak termuat.
  // Koneksi Firestore sudah otomatis aktif saat aplikasi diinisialisasi.

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
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
            setGuruNama(userData.nama || "");

            if (userData.role === "Kepala Sekolah" || userData.role === "Guru") {
              const userCabangName = userData.cabang;
              const foundCabang = cabangList.find(c => c.nama === userCabangName);
              
              if (foundCabang) {
                setSelectedCabangId(foundCabang.id);
                
                if (userData.role === "Guru") {
                   const guruName = userData.nama;
                   // Ambil SEMUA kelas yang diampu guru ini di cabangnya
                   const guruKelasList = kelasListData.filter(k => k.guruKelas && k.guruKelas.includes(guruName) && k.cabang === userCabangName);
                   // Jika hanya 1 kelas, langsung pilih kelas tersebut.
                   // Jika lebih dari 1, biarkan kosong agar guru memilih sendiri.
                   if (guruKelasList.length === 1) {
                     setSelectedKelas(guruKelasList[0].namaKelas);
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

  // Daftar kelas yang diampu guru yang sedang login (kosong jika bukan Guru)
  const guruKelasOptions = useMemo(() => {
    if (userRole !== "Guru" || !guruNama) return [];
    return kelasListData.filter(k => k.guruKelas && k.guruKelas.includes(guruNama));
  }, [userRole, guruNama, kelasListData]);

  // Guru hanya boleh memilih kelasnya sendiri; jika hanya punya 1 kelas, dropdown dikunci
  const isKelasLocked = userRole === "Guru" && guruKelasOptions.length <= 1;

  // Filter Kelas based on Selected Cabang (dan dibatasi ke kelas milik guru)
  const filteredKelasOptions = useMemo(() => {
    if (!selectedCabangId) return [];
    const selectedCabang = cabangList.find(c => c.id === selectedCabangId);
    if (!selectedCabang) return [];
    const kelasCabang = kelasListData.filter(k => k.cabang === selectedCabang.nama);
    if (userRole === "Guru") {
      return kelasCabang.filter(k => k.guruKelas && k.guruKelas.includes(guruNama));
    }
    return kelasCabang;
  }, [selectedCabangId, cabangList, kelasListData, userRole, guruNama]);

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
    } else if (userRole === "Guru") {
      // Guru tanpa kelas terpilih: batasi ke siswa di kelas yang diampu saja
      const kelasGuru = guruKelasOptions.map(k => k.namaKelas);
      students = students.filter(s => kelasGuru.includes(s.kelas));
    }
    
    return students;
  }, [siswaList, selectedCabangId, cabangList, selectedKelas, userRole, guruKelasOptions]);

  const selectedSiswa = useMemo(() => {
    if (!selectedSiswaId) return null;
    return siswaList.find(s => s.id === selectedSiswaId) || null;
  }, [selectedSiswaId, siswaList]);

  const handleSiswaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSiswaId(e.target.value);
    setShowPreview(false); 
  };

  // Catatan guru dikosongkan setiap kali siswa berganti agar tidak terbawa ke siswa lain
  useEffect(() => {
    setCatatanGuru('');
  }, [selectedSiswaId]);

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
    setCatatanGuru('');
  };

  const handlePreview = () => {
    if (!selectedSiswaId) {
      alert("Pilih siswa terlebih dahulu.");
      return;
    }
    if (!catatanGuru.trim()) {
      alert("Catatan guru tidak boleh kosong.");
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
          const namaKelas = selectedSiswa?.kelas || "-";
          const namaSemester =
            semesterList.find(s => s.id === selectedSemesterId)?.namaPeriode || "-";
          // Footer: "<halaman> - Nama | Kelas | Semester"
          const footerText = `${siswaName} | ${namaKelas} | ${namaSemester}`;
          
          for (let i = 1; i <= totalPages; i++) {
            pdf.setPage(i);
            pdf.setFontSize(9);
            pdf.setTextColor(150);
            pdf.text(`${i} - ${footerText}`, 10, 292);
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
              disabled={!selectedCabangId || isKelasLocked}
              className={`w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 transition ${!selectedCabangId || isKelasLocked ? "bg-gray-100 cursor-not-allowed" : ""}`}
            >
              <option value="">{userRole === "Guru" ? "-- Pilih Kelas --" : "-- Semua Kelas --"}</option>
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
      
      {/* Editor Catatan Guru */}
      {selectedSiswaId && (
        <div className="mb-8 p-6 bg-white rounded-xl shadow-md">
           <h2 className="text-2xl font-semibold mb-4 text-gray-700">Catatan Guru</h2>
           <textarea
             value={catatanGuru}
             onChange={(e) => setCatatanGuru(e.target.value)}
             rows={6}
             className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition"
             placeholder="Tuliskan catatan guru mengenai perkembangan siswa di sini..."
           />
        </div>
      )}

      {/* Tombol Aksi */}
      <div className="flex gap-4 mb-8">
        <button 
          onClick={handlePreview}
          disabled={!selectedSiswaId || !catatanGuru.trim()}
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
              catatanGuru={catatanGuru} 
              semesterId={selectedSemesterId}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RaporPage;