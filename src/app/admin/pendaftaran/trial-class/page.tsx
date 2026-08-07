"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale'; // Import Indonesian locale
import Link from 'next/link';

interface TrialClassParticipant {
  id: string;
  namaAnak: string;
  namaPanggilan: string;
  lokasi: string; // Pilihan Lokasi
  tanggal: string; // Pilihan Tanggal (YYYY-MM-DD)
  waktu: string; // Pilihan Waktu (HH:mm)
  alamat: string;
  nomorWa: string;
  program: string; // Program yang dipilih
  tanggalPendaftaran: any; // Timestamp of registration submission
}

export default function TrialClassPage() {
  const [participants, setParticipants] = useState<TrialClassParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, "pendaftaran_trial"), orderBy("tanggalPendaftaran", "desc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as TrialClassParticipant));
        setParticipants(list);
      } catch (error) {
        console.error("Error fetching pendaftaran trial data: ", error);
        setError("Gagal memuat data pendaftar trial class. Silakan coba lagi.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);
  
  // Function to format the trial date string (YYYY-MM-DD)
  const formatTrialDate = (dateString: string) => {
    if (!dateString) return "-";
    // Add 'T00:00:00' to ensure it's parsed as a valid date in local timezone
    // This helps avoid timezone issues when parsing YYYY-MM-DD strings directly
    const date = new Date(dateString + 'T00:00:00'); 
    return format(date, 'EEEE, d MMMM yyyy', { locale: id });
  };

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pendaftar Trial Class</h1>
          <p className="text-sm text-gray-500">Daftar semua peserta yang mendaftar untuk kelas percobaan.</p>
        </div>
        {error && <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Nama Anak & Panggilan</th>
                <th className="p-4">Pilihan Lokasi</th>
                <th className="p-4">Pilihan Tanggal</th>
                <th className="p-4">Pilihan Waktu</th>
                <th className="p-4">Alamat</th>
                <th className="p-4">Nomor WA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : participants.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Belum ada pendaftar trial class.</td></tr>
              ) : (
                participants.map((p, index) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">
                      {p.namaAnak} ({p.namaPanggilan})
                    </td>
                    <td className="p-4">{p.lokasi}</td>
                    <td className="p-4">{formatTrialDate(p.tanggal)}</td>
                    <td className="p-4">{p.waktu}</td>
                    <td className="p-4">{p.alamat}</td>
                    <td className="p-4">{p.nomorWa}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}