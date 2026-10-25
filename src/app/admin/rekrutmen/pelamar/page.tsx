"use client";

import { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Eye, Trash2, Filter, Download, Search, X } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import Link from 'next/link';
import * as XLSX from 'xlsx';

// --- INTERFACES ---
interface Pelamar {
  id: string;
  nama: string;
  programNama: string;
  pilihanCabang: string;
  status: 'Baru' | 'Ditinjau' | 'Diterima' | 'Ditolak';
  tanggalMelamar: Timestamp;
  jawaban?: {
    [key: string]: any;
  }
}

export default function PelamarPage() {
  // --- STATE MANAGEMENT ---
  const [pelamarList, setPelamarList] = useState<Pelamar[]>([]);
  const [loading, setLoading] = useState(true);
  const [programList, setProgramList] = useState<any[]>([]);
  const [cabangList, setCabangList] = useState<any[]>([]);
  const [filterProgram, setFilterProgram] = useState('');
  const [filterCabang, setFilterCabang] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "pelamar"), orderBy("tanggalMelamar", "desc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => {
          const data = doc.data();
          const jawaban = data.jawaban || {};
          return {
            ...data,
            id: doc.id,
            pilihanCabang: jawaban['zqHSfMv8cHCRo3zksoVn'] || '', // Mengambil data cabang dari field jawaban
          } as Pelamar;
        });
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

  // Fetch data for filters
  useEffect(() => {
    const fetchFiltersData = async () => {
      try {
        // Fetch Programs
        const programQuery = query(collection(db, "program_rekrutmen"), orderBy("nama", "asc"));
        const programSnapshot = await getDocs(programQuery);
        const programs = programSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProgramList(programs);

        // Fetch Cabang
        const cabangQuery = query(collection(db, "cabang"), orderBy("nama", "asc"));
        const cabangSnapshot = await getDocs(cabangQuery);
        const cabangs = cabangSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCabangList(cabangs);
      } catch (error) {
        console.error("Error fetching filter data: ", error);
      }
    };
    fetchFiltersData();
  }, []);

  const filteredPelamar = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return pelamarList.filter(p =>
      (filterProgram ? p.programNama === filterProgram : true) &&
      (filterCabang ? p.pilihanCabang === filterCabang : true) &&
      (filterStatus ? p.status === filterStatus : true) &&
      (keyword ? (p.nama || '').toLowerCase().includes(keyword) : true)
    );
  }, [pelamarList, filterProgram, filterCabang, filterStatus, searchTerm]);

  // Hanya ID yang masih tampil di tabel yang dianggap terpilih
  const visibleSelectedIds = useMemo(
    () => selectedIds.filter(id => filteredPelamar.some(p => p.id === id)),
    [selectedIds, filteredPelamar]
  );
  const isAllSelected = filteredPelamar.length > 0 && visibleSelectedIds.length === filteredPelamar.length;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(prev => prev.filter(id => !filteredPelamar.some(p => p.id === id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredPelamar.map(p => p.id)])));
    }
  };

  const handleBulkDelete = async () => {
    if (visibleSelectedIds.length === 0) return;
    if (!confirm(`Yakin ingin menghapus ${visibleSelectedIds.length} data pelamar terpilih? Tindakan ini tidak dapat diurungkan.`)) return;

    setDeleting(true);
    const idsToDelete = [...visibleSelectedIds];
    const results = await Promise.allSettled(
      idsToDelete.map(async (id) => {
        await deleteDoc(doc(db, "pelamar", id));
        return id;
      })
    );
    const successIds = results
      .map((r, i) => (r.status === 'fulfilled' ? idsToDelete[i] : null))
      .filter((id): id is string => id !== null);
    const failedCount = results.length - successIds.length;

    setPelamarList(prev => prev.filter(p => !successIds.includes(p.id)));
    setSelectedIds(prev => prev.filter(id => !successIds.includes(id)));
    setDeleting(false);

    if (failedCount > 0) {
      console.error("Sebagian data gagal dihapus:", results.filter(r => r.status === 'rejected'));
      alert(`${successIds.length} data berhasil dihapus, ${failedCount} data gagal dihapus.`);
    } else {
      alert(`${successIds.length} data pelamar berhasil dihapus.`);
    }
  };

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

  const handleExport = () => {
    if (filteredPelamar.length === 0) {
      alert("Tidak ada data untuk diekspor.");
      return;
    }

    // 1. Siapkan data sesuai format yang diinginkan
    const dataToExport = filteredPelamar.map(p => {
      const jawaban = p.jawaban || {};
      return {
        "Nama Program": p.programNama,
        "Nama": p.nama,
        "Jenis Kelamin": jawaban['XvrXfaJsNB6fU1Vz7Gzd'] || '-',
        "Alamat": jawaban['73gojtM9tQiTyu5AtMMf'] || '-',
        "Nomor WA": jawaban['PNxUs3CTdcAXqBokOd44'] || '-',
        "Pilihan Cabang": p.pilihanCabang || '-',
        "Foto": jawaban['BM91Ad5mqf46bOLTwKts'] || '-',
        "Dokumen": jawaban['LtIJ8fNSARelYwPMo3mI'] || '-',
      };
    });

    // 2. Buat worksheet dan workbook
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pelamar");

    // 3. Memicu unduhan
    XLSX.writeFile(workbook, `Daftar_Pelamar_${new Date().toISOString().split('T')[0]}.xlsx`);
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">Daftar Pelamar</h1>
        {/* Filter Area */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama pelamar..."
              className="border rounded-lg py-2 pl-9 pr-8 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900 w-56"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" title="Hapus pencarian">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={filterProgram}
            onChange={(e) => setFilterProgram(e.target.value)}
            className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900"
          >
            <option value="">Semua Program</option>
            {programList.map((p) => <option key={p.id} value={p.nama}>{p.nama}</option>)}
          </select>
          <select
            value={filterCabang}
            onChange={(e) => setFilterCabang(e.target.value)}
            className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900"
          >
            <option value="">Semua Cabang</option>
            {cabangList.map((c) => <option key={c.id} value={c.nama}>{c.nama}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded-lg p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-[#581c87] text-gray-900"
          >
            <option value="">Semua Status</option>
            <option value="Baru">Baru</option>
            <option value="Ditinjau">Ditinjau</option>
            <option value="Diterima">Diterima</option>
            <option value="Ditolak">Ditolak</option>
          </select>
          <button onClick={handleExport} className="bg-green-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition text-sm">
            <Download className="w-4 h-4" />
            <span>Excel</span>
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={visibleSelectedIds.length === 0 || deleting}
            className="bg-red-600 text-white px-3 py-2 rounded-lg flex items-center gap-2 hover:bg-red-700 transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>Hapus Terpilih{visibleSelectedIds.length > 0 ? ` (${visibleSelectedIds.length})` : ''}</span>
          </button>
        </div>
      </div>

      {/* Info Jumlah Pelamar */}
      <div className="bg-purple-50 border border-purple-200 text-purple-800 rounded-lg p-3 text-sm">
        Menampilkan <span className="font-bold">{filteredPelamar.length}</span> dari total <span className="font-bold">{pelamarList.length}</span> pelamar.
        {(filterProgram || filterCabang || filterStatus || searchTerm) && (
          <button onClick={() => { setFilterProgram(''); setFilterCabang(''); setFilterStatus(''); setSearchTerm(''); }} className="ml-3 text-purple-600 hover:text-purple-800 font-medium">Reset Filter</button>
        )}
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">
                  <input
                    type="checkbox"
                    aria-label="Pilih semua pelamar"
                    checked={isAllSelected}
                    onChange={toggleSelectAll}
                    disabled={filteredPelamar.length === 0}
                    className="w-4 h-4 accent-[#581c87] cursor-pointer align-middle"
                  />
                </th>
                <th className="p-4 w-16 text-center">No.</th>
                <th className="p-4">Nama</th>
                <th className="p-4">Alamat</th>
                <th className="p-4">Program</th>
                <th className="p-4">Pilihan Cabang</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 w-32 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : filteredPelamar.length === 0 ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Tidak ada data pelamar yang cocok dengan filter.</td></tr>
              ) : (
                filteredPelamar.map((item, index) => (
                  <tr key={item.id} className={`hover:bg-gray-50 ${visibleSelectedIds.includes(item.id) ? 'bg-purple-50/50' : ''}`}>
                    <td className="p-4 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Pilih ${item.nama}`}
                        checked={visibleSelectedIds.includes(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="w-4 h-4 accent-[#581c87] cursor-pointer align-middle"
                      />
                    </td>
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">
                      <div>{item.nama}</div>
                      <div className="text-xs font-normal text-gray-500 mt-0.5">{item.jawaban?.['XvrXfaJsNB6fU1Vz7Gzd'] || '-'}</div>
                    </td>
                    <td className="p-4">{item.jawaban?.['73gojtM9tQiTyu5AtMMf'] || '-'}</td>
                    <td className="p-4">{item.programNama}</td>
                    <td className="p-4">{item.pilihanCabang || '-'}</td>
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