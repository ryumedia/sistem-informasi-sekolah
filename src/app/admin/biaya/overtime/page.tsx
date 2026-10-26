"use client";

import { useState, useEffect } from 'react';
import { Timer, Search, Pencil, Trash2, X, RotateCcw } from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// --- INTERFACES ---
interface OvertimeEntry {
  id: string;
  tanggal: string; // contoh: "2025-01-15"
  nama: string;
  cabang: string;
  kelas: string;
  jenis: string; // contoh: "Kedatangan" | "Kepulangan"
  waktu: string; // jam, contoh: "11:25"
  nominal: number; // dalam rupiah

  siswaId?: string;
  nisn?: string;
  dicatatOleh?: string;
  userId?: string;
}

interface CabangItem {
  id: string;
  nama: string;
}

interface KelasItem {
  id: string;
  namaKelas: string;
  cabang?: string;
}

interface SiswaItem {
  id: string;
  nama: string;
  nisn?: string;
  cabang?: string;
  kelas?: string;
}

const JENIS_OVERTIME = ['Kedatangan', 'Kepulangan'];

// Role yang cabangnya terkunci
const LOCKED_CABANG_ROLES = ['Kepala Sekolah', 'Guru', 'Asisten Guru', 'Caregiver'];
// Role yang hanya boleh melihat seluruh cabang
const FULL_ACCESS_ROLES = ['Admin', 'Direktur', 'Yayasan'];

const toDateString = (rawTanggal: unknown): string => {
  if (!rawTanggal) return '';
  if (typeof rawTanggal === 'string') return rawTanggal.slice(0, 10);
  const withToDate = rawTanggal as { toDate?: () => Date };
  if (typeof withToDate.toDate === 'function') {
    return withToDate.toDate().toISOString().slice(0, 10);
  }
  return '';
};

const formatTanggal = (tanggal: string) => {
  if (!tanggal) return '-';
  const date = new Date(tanggal);
  if (isNaN(date.getTime())) return tanggal;
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};

