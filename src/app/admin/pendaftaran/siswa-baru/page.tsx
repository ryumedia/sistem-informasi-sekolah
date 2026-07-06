"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { Loader2, Eye, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';

interface SiswaBaru {
  id: string;
  namaAnak: string;
  namaPanggilan: string;
  lokasi: string;
  program: string;
  statusPendaftaran: 'Baru' | 'Ditinjau' | 'Diterima' | 'Ditolak';
  createdAt: Timestamp;
}

export default function SiswaBaruPage() {
  const [registrations, setRegistrations] = useState<SiswaBaru[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, "siswa_baru_registrations"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as SiswaBaru));
        setRegistrations(list);
      } catch (error) {
        console.error("Error fetching new student registrations: ", error);
        alert("Gagal memuat data pendaftar siswa baru.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDelete = async (id: string, nama: string) => {
    if (!confirm(`Yakin ingin menghapus pendaftaran untuk "${nama}"?`)) return;
    try {
      await deleteDoc(doc(db, "siswa_baru_registrations", id));
      setRegistrations(prev => prev.filter(r => r.id !== id));
      alert("Pendaftaran berhasil dihapus.");
    } catch (error) {
      console.error("Error deleting registration:", error);
      alert("Gagal menghapus pendaftaran.");
    }
  };

  const getStatusBadgeColor = (status: SiswaBaru['statusPendaftaran']) => {
    switch (status) {
      case 'Baru': return 'bg-blue-100 text-blue-800';
      case 'Ditinjau': return 'bg-yellow-100 text-yellow-800';
      case 'Diterima': return 'bg-green-100 text-green-800';
      case 'Ditolak': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Pendaftaran Siswa Baru</h1>
        <p className="text-sm text-gray-500">Daftar semua calon siswa baru yang telah mendaftar.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Nama Anak</th>
                <th className="p-4">Nama Panggilan</th>
                <th className="p-4">Lokasi</th>
                <th className="p-4">Program</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : registrations.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Belum ada pendaftar siswa baru.</td></tr>
              ) : (
                registrations.map((p, index) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{p.namaAnak}</td>
                    <td className="p-4">{p.namaPanggilan}</td>
                    <td className="p-4">{p.lokasi}</td>
                    <td className="p-4">{p.program}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(p.statusPendaftaran)}`}>{p.statusPendaftaran}</span>
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                      <Link href={`/admin/pendaftaran/siswa-baru/${p.id}`} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Lihat Detail"><Eye className="w-4 h-4" /></Link>
                      <Link href={`/admin/pendaftaran/siswa-baru/edit/${p.id}`} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Edit className="w-4 h-4" /></Link>
                      <button onClick={() => handleDelete(p.id, p.namaAnak)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
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