"use client";

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { Loader2, ArrowLeft, User, FileText, Link as LinkIcon, Check, X as XIcon, Download } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// --- INTERFACES ---
interface Pelamar {
  id: string;
  nama: string;
  programId: string;
  programNama: string;
  status: 'Baru' | 'Ditinjau' | 'Diterima' | 'Ditolak';
  tanggalMelamar: Timestamp;
  jawaban: Record<string, any>;
}

interface Pertanyaan {
  id: string;
  pertanyaan: string;
  urutan: number;
}

export default function DetailPelamarPage() {
  const params = useParams();
  const router = useRouter();
  const pelamarId = params.id as string;

  // --- STATE MANAGEMENT ---
  const [pelamar, setPelamar] = useState<Pelamar | null>(null);
  const [pertanyaanList, setPertanyaanList] = useState<Pertanyaan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    if (!pelamarId) return;
    setLoading(true);
    try {
      // Fetch applicant details
      const pelamarDoc = await getDoc(doc(db, "pelamar", pelamarId));
      if (!pelamarDoc.exists()) {
        alert("Data pelamar tidak ditemukan.");
        router.push("/admin/rekrutmen/pelamar");
        return;
      }
      const pelamarData = { id: pelamarDoc.id, ...pelamarDoc.data() } as Pelamar;
      setPelamar(pelamarData);

      // Fetch questions for the corresponding program
      const q = query(collection(db, `rekrutmen_program/${pelamarData.programId}/pertanyaan`), orderBy("urutan", "asc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(p => ({ id: p.id, ...p.data() } as Pertanyaan));
      setPertanyaanList(list);

    } catch (error) {
      console.error("Error fetching data: ", error);
      alert("Gagal memuat detail pelamar.");
    } finally {
      setLoading(false);
    }
  }, [pelamarId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (newStatus: Pelamar['status']) => {
    if (!pelamar) return;
    setIsUpdating(true);
    try {
      const pelamarRef = doc(db, "pelamar", pelamar.id);
      await updateDoc(pelamarRef, { status: newStatus });
      setPelamar(prev => prev ? { ...prev, status: newStatus } : null);
      alert(`Status pelamar berhasil diubah menjadi "${newStatus}"`);
    } catch (error) {
      console.error("Error updating status: ", error);
      alert("Gagal mengubah status.");
    } finally {
      setIsUpdating(false);
    }
  };

  const renderJawaban = (pertanyaanId: string) => {
    const jawaban = pelamar?.jawaban[pertanyaanId];
    if (jawaban === undefined || jawaban === null || jawaban === '') {
      return <p className="text-gray-500 italic">Tidak dijawab</p>;
    }
    // Check if the answer is a URL (for file uploads)
    if (typeof jawaban === 'string' && (jawaban.startsWith('http://') || jawaban.startsWith('https://'))) {
      return (
        <a href={jawaban} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-blue-600 hover:underline">
          <Download className="w-4 h-4" />
          Lihat/Unduh File
        </a>
      );
    }
    return <p className="text-gray-800 whitespace-pre-wrap">{String(jawaban)}</p>;
  };

  if (loading) {
    return <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-[#581c87]" /></div>;
  }

  if (!pelamar) {
    return <p className="text-center py-20 text-gray-500">Data pelamar tidak dapat ditemukan.</p>;
  }

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <Link href="/admin/rekrutmen/pelamar" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 mb-2">
        <ArrowLeft className="w-4 h-4" />
        Kembali ke Daftar Pelamar
      </Link>

      {/* Header */}
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{pelamar.nama}</h1>
            <p className="text-gray-600">Melamar untuk program: <span className="font-medium">{pelamar.programNama}</span></p>
            <p className="text-sm text-gray-500 mt-1">Tanggal Melamar: {format(pelamar.tanggalMelamar.toDate(), 'd MMMM yyyy, HH:mm', { locale: id })}</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={pelamar.status}
              onChange={(e) => handleStatusChange(e.target.value as Pelamar['status'])}
              disabled={isUpdating}
              className="border rounded-lg p-2 text-sm focus:ring-2 focus:ring-[#581c87] outline-none bg-white disabled:opacity-70"
            >
              <option value="Baru">Baru</option>
              <option value="Ditinjau">Ditinjau</option>
              <option value="Diterima">Diterima</option>
              <option value="Ditolak">Ditolak</option>
            </select>
            {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
          </div>
        </div>
      </div>

      {/* Detail Jawaban */}
      <div className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-3 flex items-center gap-2"><FileText className="w-5 h-5" /> Detail Jawaban Formulir</h2>
        <div className="space-y-6 mt-4">
          {pertanyaanList.map((p, index) => (
            <div key={p.id}>
              <p className="text-sm font-semibold text-gray-600 mb-1">{index + 1}. {p.pertanyaan}</p>
              <div className="pl-4 border-l-2 border-gray-200">
                {renderJawaban(p.id)}
              </div>
            </div>
          ))}
          {pertanyaanList.length === 0 && (
            <p className="text-gray-500">Tidak ada pertanyaan yang ditemukan untuk program ini.</p>
          )}
        </div>
      </div>
    </div>
  );
}