// --- MODAL EDIT ---
function EditOvertimeModal({
  entry,
  lockedCabang,
  onClose,
}: {
  entry: OvertimeEntry;
  lockedCabang: string;
  onClose: () => void;
}) {
  const [cabangList, setCabangList] = useState<CabangItem[]>([]);
  const [kelasList, setKelasList] = useState<KelasItem[]>([]);
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [loadingSiswa, setLoadingSiswa] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    tanggal: entry.tanggal || new Date().toISOString().split('T')[0],
    cabang: lockedCabang || entry.cabang || '',
    kelas: entry.kelas || '',
    siswaId: entry.siswaId || '',
    nama: entry.nama || '',
    jenis: entry.jenis || '',
    waktu: entry.waktu || '',
    nominal: entry.nominal || 0,
  });

  // Cabang
  useEffect(() => {
    const fetchCabang = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'cabang'), orderBy('nama', 'asc')));
        setCabangList(snap.docs.map(d => ({ id: d.id, ...d.data() } as CabangItem)));
      } catch (error) {
        console.error('Error fetching cabang:', error);
      }
    };
    fetchCabang();
  }, []);

  // Kelas sesuai cabang
  useEffect(() => {
    const fetchKelas = async () => {
      setKelasList([]);
      if (!formData.cabang) return;
      try {
        const snap = await getDocs(query(collection(db, 'kelas'), where('cabang', '==', formData.cabang)));
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as KelasItem));
        items.sort((a, b) => (a.namaKelas || '').localeCompare(b.namaKelas || ''));
        setKelasList(items);
      } catch (error) {
        console.error('Error fetching kelas:', error);
      }
    };
    fetchKelas();
  }, [formData.cabang]);

  // Siswa sesuai cabang + kelas
  useEffect(() => {
    const fetchSiswa = async () => {
      setSiswaList([]);
      if (!formData.cabang || !formData.kelas) return;
      setLoadingSiswa(true);
      try {
        const snap = await getDocs(
          query(
            collection(db, 'siswa'),
            where('cabang', '==', formData.cabang),
            where('kelas', '==', formData.kelas)
          )
        );
        const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as SiswaItem));
        items.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
        setSiswaList(items);
      } catch (error) {
        console.error('Error fetching siswa:', error);
      } finally {
        setLoadingSiswa(false);
      }
    };
    fetchSiswa();
  }, [formData.cabang, formData.kelas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const siswa = siswaList.find(s => s.id === formData.siswaId);

      await updateDoc(doc(db, 'overtime', entry.id), {
        tanggal: formData.tanggal,
        cabang: formData.cabang,
        kelas: formData.kelas,
        nama: siswa?.nama || formData.nama || '',
        siswaId: formData.siswaId || entry.siswaId || '',
        nisn: siswa?.nisn || entry.nisn || '',
        jenis: formData.jenis,
        waktu: formData.waktu,
        nominal: Number(formData.nominal) || 0,
        updatedAt: Timestamp.now(),
      });

      alert('Data overtime berhasil diperbarui!');
      onClose();
    } catch (error) {
      console.error('Error update overtime:', error);
      alert('Gagal memperbarui data overtime.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50 sticky top-0 z-10">
          <h3 className="font-bold text-gray-800">Edit Overtime</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal</label>
            <input
              required
              type="date"
              className="w-full border rounded-lg p-2 text-sm text-gray-900"
              value={formData.tanggal}
              onChange={e => setFormData({ ...formData, tanggal: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cabang</label>
            <select
              required
              disabled={!!lockedCabang}
              className={`w-full border rounded-lg p-2 text-sm ${
                lockedCabang ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-900'
              }`}
              value={formData.cabang}
              onChange={e =>
                setFormData({ ...formData, cabang: e.target.value, kelas: '', siswaId: '', nama: '' })
              }
            >
              <option value="">Pilih Cabang</option>
              {cabangList.map(c => (
                <option key={c.id} value={c.nama}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Kelas</label>
            <select
              required
              disabled={!formData.cabang}
              className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900 disabled:bg-gray-100"
              value={formData.kelas}
              onChange={e => setFormData({ ...formData, kelas: e.target.value, siswaId: '', nama: '' })}
            >
              <option value="">Pilih Kelas</option>
              {kelasList.map(k => (
                <option key={k.id} value={k.namaKelas}>
                  {k.namaKelas}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Siswa</label>
            <select
              disabled={!formData.kelas || loadingSiswa}
              className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900 disabled:bg-gray-100"
              value={formData.siswaId}
              onChange={e => {
                const siswa = siswaList.find(s => s.id === e.target.value);
                setFormData({ ...formData, siswaId: e.target.value, nama: siswa?.nama || formData.nama });
              }}
            >
              <option value="">
                {loadingSiswa
                  ? 'Memuat siswa...'
                  : formData.kelas
                  ? siswaList.length === 0
                    ? formData.nama
                      ? `${formData.nama} (data siswa tidak ditemukan)`
                      : 'Tidak ada siswa di kelas ini'
                    : formData.nama && !formData.siswaId
                    ? `${formData.nama} (pilih untuk mengganti)`
                    : 'Pilih Siswa'
                  : 'Pilih kelas terlebih dahulu'}
              </option>
              {siswaList.map(s => (
                <option key={s.id} value={s.id}>
                  {s.nama}
                  {s.nisn ? ` (${s.nisn})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Jenis</label>
              <select
                required
                className="w-full border rounded-lg p-2 text-sm bg-white text-gray-900"
                value={formData.jenis}
                onChange={e => setFormData({ ...formData, jenis: e.target.value })}
              >
                <option value="">Pilih Jenis</option>
                {JENIS_OVERTIME.map(j => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Waktu</label>
              <input
                required
                type="time"
                className="w-full border rounded-lg p-2 text-sm text-gray-900"
                value={formData.waktu}
                onChange={e => setFormData({ ...formData, waktu: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Nominal (Rp)</label>
            <input
              required
              type="text"
              inputMode="numeric"
              className="w-full border rounded-lg p-2 text-sm text-gray-900"
              placeholder="0"
              value={formData.nominal === 0 ? '' : formData.nominal.toLocaleString('id-ID')}
              onChange={e => {
                const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '');
                setFormData({ ...formData, nominal: raw === '' ? 0 : Number(raw) });
              }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Batal
            </button>
            <button
              disabled={submitting}
              type="submit"
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function OvertimePage() {
  const [overtimeList, setOvertimeList] = useState<OvertimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [cabangList, setCabangList] = useState<CabangItem[]>([]);
  const [filterCabang, setFilterCabang] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [userRole, setUserRole] = useState('');
  const [lockedCabang, setLockedCabang] = useState('');

  const [editEntry, setEditEntry] = useState<OvertimeEntry | null>(null);

  // --- Identifikasi role user untuk lock cabang ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async currentUser => {
      if (!currentUser) {
        setUserRole('Admin');
        return;
      }
      try {
        const snap = await getDocs(query(collection(db, 'guru'), where('email', '==', currentUser.email)));
        if (!snap.empty) {
          const data = snap.docs[0].data();
          const role = data.role || '';
          setUserRole(role);
          if (LOCKED_CABANG_ROLES.includes(role) && data.cabang) {
            setLockedCabang(data.cabang);
            setFilterCabang(data.cabang);
          }
        } else {
          setUserRole('Admin');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- Master cabang ---
  useEffect(() => {
    const fetchCabang = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'cabang'), orderBy('nama', 'asc')));
        setCabangList(snap.docs.map(d => ({ id: d.id, ...d.data() } as CabangItem)));
      } catch (error) {
        console.error('Error fetching cabang:', error);
      }
    };
    fetchCabang();
  }, []);

  // --- Data overtime realtime ---
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'overtime')),
      snapshot => {
        const items: OvertimeEntry[] = snapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            tanggal: toDateString(data.tanggal),
            nama: data.nama || '',
            cabang: data.cabang || '',
            kelas: data.kelas || '',
            jenis: data.jenis || '',
            waktu: data.waktu || '',
            nominal: Number(data.nominal) || 0,
            siswaId: data.siswaId || '',
            nisn: data.nisn || '',
            dicatatOleh: data.dicatatOleh || '',
            userId: data.userId || '',
          };
        });
        items.sort((a, b) => `${b.tanggal} ${b.waktu}`.localeCompare(`${a.tanggal} ${a.waktu}`));
        setOvertimeList(items);
        setLoading(false);
      },
      error => {
        console.error('Error fetching overtime:', error);
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // --- Filter: nama, tanggal, cabang ---
  const filteredList = overtimeList.filter(item => {
    const matchNama = item.nama.toLowerCase().includes(search.trim().toLowerCase());
    const matchCabang = filterCabang ? item.cabang === filterCabang : true;
    const matchStart = startDate ? item.tanggal >= startDate : true;
    const matchEnd = endDate ? item.tanggal <= endDate : true;
    return matchNama && matchCabang && matchStart && matchEnd;
  });

  const totalNominal = filteredList.reduce((sum, item) => sum + (item.nominal || 0), 0);

  const isCabangLocked = LOCKED_CABANG_ROLES.includes(userRole) && !!lockedCabang;
  const hasCabangAccess = FULL_ACCESS_ROLES.includes(userRole) || isCabangLocked || !userRole;

  const isFilterActive = !!search || !!filterCabang || !!startDate || !!endDate;

  const resetFilter = () => {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setFilterCabang(lockedCabang || '');
  };

  const handleDelete = async (entry: OvertimeEntry) => {
    if (!confirm(`Hapus data overtime "${entry.nama}" pada ${formatTanggal(entry.tanggal)}?`)) return;
    try {
      await deleteDoc(doc(db, 'overtime', entry.id));
    } catch (error) {
      console.error('Error deleting overtime:', error);
      alert('Gagal menghapus data overtime.');
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Timer className="w-6 h-6" /> Biaya Overtime
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Daftar biaya overtime per siswa, cabang, dan kelas.
          </p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama siswa..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tanggal Akhir</label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={e => setEndDate(e.target.value)}
              className="w-full border rounded-lg p-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cabang</label>
            <select
              disabled={isCabangLocked}
              value={filterCabang}
              onChange={e => setFilterCabang(e.target.value)}
              className={`w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${
                isCabangLocked ? 'bg-gray-100 text-gray-600' : 'bg-white text-gray-900'
              }`}
            >
              <option value="">Semua Cabang</option>
              {cabangList.map(c => (
                <option key={c.id} value={c.nama}>
                  {c.nama}
                </option>
              ))}
            </select>
            {isCabangLocked && (
              <p className="text-[10px] text-gray-400 mt-1">Terkunci sesuai cabang Anda</p>
            )}
          </div>
          <div className="flex items-end">
            <button
              onClick={resetFilter}
              disabled={!isFilterActive}
              className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" /> Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-12 text-center">No.</th>
                <th className="p-4">Tanggal</th>
                <th className="p-4">Nama</th>
                <th className="p-4">Cabang</th>
                <th className="p-4">Kelas</th>
                <th className="p-4">Jenis</th>
                <th className="p-4">Waktu</th>
                <th className="p-4">Nominal</th>
                <th className="p-4 text-center w-24">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    Memuat data overtime...
                  </td>
                </tr>
              ) : !hasCabangAccess ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    Anda tidak memiliki akses ke data overtime.
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-gray-500">
                    {overtimeList.length === 0
                      ? 'Belum ada data biaya overtime.'
                      : 'Tidak ada data yang sesuai filter.'}
                  </td>
                </tr>
              ) : (
                filteredList.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{index + 1}</td>
                    <td className="p-4 whitespace-nowrap">{formatTanggal(item.tanggal)}</td>
                    <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                    <td className="p-4">{item.cabang}</td>
                    <td className="p-4">{item.kelas}</td>
                    <td className="p-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          item.jenis === 'Kedatangan'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-orange-50 text-orange-700'
                        }`}
                      >
                        {item.jenis || '-'}
                      </span>
                    </td>
                    <td className="p-4">{item.waktu}</td>
                    <td className="p-4 font-semibold text-blue-700">
                      Rp {item.nominal.toLocaleString('id-ID')}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditEntry(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredList.length > 0 && !loading && (
              <tfoot className="bg-gray-50 border-t font-semibold text-gray-900">
                <tr>
                  <td className="p-4 text-right" colSpan={7}>
                    Total ({filteredList.length} entri)
                  </td>
                  <td className="p-4 text-blue-700">Rp {totalNominal.toLocaleString('id-ID')}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {editEntry && (
        <EditOvertimeModal
          entry={editEntry}
          lockedCabang={isCabangLocked ? lockedCabang : ''}
          onClose={() => setEditEntry(null)}
        />
      )}
    </div>
  );
}
