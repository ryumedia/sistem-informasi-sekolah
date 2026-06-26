"use client";

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { db, storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Timestamp,
  doc,
  addDoc,
} from "firebase/firestore";
import { Loader2, ArrowLeft, Send, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// --- INTERFACES ---
interface ProgramRekrutmen {
  id: string;
  nama: string;
  coverUrl: string;
  tanggalMulai: Timestamp;
  tanggalSelesai: Timestamp;
}

interface Pertanyaan {
  id: string;
  pertanyaan: string;
  urutan: number;
  tipeJawaban: 'Jawaban Terbuka' | 'Pilihan Ganda' | 'Upload File';
  pilihan?: string[];
}

export default function HalamanRekrutmenPublik() {
  // --- STATE MANAGEMENT ---
  const [programList, setProgramList] = useState<ProgramRekrutmen[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState<ProgramRekrutmen | null>(null);
  const [pertanyaanList, setPertanyaanList] = useState<Pertanyaan[]>([]);
  const [formLoading, setFormLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formAnswers, setFormAnswers] = useState<Record<string, any>>({});

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchProgram = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, "rekrutmen_program"),
          where("tanggalSelesai", ">=", Timestamp.now()),
          orderBy("tanggalSelesai", "asc")
        );
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProgramRekrutmen));
        setProgramList(list);
      } catch (error) {
        console.error("Error fetching active programs: ", error);
        alert("Gagal memuat program rekrutmen yang tersedia.");
      } finally {
        setLoading(false);
      }
    };

    fetchProgram();
  }, []);

  const handleSelectProgram = useCallback(async (program: ProgramRekrutmen) => {
    setSelectedProgram(program);
    setFormLoading(true);
    try {
      const q = query(collection(db, `rekrutmen_program/${program.id}/pertanyaan`), orderBy("urutan", "asc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pertanyaan));
      setPertanyaanList(list);
    } catch (error) {
      console.error("Error fetching questions: ", error);
      alert("Gagal memuat pertanyaan untuk program ini.");
    } finally {
      setFormLoading(false);
    }
  }, []);

  const handleBackToList = () => {
    setSelectedProgram(null);
    setPertanyaanList([]);
    setFormAnswers({});
  };

  const handleAnswerChange = (pertanyaanId: string, value: any) => {
    setFormAnswers(prev => ({ ...prev, [pertanyaanId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProgram) return;
    setIsSubmitting(true);

    try {
      const jawabanFinal: Record<string, any> = {};
      let namaPelamar = "Pelamar"; // Default name

      // Upload files and prepare answers
      for (const p of pertanyaanList) {
        const answer = formAnswers[p.id];
        if (p.tipeJawaban === 'Upload File' && answer instanceof File) {
          const storageRef = ref(storage, `rekrutmen_jawaban/${selectedProgram.id}/${Date.now()}_${answer.name}`);
          await uploadBytes(storageRef, answer);
          jawabanFinal[p.id] = await getDownloadURL(storageRef);
        } else {
          jawabanFinal[p.id] = answer;
        }

        // Find applicant's name, assuming the question contains "nama"
        if (p.pertanyaan.toLowerCase().includes('nama')) {
          namaPelamar = answer;
        }
      }

      // Save to 'pelamar' collection
      await addDoc(collection(db, "pelamar"), {
        programId: selectedProgram.id,
        programNama: selectedProgram.nama,
        nama: namaPelamar,
        jawaban: jawabanFinal,
        status: "Baru",
        tanggalMelamar: Timestamp.now(),
      });

      alert("Terima kasih! Lamaran Anda telah berhasil dikirim.");
      handleBackToList();
    } catch (error) {
      console.error("Error submitting application: ", error);
      alert("Terjadi kesalahan saat mengirim lamaran. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- RENDER LOGIC ---
  const renderProgramList = () => (
    <>
      <div className="text-center">
        <Image src="/logo.png" alt="Logo Main Riang" width={80} height={80} className="mx-auto mb-4" />
        <h1 className="text-4xl font-bold text-gray-800">Program Rekrutmen Main Riang</h1>
        <p className="mt-2 text-lg text-gray-600">Temukan kesempatan untuk bergabung bersama kami.</p>
      </div>
      {loading ? (
        <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#581c87]" /></div>
      ) : programList.length === 0 ? (
        <p className="text-center py-16 text-gray-500">Saat ini belum ada program rekrutmen yang dibuka.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mt-12">
          {programList.map((program) => (
            <div key={program.id} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100 transform hover:-translate-y-1 transition-transform duration-300">
              <div className="relative h-48 w-full cursor-pointer" onClick={() => handleSelectProgram(program)}>
                <Image src={program.coverUrl} alt={program.nama} layout="fill" className="object-cover" />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <span className="text-white font-semibold">Lihat Detail & Daftar</span>
                </div>
              </div>
              <div className="p-4">
                <h2 className="text-lg font-bold text-gray-900">{program.nama}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Berlaku hingga: {format(program.tanggalSelesai.toDate(), 'd MMMM yyyy', { locale: id })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const renderPertanyaanInput = (p: Pertanyaan) => {
    switch (p.tipeJawaban) {
      case 'Jawaban Terbuka':
        return (
          <textarea
            rows={4}
            onChange={(e) => handleAnswerChange(p.id, e.target.value)}
            className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none"
            required
          />
        );
      case 'Pilihan Ganda':
        return (
          <div className="space-y-2 mt-2">
            {p.pilihan?.map((opsi, i) => (
              <label key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="radio"
                  name={p.id}
                  value={opsi}
                  onChange={(e) => handleAnswerChange(p.id, e.target.value)}
                  className="h-4 w-4 text-[#581c87] focus:ring-[#45156b]"
                  required
                />
                <span className="text-sm text-gray-700">{opsi}</span>
              </label>
            ))}
          </div>
        );
      case 'Upload File':
        const file = formAnswers[p.id] as File | undefined;
        return (
          <div>
            <label className="w-full flex items-center px-4 py-2 bg-white text-blue-500 rounded-lg shadow-sm tracking-wide border border-blue-200 cursor-pointer hover:bg-blue-500 hover:text-white">
              <Paperclip className="w-5 h-5" />
              <span className="ml-2 text-sm leading-normal">{file ? file.name : 'Pilih sebuah file...'}</span>
              <input
                type='file'
                className="hidden"
                onChange={(e) => handleAnswerChange(p.id, e.target.files ? e.target.files[0] : null)}
                required
              />
            </label>
            {file && (
              <p className="text-xs text-gray-500 mt-1">
                Tipe: {file.type}, Ukuran: {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const renderForm = () => {
    if (!selectedProgram) return null;
    return (
      <div>
        <button onClick={handleBackToList} className="flex items-center gap-2 text-sm text-gray-500 hover:text-[#581c87] mb-4 font-medium">
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Daftar Program
        </button>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Formulir Pendaftaran</h1>
          <p className="mt-1 text-lg text-gray-600">{selectedProgram.nama}</p>
        </div>

        {formLoading ? (
          <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#581c87]" /></div>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto bg-white p-8 rounded-xl shadow-md border border-gray-100 space-y-6">
            {pertanyaanList.map((p, index) => (
              <div key={p.id}>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  {index + 1}. {p.pertanyaan}
                </label>
                {renderPertanyaanInput(p)}
              </div>
            ))}
            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={isSubmitting} className="bg-[#581c87] text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition disabled:opacity-50">
                {isSubmitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</> : <><Send className="w-4 h-4" /> Kirim Lamaran</>}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  return (
    <main className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-4 py-12">
        {selectedProgram ? renderForm() : renderProgramList()}
      </div>
    </main>
  );
}
