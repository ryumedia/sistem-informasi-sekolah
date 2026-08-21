"use client";

import { useState, useEffect, FormEvent } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Loader2, PlusCircle, Edit, Trash2, X, MapPin, BookOpen, CalendarClock, Users } from 'lucide-react';

// --- INTERFACES ---
interface Lokasi {
  id: string;
  nama: string;
  alamat: string;
}

interface Program {
  id: string;
  nama: string;
}

interface JadwalTrial {
  id: string;
  lokasi: string;
  tanggal: string; // YYYY-MM-DD
  waktu: string; // HH:mm
}

interface KuotaTematik {
  id: string;
  lokasi: string;
  bulan: string;
  kuota: number;
}

// --- MAIN COMPONENT ---
export default function LokasiProgramPage() {
  // State for Lokasi
  const [lokasiList, setLokasiList] = useState<Lokasi[]>([]);
  const [loadingLokasi, setLoadingLokasi] = useState(true);
  const [isLokasiModalOpen, setIsLokasiModalOpen] = useState(false);
  const [editingLokasi, setEditingLokasi] = useState<Lokasi | null>(null);

  // State for Program
  const [programList, setProgramList] = useState<Program[]>([]);
  const [loadingProgram, setLoadingProgram] = useState(true);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);

  // State for Jadwal Trial
  const [jadwalList, setJadwalList] = useState<JadwalTrial[]>([]);
  const [loadingJadwal, setLoadingJadwal] = useState(true);
  const [isJadwalModalOpen, setIsJadwalModalOpen] = useState(false);
  const [editingJadwal, setEditingJadwal] = useState<JadwalTrial | null>(null);

  // State for Kuota Tematik
  const [kuotaTematikList, setKuotaTematikList] = useState<KuotaTematik[]>([]);
  const [loadingKuotaTematik, setLoadingKuotaTematik] = useState(true);
  const [isKuotaTematikModalOpen, setIsKuotaTematikModalOpen] = useState(false);
  const [editingKuotaTematik, setEditingKuotaTematik] = useState<KuotaTematik | null>(null);

  // Fetch Data
  useEffect(() => {
    const fetchData = async <T,>(
      collectionName: string,
      setter: (list: T[]) => void,
      loaderSetter: (loading: boolean) => void,
      orderByField = "nama"
    ) => {
      try {
        const q = query(collection(db, collectionName), orderBy(orderByField, "asc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as T));
        setter(list);
      } catch (error) {
        console.error(`Error fetching ${collectionName}:`, error);
        alert(`Gagal memuat data ${collectionName}.`);
      } finally {
        loaderSetter(false);
      }
    };

    fetchData("lokasi_pendaftaran", setLokasiList, setLoadingLokasi);
    fetchData("program_pendaftaran", setProgramList, setLoadingProgram);
    fetchData("jadwal_trial", setJadwalList, setLoadingJadwal, "tanggal");
    fetchData("kuota_tematik", setKuotaTematikList, setLoadingKuotaTematik, "lokasi");
  }, []);

  // --- LOKASI HANDLERS ---
  const handleSaveLokasi = async (formData: { nama: string; alamat: string }) => {
    try {
      if (editingLokasi) {
        await updateDoc(doc(db, "lokasi_pendaftaran", editingLokasi.id), formData);
      } else {
        await addDoc(collection(db, "lokasi_pendaftaran"), formData);
      }
      // Refresh data
      const snapshot = await getDocs(query(collection(db, "lokasi_pendaftaran"), orderBy("nama", "asc")));
      setLokasiList(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Lokasi)));
    } catch (error) {
      console.error("Error saving lokasi:", error);
      alert("Gagal menyimpan data lokasi.");
    }
  };

  const handleDeleteLokasi = async (id: string) => {
    if (!confirm("Yakin ingin menghapus lokasi ini?")) return;
    try {
      await deleteDoc(doc(db, "lokasi_pendaftaran", id));
      setLokasiList(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Error deleting lokasi:", error);
      alert("Gagal menghapus lokasi.");
    }
  };

  // --- PROGRAM HANDLERS ---
  const handleSaveProgram = async (formData: { nama: string }) => {
    try {
      if (editingProgram) {
        await updateDoc(doc(db, "program_pendaftaran", editingProgram.id), formData);
      } else {
        await addDoc(collection(db, "program_pendaftaran"), formData);
      }
      // Refresh data
      const snapshot = await getDocs(query(collection(db, "program_pendaftaran"), orderBy("nama", "asc")));
      setProgramList(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Program)));
    } catch (error) {
      console.error("Error saving program:", error);
      alert("Gagal menyimpan data program.");
    }
  };

  const handleDeleteProgram = async (id: string) => {
    if (!confirm("Yakin ingin menghapus program ini?")) return;
    try {
      await deleteDoc(doc(db, "program_pendaftaran", id));
      setProgramList(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Error deleting program:", error);
      alert("Gagal menghapus program.");
    }
  };

  // --- JADWAL HANDLERS ---
  const handleSaveJadwal = async (formData: { lokasi: string; tanggal: string; waktu: string }) => {
    try {
      if (editingJadwal) {
        await updateDoc(doc(db, "jadwal_trial", editingJadwal.id), formData);
      } else {
        await addDoc(collection(db, "jadwal_trial"), formData);
      }
      // Refresh data
      const snapshot = await getDocs(query(collection(db, "jadwal_trial"), orderBy("tanggal", "asc")));
      setJadwalList(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as JadwalTrial)));
    } catch (error) {
      console.error("Error saving jadwal:", error);
      alert("Gagal menyimpan data jadwal.");
    }
  };

  const handleDeleteJadwal = async (id: string) => {
    if (!confirm("Yakin ingin menghapus jadwal ini?")) return;
    try {
      await deleteDoc(doc(db, "jadwal_trial", id));
      setJadwalList(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Error deleting jadwal:", error);
      alert("Gagal menghapus jadwal.");
    }
  };

  // --- KUOTA TEMATIK HANDLERS ---
  const handleSaveKuotaTematik = async (formData: { lokasi: string; bulan: string; kuota: number }) => {
    try {
      if (editingKuotaTematik) {
        await updateDoc(doc(db, "kuota_tematik", editingKuotaTematik.id), formData);
      } else {
        await addDoc(collection(db, "kuota_tematik"), formData);
      }
      // Refresh data
      const snapshot = await getDocs(query(collection(db, "kuota_tematik"), orderBy("lokasi", "asc")));
      setKuotaTematikList(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as KuotaTematik)));
    } catch (error) {
      console.error("Error saving kuota tematik:", error);
      alert("Gagal menyimpan data kuota tematik.");
    }
  };

  const handleDeleteKuotaTematik = async (id: string) => {
    if (!confirm("Yakin ingin menghapus kuota tematik ini?")) return;
    try {
      await deleteDoc(doc(db, "kuota_tematik", id));
      setKuotaTematikList(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error("Error deleting kuota tematik:", error);
      alert("Gagal menghapus kuota tematik.");
    }
  };


  return (
    <div className="space-y-8">
      {/* HEADER & QUICK NAV */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pengaturan Lokasi, Program & Kuota</h1>
          <p className="text-sm text-gray-500">Kelola lokasi pendaftaran, jadwal trial, kuota kelas tematik, dan program pendaftaran.</p>
        </div>
        <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-200">
          <a href="#lokasi" className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition flex items-center gap-1.5">
            <MapPin className="w-4 h-4" /> Lokasi
          </a>
          <a href="#jadwal-trial" className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-100 transition flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4" /> Jadwal Trial
          </a>
          <a href="#kuota-tematik" className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition flex items-center gap-1.5">
            <Users className="w-4 h-4" /> Kuota Kelas Tematik
          </a>
          <a href="#program" className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100 transition flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" /> Program
          </a>
        </div>
      </div>

      {/* SECTION 1: LOKASI */}
      <section id="lokasi">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><MapPin className="w-5 h-5" /> Kelola Lokasi</h2>
          <button onClick={() => { setEditingLokasi(null); setIsLokasiModalOpen(true); }} className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition text-sm">
            <PlusCircle className="w-4 h-4" /> Tambah Lokasi
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
                <tr>
                  <th className="p-4 w-12 text-center">No.</th>
                  <th className="p-4">Lokasi</th>
                  <th className="p-4">Alamat</th>
                  <th className="p-4 w-32 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingLokasi ? (
                  <tr><td colSpan={4} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : lokasiList.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-gray-500">Belum ada lokasi.</td></tr>
                ) : (
                  lokasiList.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-4 text-center">{index + 1}</td>
                      <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                      <td className="p-4">{item.alamat}</td>
                      <td className="p-4 flex justify-center gap-2">
                        <button onClick={() => { setEditingLokasi(item); setIsLokasiModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteLokasi(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 2: JADWAL TRIAL */}
      <section id="jadwal-trial">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><CalendarClock className="w-5 h-5" /> Kelola Jadwal Trial</h2>
          <button onClick={() => { setEditingJadwal(null); setIsJadwalModalOpen(true); }} className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition text-sm">
            <PlusCircle className="w-4 h-4" /> Tambah Jadwal
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
                <tr>
                  <th className="p-4 w-12 text-center">No.</th>
                  <th className="p-4">Lokasi</th>
                  <th className="p-4">Tanggal</th>
                  <th className="p-4">Waktu</th>
                  <th className="p-4 w-32 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingJadwal ? (
                  <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : jadwalList.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">Belum ada jadwal trial.</td></tr>
                ) : (
                  jadwalList.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-4 text-center">{index + 1}</td>
                      <td className="p-4 font-medium text-gray-900">{item.lokasi}</td>
                      <td className="p-4">{new Date(item.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                      <td className="p-4">{item.waktu}</td>
                      <td className="p-4 flex justify-center gap-2">
                        <button onClick={() => { setEditingJadwal(item); setIsJadwalModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteJadwal(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 3: KUOTA KELAS TEMATIK */}
      <section id="kuota-tematik" className="scroll-mt-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Users className="w-5 h-5" /> Kelola Kuota Kelas Tematik</h2>
          <button onClick={() => { setEditingKuotaTematik(null); setIsKuotaTematikModalOpen(true); }} className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-sm">
            <PlusCircle className="w-4 h-4" /> Tambah Kuota
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
                <tr>
                  <th className="p-4 w-12 text-center">No.</th>
                  <th className="p-4">Lokasi</th>
                  <th className="p-4">Bulan</th>
                  <th className="p-4">Kuota</th>
                  <th className="p-4 w-32 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingKuotaTematik ? (
                  <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : kuotaTematikList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      <p className="mb-3">Belum ada data kuota kelas tematik.</p>
                      <button onClick={() => { setEditingKuotaTematik(null); setIsKuotaTematikModalOpen(true); }} className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition text-sm font-medium shadow-sm">
                        <PlusCircle className="w-4 h-4" /> Tambah Kuota Baru
                      </button>
                    </td>
                  </tr>
                ) : (
                  kuotaTematikList.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-4 text-center">{index + 1}</td>
                      <td className="p-4 font-medium text-gray-900">{item.lokasi}</td>
                      <td className="p-4">{item.bulan}</td>
                      <td className="p-4 font-semibold text-amber-700">{item.kuota}</td>
                      <td className="p-4 flex justify-center gap-2">
                        <button onClick={() => { setEditingKuotaTematik(item); setIsKuotaTematikModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteKuotaTematik(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* SECTION 4: PROGRAM */}
      <section id="program">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><BookOpen className="w-5 h-5" /> Kelola Program</h2>
          <button onClick={() => { setEditingProgram(null); setIsProgramModalOpen(true); }} className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition text-sm">
            <PlusCircle className="w-4 h-4" /> Tambah Program
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
                <tr>
                  <th className="p-4 w-12 text-center">No.</th>
                  <th className="p-4">Nama Program</th>
                  <th className="p-4 w-32 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingProgram ? (
                  <tr><td colSpan={3} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></td></tr>
                ) : programList.length === 0 ? (
                  <tr><td colSpan={3} className="p-8 text-center text-gray-500">Belum ada program.</td></tr>
                ) : (
                  programList.map((item, index) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-4 text-center">{index + 1}</td>
                      <td className="p-4 font-medium text-gray-900">{item.nama}</td>
                      <td className="p-4 flex justify-center gap-2">
                        <button onClick={() => { setEditingProgram(item); setIsProgramModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteProgram(item.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* MODALS */}
      {isLokasiModalOpen && <LokasiModal data={editingLokasi} onClose={() => setIsLokasiModalOpen(false)} onSave={handleSaveLokasi} />}
      {isProgramModalOpen && <ProgramModal data={editingProgram} onClose={() => setIsProgramModalOpen(false)} onSave={handleSaveProgram} />}
      {isJadwalModalOpen && <JadwalModal data={editingJadwal} lokasiOptions={lokasiList} onClose={() => setIsJadwalModalOpen(false)} onSave={handleSaveJadwal} />}
      {isKuotaTematikModalOpen && <KuotaTematikModal data={editingKuotaTematik} lokasiOptions={lokasiList} onClose={() => setIsKuotaTematikModalOpen(false)} onSave={handleSaveKuotaTematik} />}
    </div>
  );
}

// --- MODAL COMPONENTS ---

function LokasiModal({ data, onClose, onSave }: { data: Lokasi | null, onClose: () => void, onSave: (formData: { nama: string, alamat: string }) => void }) {
  const [formData, setFormData] = useState({ nama: data?.nama || '', alamat: data?.alamat || '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSave(formData);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">{data ? 'Edit' : 'Tambah'} Lokasi</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lokasi</label>
            <input required value={formData.nama} onChange={e => setFormData({ ...formData, nama: e.target.value })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
            <textarea required value={formData.alamat} onChange={e => setFormData({ ...formData, alamat: e.target.value })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none" rows={3}></textarea>
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isSubmitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition disabled:opacity-50">
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function JadwalModal({ data, lokasiOptions, onClose, onSave }: { data: JadwalTrial | null, lokasiOptions: Lokasi[], onClose: () => void, onSave: (formData: { lokasi: string, tanggal: string, waktu: string }) => void }) {
  const [formData, setFormData] = useState({
    lokasi: data?.lokasi || '',
    tanggal: data?.tanggal || '',
    waktu: data?.waktu || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSave(formData);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">{data ? 'Edit' : 'Tambah'} Jadwal Trial</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Lokasi</label>
            <select required value={formData.lokasi} onChange={e => setFormData({ ...formData, lokasi: e.target.value })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white">
              <option value="" disabled>-- Pilih Lokasi --</option>
              {lokasiOptions.map(opt => <option key={opt.id} value={opt.nama}>{opt.nama}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Tanggal</label>
              <input type="date" required value={formData.tanggal} onChange={e => setFormData({ ...formData, tanggal: e.target.value })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Waktu</label>
              <input type="time" required value={formData.waktu} onChange={e => setFormData({ ...formData, waktu: e.target.value })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-purple-500 outline-none" />
            </div>
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isSubmitting} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-purple-700 transition disabled:opacity-50">
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProgramModal({ data, onClose, onSave }: { data: Program | null, onClose: () => void, onSave: (formData: { nama: string }) => void }) {
  const [formData, setFormData] = useState({ nama: data?.nama || '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSave(formData);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">{data ? 'Edit' : 'Tambah'} Program</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Program</label>
            <input required value={formData.nama} onChange={e => setFormData({ nama: e.target.value })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isSubmitting} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition disabled:opacity-50">
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function KuotaTematikModal({ data, lokasiOptions, onClose, onSave }: { data: KuotaTematik | null, lokasiOptions: Lokasi[], onClose: () => void, onSave: (formData: { lokasi: string; bulan: string; kuota: number }) => void }) {
  const [formData, setFormData] = useState({
    lokasi: data?.lokasi || '',
    bulan: data?.bulan || '',
    kuota: data?.kuota !== undefined ? data.kuota : 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await onSave({
      lokasi: formData.lokasi,
      bulan: formData.bulan,
      kuota: Number(formData.kuota)
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-gray-800">{data ? 'Edit' : 'Tambah'} Kuota Kelas Tematik</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pilih Lokasi</label>
            <select required value={formData.lokasi} onChange={e => setFormData({ ...formData, lokasi: e.target.value })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none bg-white">
              <option value="" disabled>-- Pilih Lokasi --</option>
              {lokasiOptions.map(opt => <option key={opt.id} value={opt.nama}>{opt.nama}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bulan</label>
            <input required type="text" placeholder="Contoh: Januari 2025" value={formData.bulan} onChange={e => setFormData({ ...formData, bulan: e.target.value })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kuota</label>
            <input required type="number" min="0" value={formData.kuota} onChange={e => setFormData({ ...formData, kuota: Number(e.target.value) })} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none" />
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
            <button type="submit" disabled={isSubmitting} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition disabled:opacity-50">
              {isSubmitting ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}