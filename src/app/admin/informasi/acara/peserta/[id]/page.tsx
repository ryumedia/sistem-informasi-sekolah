"use client";

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, orderBy, getDocs, Timestamp, deleteDoc } from 'firebase/firestore';
import { Loader2, ArrowLeft, Filter, Trash2 } from 'lucide-react';
import { format } from 'date-fns';

interface Acara {
  nama: string;
  tanggal: Timestamp;
  tempat: string;
}

interface Peserta {
  id: string;
  nama: string;
  email: string;
  role: string;
  kelas: string;
  cabang: string;
  checkInTime: Timestamp;
}

export default function PesertaAcaraPage() {
  const params = useParams();
  const router = useRouter();
  const acaraId = params.id as string;

  const [acara, setAcara] = useState<Acara | null>(null);
  const [pesertaList, setPesertaList] = useState<Peserta[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCabang, setFilterCabang] = useState('');
  const [uniqueCabangList, setUniqueCabangList] = useState<string[]>([]);

  useEffect(() => {
    if (!acaraId) return;

    const fetchData = async () => {
      try {
        // 1. Fetch Detail Acara
        const acaraRef = doc(db, 'acara', acaraId);
        const acaraSnap = await getDoc(acaraRef);
        if (acaraSnap.exists()) {
          setAcara(acaraSnap.data() as Acara);
        } else {
          throw new Error("Acara tidak ditemukan");
        }

        // 2. Fetch Daftar Peserta (dari sub-collection)
        const pesertaQuery = query(collection(db, 'acara', acaraId, 'peserta'), orderBy('checkInTime', 'desc'));
        const pesertaSnap = await getDocs(pesertaQuery);
        const list = pesertaSnap.docs.map(d => ({ id: d.id, ...d.data() } as Peserta));
        setPesertaList(list);

        // 3. Ekstrak daftar cabang unik dari peserta untuk filter
        const cabangs = [...new Set(list.map(p => p.cabang).filter(Boolean))]; // filter(Boolean) untuk menghilangkan nilai null/undefined
        setUniqueCabangList(cabangs.sort());

      } catch (error) {
        console.error("Error fetching data:", error);
        alert("Gagal memuat data. " + (error as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [acaraId]);

  // Gunakan useMemo untuk memfilter data tanpa re-render yang tidak perlu
  const filteredPeserta = useMemo(() => {
    if (!filterCabang) {
      return pesertaList;
    }
    return pesertaList.filter(p => p.cabang === filterCabang);
  }, [pesertaList, filterCabang]);

  const formatDate = (timestamp: Timestamp, formatStr: string) => {
    if (!timestamp) return "-";
    return format(timestamp.toDate(), formatStr);
  };

  const handleDelete = async (peserta: Peserta) => {
    if (!confirm(`Yakin ingin menghapus peserta "${peserta.nama}" dari acara ini?`)) return;

    try {
      const pesertaRef = doc(db, 'acara', acaraId, 'peserta', peserta.id);
      await deleteDoc(pesertaRef);
      setPesertaList(prev => prev.filter(p => p.id !== peserta.id));
      alert("Peserta berhasil dihapus.");
    } catch (error) {
      console.error("Error deleting participant:", error);
      alert("Gagal menghapus peserta.");
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-[#581c87]" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 hover:bg-gray-100 rounded-full">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Daftar Peserta: {acara?.nama}</h1>
          <p className="text-sm text-gray-500">
            {acara?.tanggal ? formatDate(acara.tanggal, 'd MMMM yyyy') : ''} di {acara?.tempat}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-50 p-4 rounded-xl border">
        <p className="text-sm text-gray-700">
          Menampilkan <span className="font-bold">{filteredPeserta.length}</span> dari total <span className="font-bold">{pesertaList.length}</span> peserta.
        </p>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterCabang}
            onChange={(e) => setFilterCabang(e.target.value)}
            className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900"
          >
            <option value="">Semua Cabang</option>
            {uniqueCabangList.map(cabang => (
              <option key={cabang} value={cabang}>{cabang}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Nama Peserta</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Kelas</th>
                <th className="p-4">Role</th>
                <th className="p-4">Waktu Check-in</th>
                <th className="p-4 w-20 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPeserta.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">{pesertaList.length > 0 ? 'Tidak ada peserta yang cocok dengan filter.' : 'Belum ada peserta yang melakukan check-in.'}</td></tr>
              ) : (
                filteredPeserta.map((p, index) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{p.nama}</td>
                    <td className="p-4">{p.cabang || '-'}</td>
                    <td className="p-4">{p.kelas || '-'}</td>
                    <td className="p-4">{p.role}</td>
                    <td className="p-4">{formatDate(p.checkInTime, 'HH:mm:ss')}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => handleDelete(p)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus Peserta">
                        <Trash2 className="w-4 h-4" />
                      </button>
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