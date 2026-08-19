"use client";

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Loader2, Eye, Edit, Trash2, X, Filter, RotateCcw, UserPlus } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface SiswaBaruDetail {
  id: string;
  lokasi: string;
  program: string;
  namaAnak: string;
  namaPanggilan: string;
  jenisKelamin: string;
  kelompokUsia: string;
  agama: string;
  tempatLahir: string;
  tanggalLahir: string;
  namaAyah: string;
  namaIbu: string;
  anakKe: number;
  email: string;
  noWaAyah: string;
  noWaIbu: string;
  kebutuhanKhusus: 'Ya' | 'Tidak';
  infoDari: string;
  statusPendaftaran: 'Baru' | 'Sudah Bayar' | 'Sudah Lunas' | 'Sudah Assesment' | 'Sudah Konsultasi' | 'Ditolak';
  createdAt: Timestamp;
}

type ModalMode = 'view' | 'edit';

function WhatsAppIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
    </svg>
  );
}

export default function SiswaBaruPage() {
  const [registrations, setRegistrations] = useState<SiswaBaruDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<SiswaBaruDetail | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>('view');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Filters
  const [filterTanggal, setFilterTanggal] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [filterCabang, setFilterCabang] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [cabangList, setCabangList] = useState<string[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const q = query(collection(db, "siswa_baru_registrations"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as SiswaBaruDetail));
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

  useEffect(() => {
    const fetchCabang = async () => {
      try {
        const q = query(collection(db, "lokasi_pendaftaran"), orderBy("nama", "asc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => doc.data().nama as string);
        setCabangList(list);
      } catch (error) {
        console.error("Error fetching lokasi pendaftaran list: ", error);
      }
    };
    fetchCabang();
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

  const getStatusBadgeColor = (status: SiswaBaruDetail['statusPendaftaran']) => {
    switch (status) {
      case 'Baru': return 'bg-blue-100 text-blue-800';
      case 'Sudah Bayar': return 'bg-purple-100 text-purple-800';
      case 'Sudah Lunas': return 'bg-emerald-100 text-emerald-800';
      case 'Sudah Assesment': return 'bg-yellow-100 text-yellow-800';
      case 'Sudah Konsultasi': return 'bg-green-100 text-green-800';
      case 'Ditolak': return 'bg-red-100 text-red-800 dark:text-red-800';
      default: return 'bg-gray-100 text-gray-800 dark:text-gray-800';
    }
  };

  const openModal = (pendaftar: SiswaBaruDetail, mode: ModalMode) => {
    setSelectedRegistration(pendaftar);
    setModalMode(mode);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedRegistration(null);
  };

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!selectedRegistration) return;
    const newStatus = e.target.value as SiswaBaruDetail['statusPendaftaran'];

    setIsSubmitting(true);
    try {
      const docRef = doc(db, "siswa_baru_registrations", selectedRegistration.id);
      await updateDoc(docRef, { statusPendaftaran: newStatus });

      // Update state locally
      setSelectedRegistration(prev => prev ? { ...prev, statusPendaftaran: newStatus } : null);
      setRegistrations(prevList => prevList.map(r =>
        r.id === selectedRegistration.id ? { ...r, statusPendaftaran: newStatus } : r
      ));

      alert("Status pendaftaran berhasil diperbarui.");
      closeModal();
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Gagal memperbarui status.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJadikanSiswa = (pendaftar: SiswaBaruDetail) => {
    if (!confirm(`Anda akan menjadikan "${pendaftar.namaAnak}" sebagai siswa dan diarahkan ke halaman siswa. Lanjutkan?`)) {
      return;
    }

    // Data yang akan dikirim ke halaman tambah siswa
    const dataForSiswa = {
      nama: pendaftar.namaAnak,
      namaPanggilan: pendaftar.namaPanggilan,
      jenisKelamin: pendaftar.jenisKelamin,
      tempatLahir: pendaftar.tempatLahir,
      tanggalLahir: pendaftar.tanggalLahir,
      agama: pendaftar.agama,
      anakKe: pendaftar.anakKe,
      namaAyah: pendaftar.namaAyah,
      namaIbu: pendaftar.namaIbu,
      email: pendaftar.email,
      noWA: pendaftar.noWaAyah || pendaftar.noWaIbu,
      cabang: pendaftar.lokasi,
    };

    // Simpan data di localStorage untuk diambil oleh halaman selanjutnya
    localStorage.setItem('newStudentFromRegistration', JSON.stringify(dataForSiswa));

    router.push('/admin/siswa');
  };

  const filteredAndPaginatedRegistrations = useMemo(() => {
    const filtered = registrations.filter(p => {
      const tglDaftar = p.createdAt.toDate();
      const startDate = filterTanggal.start ? new Date(filterTanggal.start) : null;
      const endDate = filterTanggal.end ? new Date(filterTanggal.end) : null;

      if (startDate) {
        startDate.setHours(0, 0, 0, 0);
        if (tglDaftar < startDate) return false;
      }
      if (endDate) {
        endDate.setHours(23, 59, 59, 999);
        if (tglDaftar > endDate) return false;
      }
      if (filterCabang && p.lokasi !== filterCabang) return false;
      if (filterStatus && p.statusPendaftaran !== filterStatus) return false;

      return true;
    });

    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    return {
      paginatedItems: filtered.slice(startIndex, endIndex),
      totalItems: filtered.length,
      totalPages: Math.ceil(filtered.length / itemsPerPage)
    };
  }, [registrations, filterTanggal, filterCabang, filterStatus, currentPage]);

  const resetFilters = () => {
    setFilterTanggal({ start: '', end: '' });
    setFilterCabang('');
    setFilterStatus('');
    setCurrentPage(1);
  };

  const getWhatsAppUrl = (nomorWa: string, namaAnak?: string) => {
    if (!nomorWa) return "";
    let cleanNumber = nomorWa.replace(/\D/g, "");
    if (cleanNumber.startsWith("0")) {
      cleanNumber = "62" + cleanNumber.slice(1);
    } else if (!cleanNumber.startsWith("62")) {
      cleanNumber = "62" + cleanNumber;
    }

    const text = encodeURIComponent(
      `Halo Ibu${namaAnak ? ` dari ananda ${namaAnak}` : ""}, kami dari tim pendaftaran ingin mengonfirmasi terkait pendaftaran siswa baru.`
    );

    return `https://wa.me/${cleanNumber}?text=${text}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-800">Pendaftaran Siswa Baru</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500">Daftar semua calon siswa baru yang telah mendaftar.</p>
      </div>

      {/* Filter Section */}
      <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center gap-2 text-gray-700 dark:text-gray-700 font-medium"><Filter className="w-5 h-5" /><span>Filter Data</span></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <div><label className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Dari Tanggal</label><input type="date" value={filterTanggal.start} onChange={e => setFilterTanggal(p => ({ ...p, start: e.target.value }))} className="w-full p-2 border rounded-md text-gray-900 dark:text-gray-900 bg-white" /></div>
          <div><label className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Sampai Tanggal</label><input type="date" value={filterTanggal.end} onChange={e => setFilterTanggal(p => ({ ...p, end: e.target.value }))} className="w-full p-2 border rounded-md text-gray-900 dark:text-gray-900 bg-white" /></div>
          <div><label className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Lokasi Pendaftaran</label><select value={filterCabang} onChange={e => setFilterCabang(e.target.value)} className="w-full p-2 border rounded-md text-gray-900 dark:text-gray-900 bg-white"><option value="">Semua Lokasi</option>{cabangList.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="block text-xs text-gray-500 dark:text-gray-500 mb-1">Status</label><select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full p-2 border rounded-md text-gray-900 dark:text-gray-900 bg-white"><option value="">Semua Status</option><option value="Baru">Baru</option><option value="Sudah Bayar">Sudah Bayar</option><option value="Sudah Lunas">Sudah Lunas</option><option value="Sudah Assesment">Sudah Assesment</option><option value="Sudah Konsultasi">Sudah Konsultasi</option><option value="Ditolak">Ditolak</option></select></div>
        </div>
        <div className="flex justify-end">
          <button onClick={resetFilters} className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-600 hover:text-gray-800 dark:hover:text-gray-800"><RotateCcw className="w-3 h-3" /> Reset Filter</button>
        </div>
      </div>

      <div className="bg-purple-50 border border-purple-200 text-purple-800 text-sm font-medium p-3 rounded-lg flex items-center justify-between">
        <span>Total Pendaftar ditemukan: <span className="font-bold">{filteredAndPaginatedRegistrations.totalItems}</span></span>
        <span className="text-xs">Menampilkan halaman {currentPage} dari {filteredAndPaginatedRegistrations.totalPages || 1}</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-600">
            <thead className="bg-gray-50 text-gray-900 dark:text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Tanggal Daftar</th>
                <th className="p-4">Nama Siswa</th>
                <th className="p-4">Lokasi</th>
                <th className="p-4">Program</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 w-40 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : filteredAndPaginatedRegistrations.paginatedItems.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500 dark:text-gray-500">Belum ada pendaftar siswa baru.</td></tr>
              ) : (
                filteredAndPaginatedRegistrations.paginatedItems.map((p, index) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{(currentPage - 1) * itemsPerPage + index + 1}</td>
                    <td className="p-4 text-xs text-gray-600">{format(p.createdAt.toDate(), 'dd MMM yyyy', { locale: localeId })}</td>
                    <td className="p-4">
                      <div className="font-medium text-gray-900 dark:text-gray-900">{p.namaAnak}</div>
                      <div className="text-xs text-gray-500">"{p.namaPanggilan}"</div>
                    </td>
                    <td className="p-4">{p.lokasi}</td>
                    <td className="p-4">{p.program}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(p.statusPendaftaran)}`}>{p.statusPendaftaran}</span>
                    </td>
                    <td className="p-4 flex justify-center items-center gap-1.5">
                      {p.noWaIbu ? (
                        <a
                          href={getWhatsAppUrl(p.noWaIbu, p.namaAnak)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title={`Hubungi Ibu via WhatsApp (${p.noWaIbu})`}
                        >
                          <WhatsAppIcon className="w-4 h-4 fill-current" />
                        </a>
                      ) : (
                        <span className="p-2 text-gray-300 cursor-not-allowed" title="Nomor WA Ibu tidak tersedia">
                          <WhatsAppIcon className="w-4 h-4 fill-current opacity-30" />
                        </span>
                      )}
                      <button onClick={() => openModal(p, 'view')} className="p-2 text-gray-600 dark:text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Lihat Detail"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openModal(p, 'edit')} className="p-2 text-blue-600 dark:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit Status"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleJadikanSiswa(p)} className="p-2 text-green-600 dark:text-green-600 hover:bg-green-50 rounded-lg transition" title="Jadikan Siswa Diterima"><UserPlus className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(p.id, p.namaAnak)} className="p-2 text-red-600 dark:text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination Controls */}
        {filteredAndPaginatedRegistrations.totalPages > 1 && (
          <div className="p-4 border-t flex flex-col sm:flex-row justify-between items-center text-sm text-gray-600 dark:text-gray-600">
            <div className="mb-2 sm:mb-0">
              Menampilkan {filteredAndPaginatedRegistrations.paginatedItems.length} dari {filteredAndPaginatedRegistrations.totalItems} data
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Sebelumnya</button>
              <span>
                Halaman <span className="font-semibold">{currentPage}</span> dari <span className="font-semibold">{filteredAndPaginatedRegistrations.totalPages}</span>
              </span>
              <button onClick={() => setCurrentPage(p => Math.min(filteredAndPaginatedRegistrations.totalPages, p + 1))} disabled={currentPage === filteredAndPaginatedRegistrations.totalPages} className="px-3 py-1 border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed">Berikutnya</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Detail & Edit */}
      {isModalOpen && selectedRegistration && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center sticky top-0 bg-white rounded-t-xl">
              <h3 className="font-bold text-gray-800 dark:text-gray-800">{modalMode === 'view' ? 'Detail Pendaftaran' : 'Edit Status Pendaftaran'}</h3>
              <button onClick={closeModal} className="text-gray-400 dark:text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Informasi Pendaftaran */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-900 dark:text-gray-900">
                <div className="col-span-2 font-semibold text-purple-800 dark:text-purple-800 border-b pb-2 mb-2">Informasi Pendaftaran</div>
                <div><span className="text-gray-500 dark:text-gray-500">Lokasi:</span><span className="font-medium ml-2">{selectedRegistration.lokasi}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">Program:</span><span className="font-medium ml-2">{selectedRegistration.program}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">Tanggal Daftar:</span><span className="font-medium ml-2">{format(selectedRegistration.createdAt.toDate(), 'dd MMMM yyyy, HH:mm', { locale: localeId })}</span></div>
                <div>
                  <span className="text-gray-500 dark:text-gray-500">Status:</span>
                  <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(selectedRegistration.statusPendaftaran)}`}>
                    {selectedRegistration.statusPendaftaran}
                  </span>
                </div>
              </div>

              {/* Data Siswa */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-900 dark:text-gray-900">
                <div className="col-span-2 font-semibold text-purple-800 dark:text-purple-800 border-b pb-2 mb-2">Data Siswa</div>
                <div><span className="text-gray-500 dark:text-gray-500">Nama Lengkap:</span><span className="font-medium ml-2">{selectedRegistration.namaAnak}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">Nama Panggilan:</span><span className="font-medium ml-2">{selectedRegistration.namaPanggilan}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">Jenis Kelamin:</span><span className="font-medium ml-2">{selectedRegistration.jenisKelamin}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">Jenjang Usia:</span><span className="font-medium ml-2">{selectedRegistration.kelompokUsia}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">Tempat, Tgl Lahir:</span><span className="font-medium ml-2">{selectedRegistration.tempatLahir}, {format(new Date(selectedRegistration.tanggalLahir), 'dd MMMM yyyy', { locale: localeId })}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">Agama:</span><span className="font-medium ml-2">{selectedRegistration.agama}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">Anak Ke:</span><span className="font-medium ml-2">{selectedRegistration.anakKe}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">Kebutuhan Khusus:</span><span className="font-medium ml-2">{selectedRegistration.kebutuhanKhusus}</span></div>
              </div>

              {/* Data Orang Tua */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-900 dark:text-gray-900">
                <div className="col-span-2 font-semibold text-purple-800 dark:text-purple-800 border-b pb-2 mb-2">Data Orang Tua</div>
                <div><span className="text-gray-500 dark:text-gray-500">Nama Ayah:</span><span className="font-medium ml-2">{selectedRegistration.namaAyah}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">Nama Ibu:</span><span className="font-medium ml-2">{selectedRegistration.namaIbu}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">Email:</span><span className="font-medium ml-2">{selectedRegistration.email}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">No. WA Ayah:</span><span className="font-medium ml-2">{selectedRegistration.noWaAyah || "-"}</span></div>
                <div className="flex items-center">
                  <span className="text-gray-500 dark:text-gray-500">No. WA Ibu:</span>
                  <span className="font-medium ml-2">{selectedRegistration.noWaIbu || "-"}</span>
                  {selectedRegistration.noWaIbu && (
                    <a
                      href={getWhatsAppUrl(selectedRegistration.noWaIbu, selectedRegistration.namaAnak)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center ml-2 p-1 text-emerald-600 hover:bg-emerald-50 rounded transition"
                      title="Hubungi Ibu via WhatsApp"
                    >
                      <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                    </a>
                  )}
                </div>
              </div>

              {/* Info Lain */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-900 dark:text-gray-900">
                <div className="col-span-2 font-semibold text-purple-800 dark:text-purple-800 border-b pb-2 mb-2">Lain-lain</div>
                <div><span className="text-gray-500 dark:text-gray-500">Info dari:</span><span className="font-medium ml-2">{selectedRegistration.infoDari}</span></div>
              </div>

            </div>
            {modalMode === 'edit' && (
              <div className="p-4 bg-gray-50 border-t rounded-b-xl">
                <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4">
                  <label htmlFor="statusPendaftaran" className="block text-sm font-medium text-gray-700 dark:text-gray-700">Ubah Status Pendaftaran:</label>
                  <div className="md:col-span-2">
                    <select
                      id="statusPendaftaran"
                      value={selectedRegistration.statusPendaftaran}
                      onChange={handleStatusChange}
                      disabled={isSubmitting}
                      className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none text-sm bg-white disabled:bg-gray-100 text-gray-900 dark:text-gray-900"
                    >
                      <option value="Baru">Baru</option>
                      <option value="Sudah Bayar">Sudah Bayar</option>
                      <option value="Sudah Lunas">Sudah Lunas</option>
                      <option value="Sudah Assesment">Sudah Assesment</option>
                      <option value="Sudah Konsultasi">Sudah Konsultasi</option>
                      <option value="Ditolak">Ditolak</option>
                    </select>
                  </div>
                </div>
                {isSubmitting && (
                  <div className="flex items-center justify-center mt-2 text-sm text-gray-500 dark:text-gray-500">
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    <span>Menyimpan...</span>
                  </div>
                )}
              </div>
            )}
            {modalMode === 'view' && (
              <div className="p-4 bg-gray-50 border-t rounded-b-xl flex justify-end">
                <button
                  onClick={() => setModalMode('edit')}
                  className="bg-[#581c87] text-white py-2 px-4 rounded-lg hover:bg-[#45156b] transition font-medium flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  Ubah Status
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}