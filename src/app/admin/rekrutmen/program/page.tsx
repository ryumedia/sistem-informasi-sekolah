"use client";

import { useState, useEffect } from 'react';
import { db, storage } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { Plus, Pencil, Trash2, X, Loader2, ClipboardList, Image as ImageIcon } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import Image from 'next/image';

// --- INTERFACES ---
interface ProgramRekrutmen {
  id: string;
  nama: string;
  coverUrl: string;
  tanggalMulai: Timestamp;
  tanggalSelesai: Timestamp;
}

const initialFormData = {
  nama: "",
  coverUrl: "",
  tanggalMulai: new Date(),
  tanggalSelesai: new Date(),
};

export default function ProgramRekrutmenPage() {
  // --- STATE MANAGEMENT ---
  const [programList, setProgramList] = useState<ProgramRekrutmen[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>(initialFormData);
  const [coverFile, setCoverFile] = useState<File | null>(null);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const q = query(collection(db, "rekrutmen_program"), orderBy("tanggalMulai", "desc"));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProgramRekrutmen));
        setProgramList(list);
      } catch (error) {
        console.error("Error fetching programs: ", error);
        alert("Gagal memuat data program.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- HANDLER FUNCTIONS ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCoverFile(e.target.files[0]);
    }
  };

  const openModal = (program: ProgramRekrutmen | null = null) => {
    if (program) {
      setEditingId(program.id);
      setFormData({
        nama: program.nama,
        coverUrl: program.coverUrl,
        tanggalMulai: program.tanggalMulai.toDate(),
        tanggalSelesai: program.tanggalSelesai.toDate(),
      });
    } else {
      setEditingId(null);
      setFormData(initialFormData);
    }
    setCoverFile(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let coverUrl = formData.coverUrl;

    try {
      // Upload new cover image if selected
      if (coverFile) {
        const storageRef = ref(storage, `rekrutmen_covers/${Date.now()}_${coverFile.name}`);
        await uploadBytes(storageRef, coverFile);
        coverUrl = await getDownloadURL(storageRef);
      }

      const dataToSave = {
        nama: formData.nama,
        coverUrl: coverUrl,
        tanggalMulai: Timestamp.fromDate(new Date(formData.tanggalMulai)),
        tanggalSelesai: Timestamp.fromDate(new Date(formData.tanggalSelesai)),
      };

      if (editingId) {
        await updateDoc(doc(db, "rekrutmen_program", editingId), dataToSave);
        alert("Program berhasil diperbarui.");
      } else {
        await addDoc(collection(db, "rekrutmen_program"), { ...dataToSave, createdAt: new Date() });
        alert("Program berhasil ditambahkan.");
      }
      
      // Refresh list
      const q = query(collection(db, "rekrutmen_program"), orderBy("tanggalMulai", "desc"));
      const snapshot = await getDocs(q);
      setProgramList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProgramRekrutmen)));
      
      closeModal();
    } catch (error) {
      console.error("Error saving program:", error);
      alert("Gagal menyimpan program.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (program: ProgramRekrutmen) => {
    if (!confirm(`Yakin ingin menghapus program "${program.nama}"?`)) return;
    try {
      // Delete document from Firestore
      await deleteDoc(doc(db, "rekrutmen_program", program.id));

      // Delete cover image from Storage if it exists
      if (program.coverUrl) {
        const imageRef = ref(storage, program.coverUrl);
        await deleteObject(imageRef).catch(err => console.warn("Image not found or could not be deleted:", err));
      }

      setProgramList(prev => prev.filter(p => p.id !== program.id));
      alert("Program berhasil dihapus.");
    } catch (error) {
      console.error("Error deleting program:", error);
      alert("Gagal menghapus program.");
    }
  };

  // --- RENDER ---
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-800">Program Rekrutmen</h1>
        <button
          onClick={() => openModal()}
          className="bg-[#581c87] text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-[#45156b] transition"
        >
          <Plus className="w-4 h-4" /> Tambah Program
        </button>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-gray-900 font-semibold border-b">
              <tr>
                <th className="p-4 w-16 text-center">No.</th>
                <th className="p-4">Nama Program</th>
                <th className="p-4 text-center">Cover</th>
                <th className="p-4">Masa Berlaku</th>
                <th className="p-4 w-40 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#581c87]" /></td></tr>
              ) : programList.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-gray-500">Belum ada program rekrutmen.</td></tr>
              ) : (
                programList.map((program, i) => (
                  <tr key={program.id} className="hover:bg-gray-50">
                    <td className="p-4 text-center">{i + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{program.nama}</td>
                    <td className="p-4 flex justify-center">
                      {program.coverUrl ? (
                        <Image src={program.coverUrl} alt={program.nama} width={100} height={60} className="object-cover rounded-md bg-gray-100" />
                      ) : (
                        <div className="w-[100px] h-[60px] bg-gray-100 flex items-center justify-center rounded-md">
                          <ImageIcon className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {format(program.tanggalMulai.toDate(), 'dd MMM yyyy')} - {format(program.tanggalSelesai.toDate(), 'dd MMM yyyy')}
                    </td>
                    <td className="p-4 flex justify-center items-center gap-2 h-[76px]">
                      <Link href={`/admin/rekrutmen/program/${program.id}/pertanyaan`} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition" title="Daftar Pertanyaan">
                        <ClipboardList className="w-4 h-4" />
                      </Link>
                      <button onClick={() => openModal(program)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(program)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition" title="Hapus">
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">{editingId ? 'Edit' : 'Tambah'} Program</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Program</label>
                <input type="text" value={formData.nama} onChange={e => setFormData({...formData, nama: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cover Gambar</label>
                <input type="file" accept="image/*" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#581c87]/10 file:text-[#581c87] hover:file:bg-[#581c87]/20" />
                {(formData.coverUrl || coverFile) && (
                  <div className="mt-2">
                    <Image 
                      src={coverFile ? URL.createObjectURL(coverFile) : formData.coverUrl} 
                      alt="Preview" 
                      width={150} 
                      height={90} 
                      className="object-cover rounded-md bg-gray-100" 
                    />
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mulai</label>
                  <input type="date" value={format(new Date(formData.tanggalMulai), 'yyyy-MM-dd')} onChange={e => setFormData({...formData, tanggalMulai: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Selesai</label>
                  <input type="date" value={format(new Date(formData.tanggalSelesai), 'yyyy-MM-dd')} onChange={e => setFormData({...formData, tanggalSelesai: e.target.value})} className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-[#581c87] outline-none" required />
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-200">Batal</button>
                <button type="submit" disabled={isSubmitting} className="bg-[#581c87] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#45156b] transition disabled:opacity-50">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Program'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}