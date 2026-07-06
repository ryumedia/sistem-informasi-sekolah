"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';

interface TrialClassParticipant {
  id: string;
  namaAnak: string;
  namaPanggilan: string;
  alamat: string;
  nomorWa: string;
  tanggalTrial: Timestamp;
  pilihanKelas: string;
  pilihanSesi: string;
}

export default function TrialClassPage() {
  const [participants, setParticipants] = useState<TrialClassParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, "trial_class_registrations"), orderBy("tanggalTrial", "desc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as TrialClassParticipant));
        setParticipants(list);
      } catch (error) {
        console.error("Error fetching trial class data: ", error);
        alert("Gagal memuat data trial class.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp) return "-";
    return format(timestamp.toDate(), 'd MMMM yyyy');
  };

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pendaftar Trial Class</h1>
          <p className="text-sm text-gray-500">Daftar semua peserta yang mendaftar untuk kelas percobaan.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Nama Anak</th>
                <th className="p-4">Nama Panggilan</th>
                <th className="p-4">Alamat</th>
                <th className="p-4">Nomor WA</th>
                <th className="p-4">Tanggal Trial</th>
                <th className="p-4">Pilihan Kelas</th>
                <th className="p-4">Pilihan Sesi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : participants.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Belum ada pendaftar trial class.</td></tr>
              ) : (
                participants.map((p, index) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{p.namaAnak}</td>
                    <td className="p-4">{p.namaPanggilan}</td>
                    <td className="p-4">{p.alamat}</td>
                    <td className="p-4">{p.nomorWa}</td>
                    <td className="p-4">{formatDate(p.tanggalTrial)}</td>
                    <td className="p-4">{p.pilihanKelas}</td>
                    <td className="p-4">{p.pilihanSesi}</td>
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