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

function WhatsAppIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

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

  const getWhatsAppUrl = (nomorWa: string, namaPelamar?: string) => {
    if (!nomorWa) return "";
    let cleanNumber = nomorWa.replace(/\D/g, "");
    if (cleanNumber.startsWith("0")) {
      cleanNumber = "62" + cleanNumber.slice(1);
    } else if (!cleanNumber.startsWith("62")) {
      cleanNumber = "62" + cleanNumber;
    }

    const text = encodeURIComponent(
      `Halo${namaPelamar ? ` ${namaPelamar}` : ""}, kami dari tim rekrutmen ingin mengonfirmasi terkait lamaran Anda.`
    );

    return `https://wa.me/${cleanNumber}?text=${text}`;
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
                    <td className="p-4 flex justify-center items-center gap-1.5">
                      {item.jawaban?.['PNxUs3CTdcAXqBokOd44'] ? (
                        <a
                          href={getWhatsAppUrl(item.jawaban['PNxUs3CTdcAXqBokOd44'], item.nama)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title={`Hubungi via WhatsApp (${item.jawaban['PNxUs3CTdcAXqBokOd44']})`}
                        >
                          <WhatsAppIcon className="w-4 h-4 fill-current" />
                        </a>
                      ) : (
                        <span className="p-2 text-gray-300 cursor-not-allowed" title="Nomor WA pelamar tidak tersedia">
                          <WhatsAppIcon className="w-4 h-4 fill-current opacity-30" />
                        </span>
                      )}
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