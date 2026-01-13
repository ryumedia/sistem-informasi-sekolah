"use client";
import { useState, useRef, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
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
  fotoUrl?: string; // fotoUrl can be optional
}

const RaporPage = () => {
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [selectedSiswaId, setSelectedSiswaId] = useState<string | null>(null);
  const [selectedKelas, setSelectedKelas] = useState<string>('Semua');
  const [narasi, setNarasi] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [fetchingSiswa, setFetchingSiswa] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const componentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSiswa = async () => {
      setFetchingSiswa(true);
      setFetchError(null);
      try {
        const querySnapshot = await getDocs(collection(db, "siswa"));
        const siswaData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Siswa[];
        setSiswaList(siswaData);
      } catch (error) {
        console.error("Error fetching siswa: ", error);
        setFetchError("Gagal memuat data siswa. Silakan coba lagi nanti.");
      } finally {
        setFetchingSiswa(false);
      }
    };
    fetchSiswa();
  }, []);

  const kelasList = useMemo(() => {
    const kelasSet = new Set(siswaList.map(s => s.kelas));
    return ['Semua', ...Array.from(kelasSet)];
  }, [siswaList]);

  const filteredSiswa = useMemo(() => {
    if (selectedKelas === 'Semua') {
      return siswaList;
    }
    return siswaList.filter(s => s.kelas === selectedKelas);
  }, [siswaList, selectedKelas]);

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
      try {
      // Dynamic import html2pdf agar tidak error di server side
        const module = await import("html2pdf.js");
        const html2pdf = module.default || module;
        const element = componentRef.current;
        
        const opt: any = {
          margin: 10,
          filename: `Rapor_${selectedSiswa?.nama || 'Siswa'}_${new Date().getTime()}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        await html2pdf().from(element).set(opt).save();
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
          {/* Filter Kelas */}
          <div>
            <label htmlFor="kelas-select" className="block text-lg font-medium text-gray-700 mb-2">
              Filter Kelas
            </label>
            <select
              id="kelas-select"
              value={selectedKelas}
              onChange={handleKelasChange}
              className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-indigo-500 transition"
            >
              {kelasList.map(kelas => (
                <option key={kelas} value={kelas}>{kelas}</option>
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
          <div ref={componentRef} className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
            <TemplateRapor 
              siswa={selectedSiswa} 
              narasi={narasi} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default RaporPage;