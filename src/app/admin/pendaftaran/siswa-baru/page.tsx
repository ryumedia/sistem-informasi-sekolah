"use client";

import { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, deleteDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { Loader2, Eye, Edit, Trash2, X } from 'lucide-react';
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
  statusPendaftaran: 'Baru' | 'Ditinjau' | 'Diterima' | 'Ditolak';
  createdAt: Timestamp;
}

type SiswaBaruSummary = Pick<SiswaBaruDetail, 'id' | 'namaAnak' | 'namaPanggilan' | 'lokasi' | 'program' | 'statusPendaftaran' | 'createdAt'>;

type ModalMode = 'view' | 'edit';

export default function SiswaBaruPage() {
  const [registrations, setRegistrations] = useState<SiswaBaruDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRegistration, setSelectedRegistration] = useState<SiswaBaruDetail | null>(null);
  const [modalMode, setModalMode] = useState<ModalMode>('view');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      case 'Baru': return 'bg-blue-100 text-blue-800 dark:text-blue-800';
      case 'Ditinjau': return 'bg-yellow-100 text-yellow-800 dark:text-yellow-800';
      case 'Diterima': return 'bg-green-100 text-green-800 dark:text-green-800';
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-800">Pendaftaran Siswa Baru</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500">Daftar semua calon siswa baru yang telah mendaftar.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600 dark:text-gray-600">
            <thead className="bg-gray-50 text-gray-900 dark:text-gray-900 font-semibold border-b">
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
                <tr><td colSpan={7} className="p-8 text-center text-gray-500 dark:text-gray-500">Belum ada pendaftar siswa baru.</td></tr>
              ) : (
                registrations.map((p, index) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900 dark:text-gray-900">{p.namaAnak}</td>
                    <td className="p-4">{p.namaPanggilan}</td>
                    <td className="p-4">{p.lokasi}</td>
                    <td className="p-4">{p.program}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(p.statusPendaftaran)}`}>{p.statusPendaftaran}</span>
                    </td>
                    <td className="p-4 flex justify-center gap-2">
                      <button onClick={() => openModal(p, 'view')} className="p-2 text-gray-600 dark:text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Lihat Detail"><Eye className="w-4 h-4" /></button>
                      <button onClick={() => openModal(p, 'edit')} className="p-2 text-blue-600 dark:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit Status"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(p.id, p.namaAnak)} className="p-2 text-red-600 dark:text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                <div><span className="text-gray-500 dark:text-gray-500">No. WA Ayah:</span><span className="font-medium ml-2">{selectedRegistration.noWaAyah}</span></div>
                <div><span className="text-gray-500 dark:text-gray-500">No. WA Ibu:</span><span className="font-medium ml-2">{selectedRegistration.noWaIbu}</span></div>
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
                      <option value="Ditinjau">Ditinjau</option>
                      <option value="Diterima">Diterima</option>
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