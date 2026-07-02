"use client";

import { useState, useEffect } from 'react';
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { Loader2, Eye, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';

// --- INTERFACES ---
interface Pelamar {
  id: string;
  nama: string;
  programNama: string;
  status: 'Baru' | 'Ditinjau' | 'Diterima' | 'Ditolak';
  tanggalMelamar: Timestamp;
}

export default function PelamarPage() {
  // --- STATE MANAGEMENT ---
  const [pelamarList, setPelamarList] = useState<Pelamar[]>([]);
  const [loading, setLoading] = useState(true);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "pelamar"), orderBy("tanggalMelamar", "desc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pelamar));
        setPelamarList(list);
      } catch (error) {
        console.error("Error fetching applicants: ", error);
        alert("Gagal memuat data pelamar.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDelete = async (pelamar: Pelamar) => {
    if (!confirm(`Yakin ingin menghapus data pelamar "${pelamar.nama}"? Tindakan ini tidak dapat diurungkan.`)) return;

    try {
      await deleteDoc(doc(db, "pelamar", pelamar.id));
      setPelamarList(prev => prev.filter(p => p.id !== pelamar.id));
      alert("Data pelamar berhasil dihapus.");
      // Note: This does not delete associated files from Storage.
      // A more robust solution would involve a Cloud Function to handle cascading deletes.
    } catch (error) {
      console.error("Error deleting applicant: ", error);
      alert("Gagal menghapus data pelamar.");
    }
  };
  const getStatusBadgeColor = (status: Pelamar['status']) => {
    switch (status) {
      case 'Baru': return 'bg-blue-100 text-blue-800';
      case 'Ditinjau': return 'bg-yellow-100 text-yellow-800';
      case 'Diterima': return 'bg-green-100 text-green-800';
      case 'Ditolak': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Daftar Pelamar</h1>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16 text-center">No.</th>
                <th className="p-4">Nama</th>
                <th className="p-4">Program</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : pelamarList.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Belum ada data pelamar yang masuk.</td></tr>
              ) : (
                pelamarList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                    <td className="p-4">{item.programNama}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(item.status)}`}>{item.status}</span>
                    </td>
                    <td className="p-4 flex justify-center items-center gap-2">
                      <Link href={`/admin/rekrutmen/pelamar/${item.id}`} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Lihat Detail"><Eye className="w-4 h-4" /></Link>
                      <button onClick={() => handleDelete(item)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </td>
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