"use client";

import { useState, useEffect, FormEvent } from 'react';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { Loader2, PlusCircle, Edit, Trash2, X, MapPin, BookOpen } from 'lucide-react';

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

  // Fetch Data
  useEffect(() => {
    const fetchData = async (collectionName: string, setter: Function, loaderSetter: Function) => {
      try {
        const q = query(collection(db, collectionName), orderBy("nama", "asc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
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

  return (
    <div className="space-y-8">
      {/* SECTION 1: LOKASI */}
      <section>
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

      {/* SECTION 2: PROGRAM */}
      <section>
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